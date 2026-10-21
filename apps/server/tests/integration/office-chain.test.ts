import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { GET as officeMe } from "@/api/office/me/route";
import { POST as createOffice } from "@/api/office/offices/route";
import { POST as createAccount, GET as listAccounts } from "@/api/office/accounts/route";
import { DELETE as endAccount } from "@/api/office/accounts/[id]/route";
import { GET as listSchools, POST as createSchool } from "@/api/office/schools/route";
import { PATCH as updateSchool } from "@/api/office/schools/[id]/route";
import { PUT as moveSchool } from "@/api/office/schools/[id]/district/route";
import { GET as listAudit } from "@/api/office/audit/route";
import { POST as changePassword } from "@/api/auth/change-password/route";
import { GET as me } from "@/api/auth/me/route";
import { GET as listStudents } from "@/api/students/route";
import { GET as setupStatus } from "@/api/school/setup/route";
import { POST as finishSetup } from "@/api/school/setup/complete/route";
import { GET as listYears } from "@/api/academic-years/route";
import { systemPrisma } from "@/lib/db/prisma";
import { authService } from "@/features/auth/auth.service";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestSchool,
  createTestOfficeUser,
  createTestDistrict,
  createTestAcademicYear,
  createTestTerm,
  createTestGrade,
  inSchool,
} from "../helpers/db";

const NEW_PASSWORD = "MyOwnPassword9";

/** Signs in with a one-time password and chooses a real one, as a new person would. */
async function firstSignIn(email: string, temporaryPassword: string) {
  const token = await loginAs(email, temporaryPassword);
  const changed = await callRoute(changePassword, {
    method: "POST",
    url: "/api/auth/change-password",
    token,
    body: { currentPassword: temporaryPassword, newPassword: NEW_PASSWORD },
  });
  expect(changed.status).toBe(200);
  return loginAs(email, NEW_PASSWORD);
}

const headBody = (overrides: Record<string, unknown> = {}) => ({
  name: "Chongwe Day Secondary School",
  emisNumber: "ZM-1001",
  category: "PUBLIC",
  head: {
    email: "head.chongwe@example.com",
    firstName: "Mutinta",
    lastName: "Hamoonga",
    phone: "0977123456",
    gender: "FEMALE",
    dateOfBirth: "1982-05-04",
    staffNumber: "TS-55501",
    qualification: "DEGREE",
  },
  ...overrides,
});

/**
 * Phase 4a: the account chain HQ → PEO → DEBS → school, each office seeing and changing only its
 * own area, and a new school held in first-time setup until its head finishes it.
 */
describe("education offices and the account chain", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("HQ creates a PEO, the PEO adds a district and its DEBS, the DEBS registers a school and its head", async () => {
    const hq = await createTestOfficeUser("office-hq");
    const hqToken = await loginAs(hq.user.email, hq.password);

    // HQ → PEO (Lusaka)
    const peo = await callRoute<{ data: { temporaryPassword: string; email: string } }>(createAccount, {
      method: "POST",
      url: "/api/office/accounts",
      token: hqToken,
      body: { officeId: "office-prov-lusaka", email: "peo.lusaka@example.com", displayName: "Peo Lusaka", role: "OFFICE_HEAD" },
    });
    expect(peo.status).toBe(201);
    expect(peo.json.data.temporaryPassword).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // The PEO must choose a password before anything else.
    const peoFirstToken = await loginAs("peo.lusaka@example.com", peo.json.data.temporaryPassword);
    expect((await callRoute(officeMe, { url: "/api/office/me", token: peoFirstToken })).status).toBe(403);
    const peoToken = await firstSignIn("peo.lusaka@example.com", peo.json.data.temporaryPassword);
    const peoMe = await callRoute<{ data: { office: { type: string; id: string } } }>(officeMe, {
      url: "/api/office/me",
      token: peoToken,
    });
    expect(peoMe.json.data.office).toMatchObject({ type: "PROVINCIAL", id: "office-prov-lusaka" });

    // PEO → district office → DEBS
    const district = await callRoute<{ data: { id: string; parentId: string } }>(createOffice, {
      method: "POST",
      url: "/api/office/offices",
      token: peoToken,
      body: { name: "Chongwe District Education Board", code: "DEBS-CHONGWE" },
    });
    expect(district.status).toBe(201);
    expect(district.json.data.parentId).toBe("office-prov-lusaka");
    const debs = await callRoute<{ data: { temporaryPassword: string } }>(createAccount, {
      method: "POST",
      url: "/api/office/accounts",
      token: peoToken,
      body: {
        officeId: district.json.data.id,
        email: "debs.chongwe@example.com",
        displayName: "Debs Chongwe",
        role: "OFFICE_HEAD",
        title: "District Education Board Secretary",
      },
    });
    expect(debs.status).toBe(201);
    const debsToken = await firstSignIn("debs.chongwe@example.com", debs.json.data.temporaryPassword);

    // DEBS → school + head teacher
    const school = await callRoute<{
      data: { school: { id: string }; temporaryPassword: string; head: { email: string } };
    }>(createSchool, { method: "POST", url: "/api/office/schools", token: debsToken, body: headBody() });
    expect(school.status).toBe(201);
    const row = await systemPrisma.school.findUniqueOrThrow({ where: { id: school.json.data.school.id } });
    expect(row).toMatchObject({ districtOfficeId: district.json.data.id, emisNumber: "ZM-1001", setupCompletedAt: null });

    // The head signs in: password first, then only the setup steps until setup is finished.
    const headToken = await firstSignIn("head.chongwe@example.com", school.json.data.temporaryPassword);
    const blocked = await callRoute<{ code: string }>(listStudents, { url: "/api/students", token: headToken });
    expect(blocked.status).toBe(403);
    expect(blocked.json.code).toBe("SCHOOL_SETUP_REQUIRED");
    expect(blocked.headers.get("X-School-Setup-Required")).toBe("true");
    expect((await callRoute(listYears, { url: "/api/academic-years", token: headToken })).status).toBe(200);

    const before = await callRoute<{ data: { canFinish: boolean; school: { name: string } } }>(setupStatus, {
      url: "/api/school/setup",
      token: headToken,
    });
    expect(before.json.data).toMatchObject({ canFinish: false, school: { name: "Chongwe Day Secondary School" } });
    expect((await callRoute(finishSetup, { method: "POST", url: "/api/school/setup/complete", token: headToken })).status).toBe(400);

    await inSchool(school.json.data.school.id, async () => {
      const year = await createTestAcademicYear();
      await createTestTerm(year.id);
      await createTestGrade({ level: null, name: "Form 1", stage: "O_LEVEL", sequence: 1 });
    });
    const finished = await callRoute<{ data: { setupComplete: boolean } }>(finishSetup, {
      method: "POST",
      url: "/api/school/setup/complete",
      token: headToken,
    });
    expect(finished.status).toBe(200);
    expect(finished.json.data.setupComplete).toBe(true);
    expect((await callRoute(listStudents, { url: "/api/students", token: headToken })).status).toBe(200);

    // Everything was recorded, and HQ sees it.
    const audit = await callRoute<{ data: { action: string }[] }>(listAudit, { url: "/api/office/audit", token: hqToken });
    expect(audit.json.data.map((a) => a.action)).toEqual(
      expect.arrayContaining(["ACCOUNT_CREATED", "OFFICE_CREATED", "SCHOOL_CREATED", "SETUP_COMPLETED"])
    );
  });

  it("each office stays inside its own area", async () => {
    const lusakaDistrict = await createTestDistrict("office-prov-lusaka", "Chongwe");
    const copperbeltDistrict = await createTestDistrict("office-prov-copperbelt", "Kitwe");
    const peo = await createTestOfficeUser("office-prov-lusaka");
    const peoToken = await loginAs(peo.user.email, peo.password);
    const debs = await createTestOfficeUser(lusakaDistrict.id);
    const debsToken = await loginAs(debs.user.email, debs.password);
    const officer = await createTestOfficeUser(lusakaDistrict.id, { role: "OFFICER" });
    const officerToken = await loginAs(officer.user.email, officer.password);
    const otherDebs = await createTestOfficeUser(copperbeltDistrict.id);
    const otherDebsToken = await loginAs(otherDebs.user.email, otherDebs.password);

    const account = (token: string, officeId: string, role = "OFFICE_HEAD") =>
      callRoute(createAccount, {
        method: "POST",
        url: "/api/office/accounts",
        token,
        body: { officeId, email: `x-${crypto.randomUUID()}@example.com`, displayName: "Someone", role },
      });

    // A PEO can't create accounts in another province, or a head for its own office.
    expect((await account(peoToken, copperbeltDistrict.id)).status).toBe(403);
    expect((await account(peoToken, "office-prov-copperbelt")).status).toBe(403);
    expect((await account(peoToken, "office-prov-lusaka")).status).toBe(403);
    expect((await account(peoToken, "office-prov-lusaka", "OFFICER")).status).toBe(201);
    // A DEBS adds officers to its own office only; an officer changes nothing.
    expect((await account(debsToken, lusakaDistrict.id, "OFFICER")).status).toBe(201);
    expect((await account(debsToken, copperbeltDistrict.id, "OFFICER")).status).toBe(403);
    expect((await account(officerToken, lusakaDistrict.id, "OFFICER")).status).toBe(403);

    // Only a DEBS head registers schools — always in its own district.
    expect((await callRoute(createSchool, { method: "POST", url: "/api/office/schools", token: peoToken, body: headBody() })).status).toBe(403);
    expect((await callRoute(createSchool, { method: "POST", url: "/api/office/schools", token: officerToken, body: headBody() })).status).toBe(403);
    const created = await callRoute<{ data: { school: { id: string } } }>(createSchool, {
      method: "POST",
      url: "/api/office/schools",
      token: debsToken,
      body: headBody(),
    });
    expect(created.status).toBe(201);
    // EMIS numbers are unique.
    const dup = await callRoute(createSchool, {
      method: "POST",
      url: "/api/office/schools",
      token: debsToken,
      body: headBody({ head: { ...headBody().head, email: "other@example.com", staffNumber: "TS-1" } }),
    });
    expect(dup.status).toBe(409);
    expect(await systemPrisma.school.count({ where: { name: "Chongwe Day Secondary School" } })).toBe(1);
    // If the head can't be created (staff number already used), the school isn't left behind.
    const clash = await callRoute<{ error: string }>(createSchool, {
      method: "POST",
      url: "/api/office/schools",
      token: debsToken,
      body: headBody({ name: "Second School", emisNumber: "ZM-2002", head: { ...headBody().head, email: "second@example.com" } }),
    });
    expect(clash.status).toBe(409);
    expect(clash.json.error).toMatch(/Staff number/);
    expect(await systemPrisma.school.count({ where: { name: "Second School" } })).toBe(0);

    const names = async (token: string) =>
      (await callRoute<{ data: { id: string }[] }>(listSchools, { url: "/api/office/schools", token })).json.data.map(
        (s) => s.id
      );
    expect(await names(debsToken)).toEqual([created.json.data.school.id]);
    expect(await names(peoToken)).toEqual([created.json.data.school.id]);
    expect(await names(otherDebsToken)).toEqual([]);

    // Another district can't change it; its own DEBS can.
    const id = created.json.data.school.id;
    expect(
      (await callRoute(updateSchool, { method: "PATCH", url: `/api/office/schools/${id}`, token: otherDebsToken, params: { id }, body: { emisStatus: "CONFIRMED" } })).status
    ).toBe(404);
    expect(
      (await callRoute(updateSchool, { method: "PATCH", url: `/api/office/schools/${id}`, token: debsToken, params: { id }, body: { emisStatus: "CONFIRMED" } })).status
    ).toBe(200);

    // The other district's audit log doesn't show it.
    const otherAudit = await callRoute<{ data: { action: string }[] }>(listAudit, { url: "/api/office/audit", token: otherDebsToken });
    expect(otherAudit.json.data).toHaveLength(0);
  });

  it("a PEO moves a school out of 'not yet assigned' into its province; a DEBS can't move schools", async () => {
    const district = await createTestDistrict("office-prov-lusaka", "Chongwe");
    const school = await createTestSchool({ name: "Old School" }); // in "not yet assigned"
    const peo = await createTestOfficeUser("office-prov-lusaka");
    const peoToken = await loginAs(peo.user.email, peo.password);
    const debs = await createTestOfficeUser(district.id);
    const debsToken = await loginAs(debs.user.email, debs.password);
    const elsewhere = await createTestDistrict("office-prov-copperbelt", "Kitwe");

    const move = (token: string, districtOfficeId: string) =>
      callRoute(moveSchool, {
        method: "PUT",
        url: `/api/office/schools/${school.id}/district`,
        token,
        params: { id: school.id },
        body: { districtOfficeId },
      });
    expect((await move(debsToken, district.id)).status).toBe(403);
    expect((await move(peoToken, elsewhere.id)).status).toBe(403);
    expect((await move(peoToken, district.id)).status).toBe(200);
    expect((await systemPrisma.school.findUniqueOrThrow({ where: { id: school.id } })).districtOfficeId).toBe(district.id);
  });

  it("office accounts and school accounts each stay on their own pages", async () => {
    const hq = await createTestOfficeUser("office-hq");
    const hqToken = await loginAs(hq.user.email, hq.password);
    const teacher = await createTestUser({ role: Role.TEACHER });
    const teacherToken = await loginAs(teacher.user.email, teacher.password);

    const officeOnSchool = await callRoute<{ error: string }>(listStudents, { url: "/api/students", token: hqToken });
    expect(officeOnSchool.status).toBe(403);
    expect(officeOnSchool.json.error).toMatch(/education office/);
    expect((await callRoute(officeMe, { url: "/api/office/me", token: teacherToken })).status).toBe(403);

    // Sign-in and "me" say where each person works.
    const login = await authService.login({ email: hq.user.email, password: hq.password });
    expect(login.user?.office).toMatchObject({ officeId: "office-hq", officeType: "HQ", role: "OFFICE_HEAD" });
    expect(login.user?.school).toBeNull();
    const whoTeacher = await callRoute<{ data: { school: { setupComplete: boolean } | null; office: unknown } }>(me, {
      url: "/api/auth/me",
      token: teacherToken,
    });
    expect(whoTeacher.json.data.school?.setupComplete).toBe(true);
    expect(whoTeacher.json.data.office).toBeNull();
  });

  it("ending an office role signs the person out of the office pages; nobody can end their own", async () => {
    const district = await createTestDistrict();
    const debs = await createTestOfficeUser(district.id);
    const debsToken = await loginAs(debs.user.email, debs.password);
    const officer = await createTestOfficeUser(district.id, { role: "OFFICER" });
    const officerToken = await loginAs(officer.user.email, officer.password);

    const self = await callRoute(endAccount, {
      method: "DELETE",
      url: `/api/office/accounts/${debs.membership.id}`,
      token: debsToken,
      params: { id: debs.membership.id },
    });
    expect(self.status).toBe(400);
    const ended = await callRoute(endAccount, {
      method: "DELETE",
      url: `/api/office/accounts/${officer.membership.id}`,
      token: debsToken,
      params: { id: officer.membership.id },
    });
    expect(ended.status).toBe(200);
    expect((await callRoute(officeMe, { url: "/api/office/me", token: officerToken })).status).toBe(403);

    const accounts = await callRoute<{ data: { id: string }[] }>(listAccounts, { url: "/api/office/accounts", token: debsToken });
    expect(accounts.json.data.map((a) => a.id)).toEqual([debs.membership.id]);
  });
});
