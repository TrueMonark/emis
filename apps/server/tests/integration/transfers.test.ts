import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { GET as lookup } from "@/api/staff/lookup/route";
import { GET as listTransfers, POST as requestTransfer } from "@/api/transfers/route";
import { DELETE as cancelTransfer } from "@/api/transfers/[id]/route";
import { POST as confirmTransfer } from "@/api/transfers/[id]/confirm/route";
import { POST as declineTransfer } from "@/api/transfers/[id]/decline/route";
import { GET as officeTransfers } from "@/api/office/transfers/route";
import { POST as officeConfirm } from "@/api/office/transfers/[id]/confirm/route";
import { GET as officePeople } from "@/api/office/people/route";
import { POST as createSchool } from "@/api/office/schools/route";
import { GET as listTeachers } from "@/api/teachers/route";
import { PATCH as updateTeacher } from "@/api/teachers/[id]/route";
import { GET as me } from "@/api/auth/me/route";
import prisma, { systemPrisma } from "@/lib/db/prisma";
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
  createTestGrade,
  createTestClass,
  createTestDepartment,
  assignClassTeacher,
  inSchool,
  TEST_SCHOOL_ID,
} from "../helpers/db";

type Transfer = { id: string; userId: string; direction: "in" | "out" | null; fromSchool: { name: string } | null; toSchool: { name: string } };

/**
 * Phase 4b: transfers. One account for life, one school at a time: the new school asks, the old
 * school (or the DEBS) confirms, and at that moment the person moves over completely.
 */
describe("staff transfers", () => {
  let district: { id: string };
  let schoolB: { id: string; name: string };

  beforeEach(async () => {
    await resetDb();
    district = await createTestDistrict("office-prov-lusaka", "Chongwe");
    await systemPrisma.school.update({ where: { id: TEST_SCHOOL_ID }, data: { districtOfficeId: district.id } });
    schoolB = await createTestSchool({ name: "Kitwe Boys", districtOfficeId: district.id });
  });

  it("school B asks for a teacher at school A; A confirms; the teacher moves over and A's assignments are released", async () => {
    const headA = await createTestUser({ role: Role.HEAD_TEACHER });
    const headAToken = await loginAs(headA.user.email, headA.password);
    const teacher = await createTestUser({ role: Role.TEACHER, email: "mover@example.com" });
    const year = await createTestAcademicYear();
    const grade = await createTestGrade();
    const klass = await createTestClass(grade.id);
    await assignClassTeacher(teacher.teacherProfile!.id, klass.id, year.id);
    const dept = await createTestDepartment({ hodTeacherId: teacher.teacherProfile!.id });

    const headB = await inSchool(schoolB.id, () => createTestUser({ role: Role.HEAD_TEACHER, schoolId: schoolB.id }));
    const headBToken = await loginAs(headB.user.email, headB.password);

    // B finds them by exact email only: name and current school, nothing else.
    const found = await callRoute<{ data: { userId: string; name: string; currentSchool: { name: string } } | null }>(lookup, {
      url: "/api/staff/lookup?q=mover@example.com",
      token: headBToken,
    });
    expect(found.json.data).toMatchObject({ userId: teacher.user.id, name: "Test Teacher", currentSchool: { name: "Test School A" } });
    const missing = await callRoute<{ data: null }>(lookup, { url: "/api/staff/lookup?q=mov", token: headBToken });
    expect(missing.status).toBe(422);

    const asked = await callRoute<{ data: { status: string } }>(requestTransfer, {
      method: "POST",
      url: "/api/transfers",
      token: headBToken,
      body: { userId: teacher.user.id, role: "TEACHER" },
    });
    expect(asked.status).toBe(201);
    expect(asked.json.data.status).toBe("PENDING");

    // Still working at A until confirmed, and they can see the transfer waiting.
    const stillA = await authService.login({ email: "mover@example.com", password: teacher.password });
    expect(stillA.user?.school?.id).toBe(TEST_SCHOOL_ID);
    const teacherToken = stillA.token!;
    const meNow = await callRoute<{ data: { pendingTransfer: { schoolName: string } } }>(me, { url: "/api/auth/me", token: teacherToken });
    expect(meNow.json.data.pendingTransfer.schoolName).toBe("Kitwe Boys");

    // B sees it as "in", A as "out"; B lists the teacher as joining, not current.
    const inB = await callRoute<{ data: Transfer[] }>(listTransfers, { url: "/api/transfers", token: headBToken });
    expect(inB.json.data.map((t) => t.direction)).toEqual(["in"]);
    const outA = await callRoute<{ data: Transfer[] }>(listTransfers, { url: "/api/transfers", token: headAToken });
    expect(outA.json.data).toHaveLength(1);
    expect(outA.json.data[0]).toMatchObject({ direction: "out", toSchool: { name: "Kitwe Boys" }, fromSchool: { name: "Test School A" } });
    const joining = await callRoute<{ data: { id: string }[] }>(listTeachers, { url: "/api/teachers?staff=joining", token: headBToken });
    expect(joining.json.data.map((t) => t.id)).toEqual([teacher.teacherProfile!.id]);

    // The asking school can't confirm its own request.
    const id = outA.json.data[0].id;
    expect((await callRoute(confirmTransfer, { method: "POST", url: `/api/transfers/${id}/confirm`, token: headBToken, params: { id } })).status).toBe(404);

    const confirmed = await callRoute<{ data: { released: { classTeacher: number } } }>(confirmTransfer, {
      method: "POST",
      url: `/api/transfers/${id}/confirm`,
      token: headAToken,
      params: { id },
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.json.data.released.classTeacher).toBe(1);

    // They now work at B.
    const nowB = await authService.login({ email: "mover@example.com", password: teacher.password });
    expect(nowB.user?.school?.id).toBe(schoolB.id);
    const memberships = await systemPrisma.schoolMembership.findMany({ where: { userId: teacher.user.id }, orderBy: { schoolId: "asc" } });
    expect(memberships.map((m) => [m.schoolId, m.status])).toEqual(
      [[schoolB.id, "ACTIVE"], [TEST_SCHOOL_ID, "ENDED"]].sort((a, b) => a[0].localeCompare(b[0]))
    );

    // At A: class teacher assignment ended, no longer HOD, listed as former staff, read-only.
    const assignment = await prisma.classTeacherAssignment.findFirstOrThrow({ where: { classId: klass.id } });
    expect(assignment.endedAt).not.toBeNull();
    expect((await prisma.department.findUniqueOrThrow({ where: { id: dept.id } })).hodTeacherId).toBeNull();
    const currentA = await callRoute<{ data: { id: string }[] }>(listTeachers, { url: "/api/teachers", token: headAToken });
    expect(currentA.json.data.map((t) => t.id)).not.toContain(teacher.teacherProfile!.id);
    const formerA = await callRoute<{ data: { id: string }[] }>(listTeachers, { url: "/api/teachers?staff=former", token: headAToken });
    expect(formerA.json.data.map((t) => t.id)).toContain(teacher.teacherProfile!.id);
    const edit = await callRoute(updateTeacher, {
      method: "PATCH",
      url: `/api/teachers/${teacher.teacherProfile!.id}`,
      token: headAToken,
      params: { id: teacher.teacherProfile!.id },
      body: { firstName: "Changed" },
    });
    expect(edit.status).toBe(403);

    // At B: current staff.
    const currentB = await callRoute<{ data: { id: string }[] }>(listTeachers, { url: "/api/teachers", token: headBToken });
    expect(currentB.json.data.map((t) => t.id)).toContain(teacher.teacherProfile!.id);

    const audit = await systemPrisma.auditLog.findMany({ where: { targetId: teacher.user.id }, orderBy: { at: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["TRANSFER_REQUESTED", "TRANSFER_CONFIRMED"]);
  });

  it("the old school can turn it down, the new school can withdraw it, and someone can come back to a former school", async () => {
    const headA = await createTestUser({ role: Role.HEAD_TEACHER });
    const headAToken = await loginAs(headA.user.email, headA.password);
    const teacher = await createTestUser({ role: Role.TEACHER });
    const headB = await inSchool(schoolB.id, () => createTestUser({ role: Role.HEAD_TEACHER, schoolId: schoolB.id }));
    const headBToken = await loginAs(headB.user.email, headB.password);
    const ask = () =>
      callRoute<{ data: { status: string } }>(requestTransfer, {
        method: "POST",
        url: "/api/transfers",
        token: headBToken,
        body: { userId: teacher.user.id, role: "TEACHER" },
      });

    expect((await ask()).status).toBe(201);
    expect((await ask()).status).toBe(409); // already waiting
    let [t] = (await callRoute<{ data: Transfer[] }>(listTransfers, { url: "/api/transfers", token: headAToken })).json.data;
    expect((await callRoute(declineTransfer, { method: "POST", url: `/api/transfers/${t.id}/decline`, token: headAToken, params: { id: t.id } })).status).toBe(200);
    expect(await systemPrisma.schoolMembership.count({ where: { userId: teacher.user.id, schoolId: schoolB.id } })).toBe(0);

    expect((await ask()).status).toBe(201);
    [t] = (await callRoute<{ data: Transfer[] }>(listTransfers, { url: "/api/transfers", token: headBToken })).json.data;
    expect((await callRoute(cancelTransfer, { method: "DELETE", url: `/api/transfers/${t.id}`, token: headBToken, params: { id: t.id } })).status).toBe(200);
    expect(await systemPrisma.schoolMembership.count({ where: { userId: teacher.user.id, status: "PENDING" } })).toBe(0);

    // Move to B, then A asks for them back: the old (ENDED) membership is reopened, not duplicated.
    expect((await ask()).status).toBe(201);
    [t] = (await callRoute<{ data: Transfer[] }>(listTransfers, { url: "/api/transfers", token: headAToken })).json.data;
    expect((await callRoute(confirmTransfer, { method: "POST", url: `/api/transfers/${t.id}/confirm`, token: headAToken, params: { id: t.id } })).status).toBe(200);
    const back = await callRoute<{ data: { status: string } }>(requestTransfer, {
      method: "POST",
      url: "/api/transfers",
      token: headAToken,
      body: { userId: teacher.user.id, role: "TEACHER" },
    });
    expect(back.status).toBe(201);
    const atA = await systemPrisma.schoolMembership.findUniqueOrThrow({ where: { userId_schoolId: { userId: teacher.user.id, schoolId: TEST_SCHOOL_ID } } });
    expect(atA.status).toBe("PENDING");
  });

  it("the DEBS over the old school can confirm; another district's DEBS can't; teachers can't ask", async () => {
    await createTestUser({ role: Role.HEAD_TEACHER });
    const teacher = await createTestUser({ role: Role.TEACHER });
    const teacherToken = await loginAs(teacher.user.email, teacher.password);
    const headB = await inSchool(schoolB.id, () => createTestUser({ role: Role.HEAD_TEACHER, schoolId: schoolB.id }));
    const headBToken = await loginAs(headB.user.email, headB.password);

    expect(
      (await callRoute(requestTransfer, { method: "POST", url: "/api/transfers", token: teacherToken, body: { userId: headB.user.id, role: "TEACHER" } })).status
    ).toBe(403);
    await callRoute(requestTransfer, { method: "POST", url: "/api/transfers", token: headBToken, body: { userId: teacher.user.id, role: "TEACHER" } });

    const debs = await createTestOfficeUser(district.id);
    const debsToken = await loginAs(debs.user.email, debs.password);
    const elsewhere = await createTestOfficeUser((await createTestDistrict("office-prov-copperbelt", "Ndola")).id);
    const elsewhereToken = await loginAs(elsewhere.user.email, elsewhere.password);

    const list = await callRoute<{ data: Transfer[] }>(officeTransfers, { url: "/api/office/transfers", token: debsToken });
    expect(list.json.data).toHaveLength(1);
    const id = list.json.data[0].id;
    expect((await callRoute<{ data: Transfer[] }>(officeTransfers, { url: "/api/office/transfers", token: elsewhereToken })).json.data).toHaveLength(0);
    expect((await callRoute(officeConfirm, { method: "POST", url: `/api/office/transfers/${id}/confirm`, token: elsewhereToken, params: { id } })).status).toBe(404);

    expect((await callRoute(officeConfirm, { method: "POST", url: `/api/office/transfers/${id}/confirm`, token: debsToken, params: { id } })).status).toBe(200);
    const login = await authService.login({ email: teacher.user.email, password: teacher.password });
    expect(login.user?.school?.id).toBe(schoolB.id);
  });

  it("someone with no current school joins straight away", async () => {
    const headA = await createTestUser({ role: Role.HEAD_TEACHER });
    const headAToken = await loginAs(headA.user.email, headA.password);
    const returning = await createTestUser({ role: Role.TEACHER, schoolId: null, email: "returning@example.com" });

    const joined = await callRoute<{ data: { status: string } }>(requestTransfer, {
      method: "POST",
      url: "/api/transfers",
      token: headAToken,
      body: { userId: returning.user.id, role: "TEACHER" },
    });
    expect(joined.json.data.status).toBe("ACTIVE");
    const login = await authService.login({ email: "returning@example.com", password: returning.password });
    expect(login.user?.school?.id).toBe(TEST_SCHOOL_ID);
  });

  it("a DEBS registers a new school with an existing person as head: a transfer the DEBS can confirm", async () => {
    await createTestUser({ role: Role.HEAD_TEACHER });
    const deputy = await createTestUser({ role: Role.DEPUTY_HEAD, email: "promoted.deputy@example.com" });
    const debs = await createTestOfficeUser(district.id);
    const debsToken = await loginAs(debs.user.email, debs.password);

    const person = await callRoute<{ data: { userId: string; currentSchool: { name: string } } }>(officePeople, {
      url: "/api/office/people?q=promoted.deputy@example.com",
      token: debsToken,
    });
    expect(person.json.data.currentSchool.name).toBe("Test School A");

    const created = await callRoute<{ data: { school: { id: string }; headStatus: string; temporaryPassword: null } }>(createSchool, {
      method: "POST",
      url: "/api/office/schools",
      token: debsToken,
      body: { name: "Chongwe New Secondary", category: "PUBLIC", head: { existingUserId: deputy.user.id } },
    });
    expect(created.status).toBe(201);
    expect(created.json.data).toMatchObject({ headStatus: "PENDING", temporaryPassword: null });

    const [t] = (await callRoute<{ data: Transfer[] }>(officeTransfers, { url: "/api/office/transfers", token: debsToken })).json.data;
    expect(t.toSchool.name).toBe("Chongwe New Secondary");
    expect((await callRoute(officeConfirm, { method: "POST", url: `/api/office/transfers/${t.id}/confirm`, token: debsToken, params: { id: t.id } })).status).toBe(200);

    const login = await authService.login({ email: "promoted.deputy@example.com", password: deputy.password });
    expect(login.user).toMatchObject({ role: "HEAD_TEACHER", school: { id: created.json.data.school.id, setupComplete: false } });
  });
});
