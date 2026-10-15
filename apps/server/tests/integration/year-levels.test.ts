import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { GET as listLevels, POST as createLevel } from "@/api/year-levels/route";
import { PATCH as updateLevel, DELETE as deleteLevel } from "@/api/year-levels/[id]/route";
import { POST as applyTemplate } from "@/api/year-levels/templates/route";
import { PUT as reorderLevels } from "@/api/year-levels/reorder/route";
import {
  gradingScaleFor,
  reportCardTypeFor,
  mergesPhysicsAndChemistry,
} from "@school/shared/curriculum/year-levels";
import { resolveECZLevel } from "@school/shared/grading/ecz-grading-system";
import prisma, { systemPrisma } from "@/lib/db/prisma";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestSchool,
  createTestClass,
  createTestGrade,
  inSchool,
  TEST_SCHOOL_ID,
} from "../helpers/db";

interface Level {
  id: string;
  name: string;
  stage: string;
  exam: string;
  sequence: number;
  nextGrade: { id: string; name: string } | null;
}

/**
 * Phase 3b: every school has its own year levels, so Grade 9 and Form 1 can run side by side
 * during the changeover, and the rules (grading scale, report card, Science merge) follow the
 * level's stage and exam rather than an old grade number.
 */
describe("year levels per school", () => {
  let headToken: string;
  let teacherToken: string;

  const list = async (token = headToken) =>
    (await callRoute<{ data: Level[] }>(listLevels, { url: "/api/year-levels", token })).json.data;

  beforeEach(async () => {
    await resetDb();
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    headToken = await loginAs(head.user.email, head.password);
    const teacher = await createTestUser({ role: Role.TEACHER });
    teacherToken = await loginAs(teacher.user.email, teacher.password);
  });

  it("the changeover template sets up Forms and Grades side by side, Grade 12 leading to Form 5", async () => {
    const res = await callRoute<{ data: { created: string[] } }>(applyTemplate, {
      method: "POST",
      url: "/api/year-levels/templates",
      token: headToken,
      body: { template: "CHANGEOVER_2026_SECONDARY" },
    });
    expect(res.status).toBe(200);
    expect(res.json.data.created).toEqual([
      "Form 1", "Form 2", "Form 3", "Form 4", "Grade 10", "Grade 11", "Grade 12", "Form 5", "Form 6",
    ]);

    const levels = await list();
    const byName = new Map(levels.map((l) => [l.name, l]));
    expect(byName.get("Grade 12")).toMatchObject({ stage: "O_LEVEL", exam: "SC_O_LEGACY" });
    expect(byName.get("Grade 12")!.nextGrade?.name).toBe("Form 5");
    expect(byName.get("Form 4")).toMatchObject({ stage: "O_LEVEL", exam: "SC_O_2023" });
    expect(byName.get("Form 6")).toMatchObject({ stage: "A_LEVEL", exam: "SC_A", nextGrade: null });
    expect(levels.map((l) => l.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    // Applying it again adds nothing.
    const again = await callRoute<{ data: { created: string[] } }>(applyTemplate, {
      method: "POST",
      url: "/api/year-levels/templates",
      token: headToken,
      body: { template: "CHANGEOVER_2026_SECONDARY" },
    });
    expect(again.json.data.created).toEqual([]);
    expect(await list()).toHaveLength(9);
  });

  it("head/deputy add, rename, reorder and remove levels; a teacher can only look", async () => {
    const denied = await callRoute(createLevel, {
      method: "POST",
      url: "/api/year-levels",
      token: teacherToken,
      body: { name: "Form 1", stage: "O_LEVEL" },
    });
    expect(denied.status).toBe(403);

    const f1 = await callRoute<{ data: { id: string } }>(createLevel, {
      method: "POST",
      url: "/api/year-levels",
      token: headToken,
      body: { name: "Form 1", shortName: "F1", stage: "O_LEVEL", curriculum: "CBC_2023" },
    });
    expect(f1.status).toBe(201);
    const g9 = await callRoute<{ data: { id: string } }>(createLevel, {
      method: "POST",
      url: "/api/year-levels",
      token: headToken,
      body: { name: "Grade 9", stage: "JUNIOR_SECONDARY", curriculum: "LEGACY_2013", exam: "JSSL" },
    });
    expect(g9.status).toBe(201);

    // Same name twice is refused.
    const dup = await callRoute(createLevel, {
      method: "POST",
      url: "/api/year-levels",
      token: headToken,
      body: { name: "Form 1", stage: "O_LEVEL" },
    });
    expect(dup.status).toBe(409);

    // Grade 9 leads to Form 1 (the changeover), then rename Form 1.
    const linked = await callRoute(updateLevel, {
      method: "PATCH",
      url: `/api/year-levels/${g9.json.data.id}`,
      token: headToken,
      params: { id: g9.json.data.id },
      body: { nextGradeId: f1.json.data.id },
    });
    expect(linked.status).toBe(200);
    const renamed = await callRoute(updateLevel, {
      method: "PATCH",
      url: `/api/year-levels/${f1.json.data.id}`,
      token: headToken,
      params: { id: f1.json.data.id },
      body: { name: "Form One" },
    });
    expect(renamed.status).toBe(200);

    const reordered = await callRoute<{ data: Level[] }>(reorderLevels, {
      method: "PUT",
      url: "/api/year-levels/reorder",
      token: headToken,
      body: { ids: [g9.json.data.id, f1.json.data.id] },
    });
    expect(reordered.status).toBe(200);
    expect(reordered.json.data.map((l) => l.name)).toEqual(["Grade 9", "Form One"]);
    expect(reordered.json.data[0].nextGrade?.name).toBe("Form One");

    // A level with classes can't be removed; an empty one can (and the link to it is cleared).
    await createTestClass(g9.json.data.id);
    const blocked = await callRoute(deleteLevel, {
      method: "DELETE",
      url: `/api/year-levels/${g9.json.data.id}`,
      token: headToken,
      params: { id: g9.json.data.id },
    });
    expect(blocked.status).toBe(409);
    const removed = await callRoute(deleteLevel, {
      method: "DELETE",
      url: `/api/year-levels/${f1.json.data.id}`,
      token: headToken,
      params: { id: f1.json.data.id },
    });
    expect(removed.status).toBe(200);
    const left = await list(teacherToken);
    expect(left.map((l) => l.name)).toEqual(["Grade 9"]);
    expect(left[0].nextGrade).toBeNull();
  });

  it("each school has its own list, and the same names can exist at both", async () => {
    await createTestGrade({ level: null, name: "Form 1", stage: "O_LEVEL", sequence: 1 });
    const schoolB = (await createTestSchool({ id: "school-test-b", name: "Test School B" })).id;
    await inSchool(schoolB, () =>
      createTestGrade({ level: null, name: "Form 1", stage: "O_LEVEL", sequence: 1 })
    );
    const headB = await createTestUser({ role: Role.HEAD_TEACHER, schoolId: schoolB });
    const tokenB = await loginAs(headB.user.email, headB.password);

    const a = await list();
    const b = await list(tokenB);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].id).not.toBe(b[0].id);

    // B can't change or remove A's level.
    const patch = await callRoute(updateLevel, {
      method: "PATCH",
      url: `/api/year-levels/${a[0].id}`,
      token: tokenB,
      params: { id: a[0].id },
      body: { name: "Hacked" },
    });
    expect(patch.status).toBe(404);
    const stillA = await systemPrisma.grade.findUniqueOrThrow({ where: { id: a[0].id } });
    expect(stillA).toMatchObject({ name: "Form 1", schoolId: TEST_SCHOOL_ID });

    // The database itself keeps them apart too.
    const seenFromA = await prisma.grade.findMany();
    expect(seenFromA.map((g) => g.id)).toEqual([a[0].id]);
  });

  it("the rules follow stage and exam: Grade 9 grades junior, Form 1 senior, only the old Grade 12 merges Science", () => {
    const grade9 = { stage: "JUNIOR_SECONDARY", exam: "JSSL", level: "GRADE_9", name: "Grade 9" };
    const form1 = { stage: "O_LEVEL", exam: "NONE", level: null, name: "Form 1" };
    const form4 = { stage: "O_LEVEL", exam: "SC_O_2023", level: null, name: "Form 4" };
    const grade12 = { stage: "O_LEVEL", exam: "SC_O_LEGACY", level: "GRADE_12", name: "Grade 12" };
    const grade5 = { stage: "UPPER_PRIMARY", exam: "NONE", level: "GRADE_5", name: "Grade 5" };
    const reception = { stage: "ECE", exam: "NONE", level: null, name: "Reception" };

    expect(gradingScaleFor(grade9)).toBe("JUNIOR");
    expect(gradingScaleFor(grade9, "F1-A")).toBe("SENIOR"); // Form-named class, as before 3b
    expect(gradingScaleFor(form1)).toBe("SENIOR");
    expect(gradingScaleFor(grade5)).toBe("PRIMARY");
    expect(gradingScaleFor(reception)).toBe("PRIMARY");

    expect(reportCardTypeFor(grade9)).toBe("JUNIOR");
    expect(reportCardTypeFor(form1)).toBe("SENIOR");

    expect(mergesPhysicsAndChemistry(grade12)).toBe(true);
    expect(mergesPhysicsAndChemistry(form4)).toBe(false);

    // The older entry point agrees once the stage is passed.
    expect(resolveECZLevel(null, "Form 1", "A", "O_LEVEL")).toBe("SENIOR");
    expect(resolveECZLevel("GRADE_9", "Grade 9", "A", "JUNIOR_SECONDARY")).toBe("JUNIOR");
  });
});
