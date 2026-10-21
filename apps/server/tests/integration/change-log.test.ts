import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import prisma, { systemPrisma } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant";
import { changeLogRepository, decodeCursor, encodeCursor } from "@/features/sync/changeLog.repository";
import { teacherScopeService } from "@/features/sync/teacherScope.service";
import { syncService } from "@/features/sync/sync.service";
import {
  resetDb,
  createTestUser,
  createTestSchool,
  createTestAcademicYear,
  createTestTerm,
  createTestGrade,
  createTestClass,
  createTestStudent,
  createTestSubject,
  createTestAssessment,
  enrollTestStudent,
  assignClassTeacher,
  assignSubjectTeacher,
  inSchool,
  TEST_SCHOOL_ID,
} from "../helpers/db";

/**
 * Phase 3c: offline-ready data. Every change to a syncable table gets a version bump and a
 * change-log line from database triggers, deletes leave a tombstone in the log, the sync cursor
 * never skips a late-committing transaction, and a teacher's scope holds only their own data.
 */
describe("change log, versions and teacher scope", () => {
  beforeEach(async () => {
    await resetDb();
  });

  const log = () =>
    systemPrisma.changeLog.findMany({ orderBy: { seq: "asc" } });

  it("records inserts, updates and deletes, with the user, and raises the version on each real change", async () => {
    const { user } = await createTestUser({ role: Role.HEAD_TEACHER });
    await systemPrisma.changeLog.deleteMany({}); // ignore the user's own setup rows

    const subject = await runWithTenant({ schoolId: TEST_SCHOOL_ID, userId: user.id }, async () => {
      const s = await prisma.subject.create({ data: { code: "GEO", name: "Geography" } });
      expect(s.version).toBe(1);
      const u1 = await prisma.subject.update({ where: { id: s.id }, data: { name: "Geography (O)" } });
      expect(u1.version).toBe(2);
      // An update that changes nothing keeps the version.
      await prisma.$executeRaw`UPDATE "subjects" SET "name" = "name" WHERE "id" = ${s.id}`;
      const same = await prisma.subject.findUniqueOrThrow({ where: { id: s.id } });
      expect(same.version).toBe(2);
      await prisma.subject.delete({ where: { id: s.id } });
      return s;
    });

    const lines = (await log()).filter((l) => l.entityId === subject.id);
    expect(lines.map((l) => l.op)).toEqual(["INSERT", "UPDATE", "UPDATE", "DELETE"]);
    for (const l of lines) {
      expect(l).toMatchObject({ entity: "subjects", schoolId: TEST_SCHOOL_ID, changedBy: user.id });
    }
    // The subject is gone; its DELETE line is the tombstone that reaches offline phones.
    expect(await systemPrisma.subject.findUnique({ where: { id: subject.id } })).toBeNull();
  });

  it("the app can read its school's log but can't write, change or delete lines", async () => {
    await createTestSubject();
    const before = await log();
    expect(before.length).toBeGreaterThan(0);

    await expect(
      prisma.$executeRaw`INSERT INTO "change_log" ("schoolId", "entity", "entityId", "op")
                         VALUES (${TEST_SCHOOL_ID}, 'subjects', 'fake', 'DELETE')`
    ).rejects.toThrow();
    await expect(prisma.$executeRaw`DELETE FROM "change_log"`).rejects.toThrow();
    await expect(prisma.$executeRaw`UPDATE "change_log" SET "op" = 'DELETE'`).rejects.toThrow();
    expect(await log()).toHaveLength(before.length);
  });

  it("each school reads only its own changes", async () => {
    const schoolB = (await createTestSchool({ id: "school-test-b", name: "Test School B" })).id;
    const mine = await createTestSubject({ name: "Mine" });
    const theirs = await inSchool(schoolB, () => createTestSubject({ name: "Theirs" }));

    const { changes } = await changeLogRepository.changesSince(null, 100);
    const seen = changes.map((c) => c.entityId);
    expect(seen).toContain(mine.id);
    expect(seen).not.toContain(theirs.id);
  });

  it("the cursor never skips a transaction that commits late, and never repeats a change", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let started!: () => void;
    const hasWritten = new Promise<void>((r) => (started = r));

    // A long transaction (e.g. generating a whole class's report cards) writes first…
    const slow = systemPrisma.$transaction(
      async (tx) => {
        await tx.subject.create({ data: { code: "SLOW", name: "Slow", schoolId: TEST_SCHOOL_ID } });
        started();
        await gate;
      },
      { timeout: 20_000 }
    );
    await hasWritten;

    // …while a quick one starts later and commits first.
    const quick = await createTestSubject({ name: "Quick" });

    const first = await changeLogRepository.changesSince(null, 100);
    // Nothing is served while an older transaction is still open, so neither is skipped later.
    expect(first.changes.map((c) => c.entityId)).not.toContain(quick.id);

    release();
    await slow;

    const second = await changeLogRepository.changesSince(first.next, 100);
    const names = await systemPrisma.subject.findMany({
      where: { id: { in: second.changes.map((c) => c.entityId) } },
      select: { name: true },
    });
    expect(names.map((n) => n.name).sort()).toEqual(["Quick", "Slow"]);

    const third = await changeLogRepository.changesSince(second.next, 100);
    expect(third.changes).toHaveLength(0);

    // Paging: a small page continues exactly where it stopped.
    await createTestSubject({ name: "A" });
    await createTestSubject({ name: "B" });
    await createTestSubject({ name: "C" });
    const p1 = await changeLogRepository.changesSince(third.next, 2);
    expect(p1.changes).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
    const p2 = await changeLogRepository.changesSince(decodeCursor(encodeCursor(p1.next)), 2);
    expect(p2.changes).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
    const ids = [...p1.changes, ...p2.changes].map((c) => c.entityId);
    expect(new Set(ids).size).toBe(3);
  });

  it("a teacher's scope holds their own classes, learners and assessments only", async () => {
    const me = await createTestUser({ role: Role.TEACHER });
    const other = await createTestUser({ role: Role.TEACHER });
    const year = await createTestAcademicYear();
    const term = await createTestTerm(year.id);
    const grade = await createTestGrade();
    const myClass = await createTestClass(grade.id, { name: "A" });
    const otherClass = await createTestClass(grade.id, { name: "B" });
    const maths = await createTestSubject({ name: "Maths" });
    const english = await createTestSubject({ name: "English" });

    await assignClassTeacher(me.teacherProfile!.id, myClass.id, year.id);
    await assignClassTeacher(other.teacherProfile!.id, otherClass.id, year.id);
    // I also teach Maths in the other class.
    await assignSubjectTeacher(me.teacherProfile!.id, maths.id, otherClass.id, year.id);

    const mine = await createTestStudent({ firstName: "Mine" });
    const theirs = await createTestStudent({ firstName: "Theirs" });
    const notEnrolled = await createTestStudent({ firstName: "Elsewhere" });
    await enrollTestStudent(mine.id, myClass.id, year.id);
    await enrollTestStudent(theirs.id, otherClass.id, year.id);

    const myClassEnglish = await createTestAssessment(english.id, myClass.id, term.id);
    const otherMaths = await createTestAssessment(maths.id, otherClass.id, term.id);
    const otherEnglish = await createTestAssessment(english.id, otherClass.id, term.id);

    const scope = await teacherScopeService.forUser(me.user.id);
    expect([...scope.ids.classes].sort()).toEqual([myClass.id, otherClass.id].sort());
    expect(scope.ids.students.has(mine.id)).toBe(true);
    expect(scope.ids.students.has(theirs.id)).toBe(true); // I teach their class Maths
    expect(scope.ids.students.has(notEnrolled.id)).toBe(false);
    // All of my own class's assessments; in the other class only my subject's.
    expect(scope.ids.assessments.has(myClassEnglish.id)).toBe(true);
    expect(scope.ids.assessments.has(otherMaths.id)).toBe(true);
    expect(scope.ids.assessments.has(otherEnglish.id)).toBe(false);

    const otherScope = await teacherScopeService.forUser(other.user.id);
    expect([...otherScope.ids.classes]).toEqual([otherClass.id]);
    expect(otherScope.ids.students.has(mine.id)).toBe(false);
  });

  it("changes for a teacher: only in-scope inserts and updates, plus tombstones for deletes", async () => {
    const me = await createTestUser({ role: Role.TEACHER });
    const year = await createTestAcademicYear();
    await createTestTerm(year.id);
    const grade = await createTestGrade();
    const myClass = await createTestClass(grade.id, { name: "A" });
    const otherClass = await createTestClass(grade.id, { name: "B" });
    await assignClassTeacher(me.teacherProfile!.id, myClass.id, year.id);

    const start = await syncService.startingCursor();

    const mine = await createTestStudent({ firstName: "Mine" });
    const stranger = await createTestStudent({ firstName: "Stranger" });
    await enrollTestStudent(mine.id, myClass.id, year.id);
    await enrollTestStudent(stranger.id, otherClass.id, year.id);
    await prisma.student.delete({ where: { id: stranger.id } });

    const { changes, cursor } = await syncService.changesForTeacher(me.user.id, start);
    const students = changes.filter((c) => c.entity === "students");
    expect(students.filter((c) => c.op === "INSERT").map((c) => c.entityId)).toEqual([mine.id]);
    // The stranger's details never reach my phone, only the fact that the id was deleted.
    expect(students.find((c) => c.entityId === stranger.id && c.op !== "DELETE")).toBeUndefined();
    expect(students.find((c) => c.entityId === stranger.id && c.op === "DELETE")).toBeDefined();

    const again = await syncService.changesForTeacher(me.user.id, cursor);
    expect(again.changes).toHaveLength(0);
  });
});
