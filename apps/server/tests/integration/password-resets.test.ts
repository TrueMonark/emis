import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { POST as forgotPassword } from "@/api/auth/forgot-password/route";
import { POST as login } from "@/api/auth/login/route";
import { GET as listResets } from "@/api/password-resets/route";
import { POST as resetFromRequest } from "@/api/password-resets/[id]/reset/route";
import { POST as declineRequest } from "@/api/password-resets/[id]/decline/route";
import { GET as listOfficeResets } from "@/api/office/password-resets/route";
import { POST as officeReset } from "@/api/office/password-resets/[id]/reset/route";
import { POST as resetTeacher } from "@/api/teachers/[id]/reset-password/route";
import { POST as createTeacher } from "@/api/teachers/route";
import { GET as listAudit } from "@/api/office/audit/route";
import prisma, { systemPrisma } from "@/lib/db/prisma";
import { passwordResetService, RESET_REQUEST_REPLY } from "@/features/password-resets/passwordReset.service";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestSchool,
  createTestOfficeUser,
  createTestDistrict,
  createTestSubject,
  inSchool,
  TEST_SCHOOL_ID,
} from "../helpers/db";

type ResetRow = { id: string; userId: string; name: string };
const OTP = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

async function requestFor(identifier: string) {
  return callRoute<{ data: { message: string } }>(forgotPassword, {
    method: "POST",
    url: "/api/auth/forgot-password",
    body: { identifier },
  });
}

async function openRequests() {
  return systemPrisma.passwordResetRequest.findMany({ where: { status: "OPEN" } });
}

/**
 * Phase 4b: "Forgot password?" goes to the person's head/deputy (or the office above), who
 * resets it with a one-time password. Nobody resets their own, and nobody can reset an account
 * that hasn't asked.
 */
describe("password reset requests", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("a teacher asks; the head and deputy are told; one resets it; the teacher signs in with the one-time password", async () => {
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const deputy = await createTestUser({ role: Role.DEPUTY_HEAD });
    const teacher = await createTestUser({ role: Role.TEACHER, email: "forgot.teacher@example.com" });
    const headToken = await loginAs(head.user.email, head.password);
    const deputyToken = await loginAs(deputy.user.email, deputy.password);

    // Same reply for a real account and an unknown one; only the real one makes a request.
    const real = await requestFor("Forgot.Teacher@example.com");
    const unknown = await requestFor("nobody-here@example.com");
    expect(real.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(real.json.data.message).toBe(RESET_REQUEST_REPLY);
    expect(unknown.json.data).toEqual(real.json.data);
    const requests = await openRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ userId: teacher.user.id, handlerSchoolId: TEST_SCHOOL_ID, handlerOfficeId: null });

    // Both leaders got a notification.
    const notes = await prisma.notification.findMany({ where: { relatedEntityType: "PASSWORD_RESET_REQUEST" } });
    expect(notes.map((n) => n.recipientId).sort()).toEqual([head.user.id, deputy.user.id].sort());

    // Asking again doesn't pile up requests.
    await requestFor("forgot.teacher@example.com");
    expect(await openRequests()).toHaveLength(1);

    // A teacher can't see or handle requests.
    const teacherToken = await loginAs(teacher.user.email, teacher.password);
    expect((await callRoute(listResets, { url: "/api/password-resets", token: teacherToken })).status).toBe(403);

    const list = await callRoute<{ data: ResetRow[] }>(listResets, { url: "/api/password-resets", token: deputyToken });
    expect(list.status).toBe(200);
    expect(list.json.data).toHaveLength(1);
    const id = list.json.data[0].id;

    const reset = await callRoute<{ data: { temporaryPassword: string; email: string } }>(resetFromRequest, {
      method: "POST",
      url: `/api/password-resets/${id}/reset`,
      token: headToken,
      params: { id },
    });
    expect(reset.status).toBe(200);
    expect(reset.json.data.temporaryPassword).toMatch(OTP);

    // The old password stops working; the one-time password works and forces a change.
    await expect(loginAs(teacher.user.email, teacher.password)).rejects.toThrow();
    await loginAs(teacher.user.email, reset.json.data.temporaryPassword);
    const user = await systemPrisma.user.findUniqueOrThrow({ where: { id: teacher.user.id } });
    expect(user.hasDefaultPassword).toBe(true);

    // The request is closed: the button is gone and pressing it again does nothing.
    expect((await callRoute<{ data: ResetRow[] }>(listResets, { url: "/api/password-resets", token: headToken })).json.data).toHaveLength(0);
    const again = await callRoute(resetFromRequest, {
      method: "POST",
      url: `/api/password-resets/${id}/reset`,
      token: deputyToken,
      params: { id },
    });
    expect(again.status).toBe(422);

    const audit = await systemPrisma.auditLog.findMany({ where: { action: "PASSWORD_RESET" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorUserId: head.user.id, targetId: teacher.user.id, schoolId: TEST_SCHOOL_ID });
  });

  it("there's no reset without a request (except re-issuing a never-used account's one-time password)", async () => {
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const headToken = await loginAs(head.user.email, head.password);
    const teacher = await createTestUser({ role: Role.TEACHER });

    const denied = await callRoute<{ error: string }>(resetTeacher, {
      method: "POST",
      url: `/api/teachers/${teacher.teacherProfile!.id}/reset-password`,
      token: headToken,
      params: { id: teacher.teacherProfile!.id },
    });
    expect(denied.status).toBe(403);
    expect(denied.json.error).toMatch(/Forgot password/);

    // The Teachers page's button handles an open request too (and closes it).
    await passwordResetService.request(teacher.user.email);
    const viaTeachersPage = await callRoute<{ data: { temporaryPassword: string } }>(resetTeacher, {
      method: "POST",
      url: `/api/teachers/${teacher.teacherProfile!.id}/reset-password`,
      token: headToken,
      params: { id: teacher.teacherProfile!.id },
    });
    expect(viaTeachersPage.status).toBe(200);
    expect(await openRequests()).toHaveLength(0);
  });

  it("routes requests: head ↔ deputy; a school with no other leader → its DEBS; DEBS → PEO; PEO → HQ; no head above → further up", async () => {
    const district = await createTestDistrict("office-prov-lusaka", "Chongwe");
    const school = await createTestSchool({ name: "Chongwe Day", districtOfficeId: district.id });
    const debs = await createTestOfficeUser(district.id, { email: "debs.route@example.com" });
    const peo = await createTestOfficeUser("office-prov-lusaka", { email: "peo.route@example.com" });
    await createTestOfficeUser("office-hq");

    // Test School A: head and deputy reset each other.
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const deputy = await createTestUser({ role: Role.DEPUTY_HEAD });
    expect(await passwordResetService.routeFor(head.user.id)).toEqual({ handlerSchoolId: TEST_SCHOOL_ID, handlerOfficeId: null });
    expect(await passwordResetService.routeFor(deputy.user.id)).toEqual({ handlerSchoolId: TEST_SCHOOL_ID, handlerOfficeId: null });

    // Chongwe Day: only a head, so the head's request goes to the DEBS; a teacher's stays at school.
    const loneHead = await inSchool(school.id, () => createTestUser({ role: Role.HEAD_TEACHER, schoolId: school.id }));
    const teacher = await inSchool(school.id, () => createTestUser({ role: Role.TEACHER, schoolId: school.id }));
    expect(await passwordResetService.routeFor(loneHead.user.id)).toEqual({ handlerSchoolId: null, handlerOfficeId: district.id });
    expect(await passwordResetService.routeFor(teacher.user.id)).toEqual({ handlerSchoolId: school.id, handlerOfficeId: null });

    // Office staff go to the office above.
    expect(await passwordResetService.routeFor(debs.user.id)).toEqual({ handlerSchoolId: null, handlerOfficeId: "office-prov-lusaka" });
    expect(await passwordResetService.routeFor(peo.user.id)).toEqual({ handlerSchoolId: null, handlerOfficeId: "office-hq" });

    // A district whose province has no head: straight to HQ.
    const kitwe = await createTestDistrict("office-prov-copperbelt", "Kitwe");
    const kitweDebs = await createTestOfficeUser(kitwe.id);
    expect(await passwordResetService.routeFor(kitweDebs.user.id)).toEqual({ handlerSchoolId: null, handlerOfficeId: "office-hq" });

    // Someone who works nowhere: no request at all (same reply).
    const nobody = await createTestUser({ role: Role.TEACHER, schoolId: null, email: "unlinked@example.com" });
    expect(await passwordResetService.routeFor(nobody.user.id)).toBeNull();
    await requestFor("unlinked@example.com");
    expect(await openRequests()).toHaveLength(0);
  });

  it("the DEBS resets a lone head teacher; officers and other offices can't; nobody resets their own", async () => {
    const district = await createTestDistrict("office-prov-lusaka", "Chongwe");
    const otherDistrict = await createTestDistrict("office-prov-lusaka", "Kafue");
    const school = await createTestSchool({ name: "Chongwe Day", districtOfficeId: district.id });
    const debs = await createTestOfficeUser(district.id);
    const officer = await createTestOfficeUser(district.id, { role: "OFFICER" });
    const otherDebs = await createTestOfficeUser(otherDistrict.id);
    const loneHead = await inSchool(school.id, () =>
      createTestUser({ role: Role.HEAD_TEACHER, schoolId: school.id, email: "lone.head@example.com" })
    );

    await passwordResetService.request("lone.head@example.com");
    const debsToken = await loginAs(debs.user.email, debs.password);
    const officerToken = await loginAs(officer.user.email, officer.password);
    const otherToken = await loginAs(otherDebs.user.email, otherDebs.password);

    const list = await callRoute<{ data: (ResetRow & { worksAt: { name: string } })[] }>(listOfficeResets, {
      url: "/api/office/password-resets",
      token: debsToken,
    });
    expect(list.json.data).toHaveLength(1);
    expect(list.json.data[0].worksAt.name).toBe("Chongwe Day");
    const id = list.json.data[0].id;

    const asOther = await callRoute(officeReset, { method: "POST", url: `/api/office/password-resets/${id}/reset`, token: otherToken, params: { id } });
    expect(asOther.status).toBe(404);
    const asOfficer = await callRoute(officeReset, { method: "POST", url: `/api/office/password-resets/${id}/reset`, token: officerToken, params: { id } });
    expect(asOfficer.status).toBe(403);
    // A school head can't reach an office's request either.
    const headToken = await loginAs(loneHead.user.email, loneHead.password);
    expect((await callRoute(resetFromRequest, { method: "POST", url: `/api/password-resets/${id}/reset`, token: headToken, params: { id } })).status).toBe(404);

    const reset = await callRoute<{ data: { temporaryPassword: string } }>(officeReset, {
      method: "POST",
      url: `/api/office/password-resets/${id}/reset`,
      token: debsToken,
      params: { id },
    });
    expect(reset.status).toBe(200);
    expect(await loginAs("lone.head@example.com", reset.json.data.temporaryPassword)).toBeTruthy();

    // The DEBS's audit log shows it.
    const audit = await callRoute<{ data: { action: string }[] }>(listAudit, { url: "/api/office/audit", token: debsToken });
    expect(audit.json.data.map((a) => a.action)).toContain("PASSWORD_RESET");

    // Head and deputy: each can't handle their own request.
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    await createTestUser({ role: Role.DEPUTY_HEAD });
    await passwordResetService.request(head.user.email);
    const own = (await openRequests()).find((r) => r.userId === head.user.id)!;
    const ownHeadToken = await loginAs(head.user.email, head.password);
    expect((await callRoute<{ data: ResetRow[] }>(listResets, { url: "/api/password-resets", token: ownHeadToken })).json.data).toHaveLength(0);
    const self = await callRoute(resetFromRequest, { method: "POST", url: `/api/password-resets/${own.id}/reset`, token: ownHeadToken, params: { id: own.id } });
    expect(self.status).toBe(403);
  });

  it("a request can be turned down; the person can ask again", async () => {
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const headToken = await loginAs(head.user.email, head.password);
    const teacher = await createTestUser({ role: Role.TEACHER });
    await passwordResetService.request(teacher.user.email);
    const [request] = await openRequests();

    const declined = await callRoute(declineRequest, {
      method: "POST",
      url: `/api/password-resets/${request.id}/decline`,
      token: headToken,
      params: { id: request.id },
    });
    expect(declined.status).toBe(200);
    expect(await openRequests()).toHaveLength(0);
    // Their password is unchanged.
    expect(await loginAs(teacher.user.email, teacher.password)).toBeTruthy();

    await passwordResetService.request(teacher.user.email);
    expect(await openRequests()).toHaveLength(1);
  });
});

describe("signing in with a mobile number", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("works with the number written any common way; the email still works", async () => {
    const teacher = await createTestUser({ role: Role.TEACHER, email: "phone.signin@example.com" });
    await systemPrisma.user.update({ where: { id: teacher.user.id }, data: { phone: "+260977123456" } });

    for (const typed of ["0977123456", "0977 123 456", "+260 977 123 456", "260977123456"]) {
      const res = await callRoute<{ data: { user: { email: string } } }>(login, {
        method: "POST",
        url: "/api/auth/login",
        body: { identifier: typed, password: teacher.password },
      });
      expect(res.status).toBe(200);
      expect(res.json.data.user.email).toBe("phone.signin@example.com");
    }
    expect(await loginAs("phone.signin@example.com", teacher.password)).toBeTruthy();

    const wrong = await callRoute<{ error: string }>(login, {
      method: "POST",
      url: "/api/auth/login",
      body: { identifier: "0966000000", password: teacher.password },
    });
    expect(wrong.status).toBe(401);

    // "Forgot password?" accepts the number too.
    await createTestUser({ role: Role.HEAD_TEACHER });
    await requestFor("0977 123 456");
    expect(await openRequests()).toHaveLength(1);
  });

  it("a new teacher can sign in with their number, unless another account already uses it", async () => {
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const headToken = await loginAs(head.user.email, head.password);
    const subject = await createTestSubject();
    const body = (email: string, staffNumber: string) => ({
      email,
      staffNumber,
      firstName: "Phone",
      lastName: "Person",
      dateOfBirth: "1990-01-01",
      gender: "FEMALE",
      phone: "0966555444",
      qualification: "DEGREE",
      hireDate: "2024-01-01",
      primarySubjectId: subject.id,
    });

    const first = await callRoute(createTeacher, { method: "POST", url: "/api/teachers", token: headToken, body: body("first.phone@example.com", "STAFF2024901") });
    expect(first.status).toBe(201);
    const second = await callRoute(createTeacher, { method: "POST", url: "/api/teachers", token: headToken, body: body("second.phone@example.com", "STAFF2024902") });
    expect(second.status).toBe(201);

    const users = await systemPrisma.user.findMany({
      where: { email: { in: ["first.phone@example.com", "second.phone@example.com"] } },
      orderBy: { email: "asc" },
    });
    expect(users.map((u) => [u.email, u.phone])).toEqual([
      ["first.phone@example.com", "+260966555444"],
      ["second.phone@example.com", null],
    ]);
  });
});
