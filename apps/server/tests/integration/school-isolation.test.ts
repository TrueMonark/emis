import { describe, it, expect, beforeEach } from "vitest";
import { Role, Gender, QualificationLevel } from "@prisma/client";
import { GET as listStudents, POST as createStudent } from "@/api/students/route";
import {
  GET as getStudent,
  PATCH as updateStudent,
  DELETE as deleteStudent,
} from "@/api/students/[id]/route";
import { GET as listSubjects, POST as createSubject } from "@/api/subjects/route";
import { GET as listTeachers, POST as createTeacher } from "@/api/teachers/route";
import { GET as getTeacher, PATCH as updateTeacher } from "@/api/teachers/[id]/route";
import { GET as listUsers } from "@/api/permissions/users/route";
import { GET as me } from "@/api/auth/me/route";
import { GET as identity } from "@/api/school/identity/route";
import { authService } from "@/features/auth/auth.service";
import prisma, { systemPrisma } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestSchool,
  createTestSubject,
  inSchool,
  TEST_SCHOOL_ID,
} from "../helpers/db";

/**
 * Phase 3a: two schools in one database never see each other's data — through the routes, and
 * at the database level (row-level security) even when a query has no school filter.
 */
describe("keeping schools apart", () => {
  let schoolB: string;
  let headA: string;
  let headB: string;
  let teacherAEmail: string;

  const studentBody = (studentNumber: string) => ({
    studentNumber,
    firstName: "Jane",
    lastName: "Banda",
    gender: Gender.FEMALE,
    dateOfBirth: "2012-01-01",
    admissionDate: "2024-01-01",
  });

  beforeEach(async () => {
    await resetDb();
    schoolB = (await createTestSchool({ id: "school-test-b", name: "Test School B" })).id;

    const a = await createTestUser({ role: Role.HEAD_TEACHER });
    headA = await loginAs(a.user.email, a.password);
    const teacherA = await createTestUser({ role: Role.TEACHER });
    teacherAEmail = teacherA.user.email;

    const b = await createTestUser({ role: Role.HEAD_TEACHER, schoolId: schoolB });
    headB = await loginAs(b.user.email, b.password);
  });

  it("a school can't list, open, change or delete another school's learner", async () => {
    const created = await callRoute<{ data: { id: string } }>(createStudent, {
      method: "POST",
      url: "/api/students",
      token: headA,
      body: studentBody("STU-2026-0001"),
    });
    expect(created.status).toBe(201);
    const id = created.json.data.id;

    const listB = await callRoute<{ data: { id: string }[] }>(listStudents, {
      url: "/api/students?mode=all",
      token: headB,
    });
    expect(listB.status).toBe(200);
    expect(listB.json.data).toHaveLength(0);

    const getB = await callRoute(getStudent, { url: `/api/students/${id}`, token: headB, params: { id } });
    expect(getB.status).toBe(404);

    const patchB = await callRoute(updateStudent, {
      method: "PATCH",
      url: `/api/students/${id}`,
      token: headB,
      params: { id },
      body: { firstName: "Changed" },
    });
    expect(patchB.status).toBe(404);

    const deleteB = await callRoute(deleteStudent, {
      method: "DELETE",
      url: `/api/students/${id}`,
      token: headB,
      params: { id },
    });
    expect(deleteB.status).toBe(404);

    // School A still has it, unchanged.
    const getA = await callRoute<{ data: { firstName: string } }>(getStudent, {
      url: `/api/students/${id}`,
      token: headA,
      params: { id },
    });
    expect(getA.status).toBe(200);
    expect(getA.json.data.firstName).toBe("Jane");
  });

  it("unique rules are per school: both schools can use the same subject code and student number", async () => {
    for (const token of [headA, headB]) {
      const subject = await callRoute(createSubject, {
        method: "POST",
        url: "/api/subjects",
        token,
        body: { name: "Mathematics", code: "MATH" },
      });
      expect(subject.status).toBe(201);
      const student = await callRoute(createStudent, {
        method: "POST",
        url: "/api/students",
        token,
        body: studentBody("STU-2026-0001"),
      });
      expect(student.status).toBe(201);
    }

    const subjectsB = await callRoute<{ data: { code: string }[] }>(listSubjects, {
      url: "/api/subjects",
      token: headB,
    });
    expect(subjectsB.json.data.map((s) => s.code)).toEqual(["MATH"]);
  });

  it("teachers and user lists only show the school's own staff; a new teacher joins the creator's school", async () => {
    const created = await callRoute<{ data: { id: string; userId: string } }>(createTeacher, {
      method: "POST",
      url: "/api/teachers",
      token: headB,
      body: {
        email: "new.teacher.b@example.com",
        staffNumber: "STAFF2026123",
        firstName: "Mutale",
        lastName: "Phiri",
        dateOfBirth: "1990-01-01",
        gender: Gender.FEMALE,
        phone: "0977111222",
        qualification: QualificationLevel.DEGREE,
        hireDate: "2024-01-01",
        primarySubjectId: (await inSchool(schoolB, () => createTestSubject())).id,
      },
    });
    expect(created.status).toBe(201);
    const membership = await systemPrisma.schoolMembership.findFirstOrThrow({
      where: { userId: created.json.data.userId },
    });
    expect(membership).toMatchObject({ schoolId: schoolB, role: Role.TEACHER, status: "ACTIVE" });

    const teachersA = await callRoute(listTeachers, { url: "/api/teachers", token: headA });
    expect(JSON.stringify(teachersA.json)).not.toContain("new.teacher.b@example.com");
    const teachersB = await callRoute(listTeachers, { url: "/api/teachers", token: headB });
    expect(JSON.stringify(teachersB.json)).toContain("new.teacher.b@example.com");
    expect(JSON.stringify(teachersB.json)).not.toContain(teacherAEmail);

    const teacherId = created.json.data.id;
    const openFromA = await callRoute(getTeacher, {
      url: `/api/teachers/${teacherId}`,
      token: headA,
      params: { id: teacherId },
    });
    expect(openFromA.status).toBe(404);
    const changeFromA = await callRoute(updateTeacher, {
      method: "PATCH",
      url: `/api/teachers/${teacherId}`,
      token: headA,
      params: { id: teacherId },
      body: { firstName: "Hacked" },
    });
    expect(changeFromA.status).toBe(404);

    const usersA = await callRoute(listUsers, { url: "/api/permissions/users", token: headA });
    expect(usersA.status).toBe(200);
    expect(JSON.stringify(usersA.json)).toContain(teacherAEmail);
    expect(JSON.stringify(usersA.json)).not.toContain("new.teacher.b@example.com");
  });

  it("the database itself refuses: raw queries see only the current school and can't write into another", async () => {
    await inSchool(schoolB, () =>
      prisma.subject.create({ data: { name: "Biology", code: "BIO" } })
    );

    const inA = await runWithTenant({ schoolId: TEST_SCHOOL_ID, userId: null }, async () => {
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM subjects`;
      return Number(rows[0].n);
    });
    expect(inA).toBe(0);

    const noSchool = await runWithTenant({ schoolId: null, userId: null }, async () => {
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM subjects`;
      return Number(rows[0].n);
    });
    expect(noSchool).toBe(0);

    // Writing a row that claims to belong to school B while working in school A is refused.
    await expect(
      runWithTenant({ schoolId: TEST_SCHOOL_ID, userId: null }, () =>
        prisma.$executeRaw`INSERT INTO subjects (id, code, name, "updatedAt", "schoolId")
                           VALUES ('sneaky', 'X', 'X', now(), ${schoolB})`
      )
    ).rejects.toThrow(/row-level security/);

    // And B's row is untouched by an unfiltered update/delete from A.
    await runWithTenant({ schoolId: TEST_SCHOOL_ID, userId: null }, async () => {
      await prisma.subject.updateMany({ data: { name: "Overwritten" } });
      await prisma.subject.deleteMany({});
    });
    const stillThere = await systemPrisma.subject.findFirstOrThrow({ where: { schoolId: schoolB } });
    expect(stillThere.name).toBe("Biology");
  });

  it("signing in needs an ACTIVE membership; a pending transfer keeps working at the current school", async () => {
    const t = await createTestUser({ role: Role.TEACHER });

    // Transfer to school B created but not yet confirmed: still works at school A.
    await systemPrisma.schoolMembership.create({
      data: { userId: t.user.id, schoolId: schoolB, role: Role.TEACHER, status: "PENDING" },
    });
    const token = await loginAs(t.user.email, t.password);
    const schoolName = async () =>
      (await callRoute<{ data: { name: string } }>(identity, { url: "/api/school/identity", token })).json.data
        .name;
    expect(await schoolName()).toBe("Test School A");

    // A second ACTIVE membership is refused by the database.
    await expect(
      systemPrisma.schoolMembership.updateMany({
        where: { userId: t.user.id, schoolId: schoolB },
        data: { status: "ACTIVE" },
      })
    ).rejects.toThrow();

    // Confirmation: the old membership ends, the new one becomes active — same account.
    await systemPrisma.$transaction([
      systemPrisma.schoolMembership.updateMany({
        where: { userId: t.user.id, schoolId: TEST_SCHOOL_ID },
        data: { status: "ENDED", endDate: new Date() },
      }),
      systemPrisma.schoolMembership.updateMany({
        where: { userId: t.user.id, schoolId: schoolB },
        data: { status: "ACTIVE" },
      }),
    ]);

    // The old token now works in school B (school comes from the live membership, not the token).
    const who = await callRoute<{ data: { id: string } }>(me, { url: "/api/auth/me", token });
    expect(who.status).toBe(200);
    expect(await schoolName()).toBe("Test School B");

    // Ending the last membership: sign-in is refused with a clear message, API calls too.
    await systemPrisma.schoolMembership.updateMany({
      where: { userId: t.user.id },
      data: { status: "ENDED" },
    });
    const login = await authService.login({ email: t.user.email, password: t.password });
    expect(login.success).toBe(false);
    expect(login.message).toMatch(/isn't linked to a school/);
    const refused = await callRoute(identity, { url: "/api/school/identity", token });
    expect(refused.status).toBe(403);
  });
});
