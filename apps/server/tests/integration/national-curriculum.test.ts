import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import {
  GET as listCatalogue,
  POST as addFromCatalogue,
} from "@/api/curriculum/catalogue/route";
import { GET as listPathways, PUT as setPathways } from "@/api/curriculum/pathways/route";
import { PUT as setClassPathway } from "@/api/classes/[id]/pathway/route";
import { GET as checkClassPathway } from "@/api/classes/[id]/pathway-check/route";
import { NATIONAL_SUBJECT_CATALOGUE } from "@school/shared/curriculum/catalogue";
import { NATIONAL_PATHWAYS, checkPathwaySubjects } from "@school/shared/curriculum/pathways";
import prisma from "@/lib/db/prisma";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestGrade,
  createTestClass,
} from "../helpers/db";

interface CatalogueRow {
  id: string;
  code: string;
  name: string;
  schoolSubject: { id: string; code: string } | null;
}
interface PathwayRow {
  id: string;
  code: string;
  stage: string;
  offered: boolean;
}

/**
 * Phase 3b: the national subject catalogue and pathways (2023 Curriculum Framework), loaded by
 * the migration, and how a school uses them.
 */
describe("national subject catalogue and pathways", () => {
  let headToken: string;
  let teacherToken: string;

  const catalogue = async () =>
    (await callRoute<{ data: CatalogueRow[] }>(listCatalogue, { url: "/api/curriculum/catalogue", token: headToken }))
      .json.data;
  const pathways = async () =>
    (await callRoute<{ data: PathwayRow[] }>(listPathways, { url: "/api/curriculum/pathways", token: headToken }))
      .json.data;

  beforeEach(async () => {
    await resetDb();
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    headToken = await loginAs(head.user.email, head.password);
    const teacher = await createTestUser({ role: Role.TEACHER });
    teacherToken = await loginAs(teacher.user.email, teacher.password);
  });

  it("the migration loaded the whole national list, matching the shared data", async () => {
    const rows = await catalogue();
    expect(rows.map((r) => r.code).sort()).toEqual(NATIONAL_SUBJECT_CATALOGUE.map((s) => s.code).sort());
    const p = await pathways();
    expect(p.map((r) => r.code).sort()).toEqual(NATIONAL_PATHWAYS.map((x) => x.code).sort());
    expect(p.filter((x) => x.stage === "O_LEVEL")).toHaveLength(8);
    expect(p.filter((x) => x.stage === "A_LEVEL")).toHaveLength(5);
  });

  it("the national lists are read-only for the app", async () => {
    await expect(
      prisma.catalogueSubject.create({
        data: { code: "FAKE", name: "Fake", groupName: "X", stages: ["O_LEVEL"] },
      })
    ).rejects.toThrow();
  });

  it("a school adds national subjects; an existing subject with the same code is linked, not duplicated", async () => {
    const existing = await prisma.subject.create({ data: { code: "MATH", name: "Maths" } });
    const rows = await catalogue();
    const ids = ["MATH", "ENG", "BIO"].map((code) => rows.find((r) => r.code === code)!.id);

    const denied = await callRoute(addFromCatalogue, {
      method: "POST",
      url: "/api/curriculum/catalogue",
      token: teacherToken,
      body: { catalogueSubjectIds: ids },
    });
    expect(denied.status).toBe(403);

    const res = await callRoute<{ data: { added: string[]; linked: string[]; skipped: string[] } }>(
      addFromCatalogue,
      { method: "POST", url: "/api/curriculum/catalogue", token: headToken, body: { catalogueSubjectIds: ids } }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.linked).toEqual(["Mathematics"]);
    expect(res.json.data.added.sort()).toEqual(["Biology", "English Language"]);

    const subjects = await prisma.subject.findMany({ orderBy: { code: "asc" } });
    expect(subjects.map((s) => s.code)).toEqual(["BIO", "ENG", "MATH"]);
    expect(subjects.find((s) => s.id === existing.id)!.catalogueSubjectId).toBe(ids[0]);

    // Adding again does nothing new.
    const again = await callRoute<{ data: { added: string[]; skipped: string[] } }>(addFromCatalogue, {
      method: "POST",
      url: "/api/curriculum/catalogue",
      token: headToken,
      body: { catalogueSubjectIds: ids },
    });
    expect(again.json.data.added).toEqual([]);
    expect(again.json.data.skipped).toHaveLength(3);
    expect(await prisma.subject.count()).toBe(3);
  });

  it("a class follows an offered pathway of its stage, and its subjects are checked against the rules", async () => {
    const form1 = await createTestGrade({ level: null, name: "Form 1", stage: "O_LEVEL", sequence: 1 });
    const cls = await createTestClass(form1.id);
    const all = await pathways();
    const natsci = all.find((p) => p.code === "OL_NATSCI")!;
    const alStem = all.find((p) => p.code === "AL_STEM")!;

    // Not offered yet → refused.
    const notOffered = await callRoute(setClassPathway, {
      method: "PUT",
      url: `/api/classes/${cls.id}/pathway`,
      token: headToken,
      params: { id: cls.id },
      body: { pathwayId: natsci.id },
    });
    expect(notOffered.status).toBe(400);

    const offered = await callRoute<{ data: PathwayRow[] }>(setPathways, {
      method: "PUT",
      url: "/api/curriculum/pathways",
      token: headToken,
      body: { pathwayIds: [natsci.id, alStem.id] },
    });
    expect(offered.json.data.filter((p) => p.offered).map((p) => p.code).sort()).toEqual(["AL_STEM", "OL_NATSCI"]);

    // An A-level pathway doesn't fit a Form 1 class.
    const wrongStage = await callRoute(setClassPathway, {
      method: "PUT",
      url: `/api/classes/${cls.id}/pathway`,
      token: headToken,
      params: { id: cls.id },
      body: { pathwayId: alStem.id },
    });
    expect(wrongStage.status).toBe(400);

    const set = await callRoute(setClassPathway, {
      method: "PUT",
      url: `/api/classes/${cls.id}/pathway`,
      token: headToken,
      params: { id: cls.id },
      body: { pathwayId: natsci.id },
    });
    expect(set.status).toBe(200);

    // Give the class English, Maths, Civic, Biology, Chemistry, ICT — Physics is missing.
    const rows = await catalogue();
    for (const code of ["ENG", "MATH", "CIVIC", "BIO", "CHEM", "ICT"]) {
      const entry = rows.find((r) => r.code === code)!;
      const subject = await prisma.subject.create({
        data: { code, name: entry.name, catalogueSubjectId: entry.id },
      });
      await prisma.classSubject.create({ data: { classId: cls.id, subjectId: subject.id, periodsPerWeek: 5 } });
    }
    const check = await callRoute<{ data: { warnings: string[] } }>(checkClassPathway, {
      url: `/api/classes/${cls.id}/pathway-check`,
      token: teacherToken,
      params: { id: cls.id },
    });
    expect(check.status).toBe(200);
    expect(check.json.data.warnings).toEqual(["Missing compulsory: Physics"]);
  });

  it("pathway rules: ICT unless Computer Science, choices and the subject limit", () => {
    const tech = NATIONAL_PATHWAYS.find((p) => p.code === "OL_TECH")!.rules;
    expect(checkPathwaySubjects(tech, ["ENG", "MATH", "CIVIC", "PHY", "CHEM", "CS"]).warnings).toEqual([]);
    expect(checkPathwaySubjects(tech, ["ENG", "MATH", "CIVIC", "PHY", "CHEM", "ICT"]).warnings).toEqual([
      "Needs Computer Science or Design and Technology",
    ]);
    expect(checkPathwaySubjects(tech, ["ENG", "MATH", "CIVIC", "PHY", "CHEM", "DT"]).warnings).toEqual([
      "ICT is compulsory unless CS is taken",
    ]);
    const natsci = NATIONAL_PATHWAYS.find((p) => p.code === "OL_NATSCI")!.rules;
    expect(
      checkPathwaySubjects(natsci, ["ENG", "MATH", "CIVIC", "ICT", "BIO", "CHEM", "PHY", "GEO"]).warnings
    ).toEqual(["8 subjects — at most 7 expected"]);
    const heh = NATIONAL_PATHWAYS.find((p) => p.code === "OL_HEH")!.rules;
    // Travel and Tourism learners don't need Chemistry; Home Economics allows 8 subjects.
    expect(
      checkPathwaySubjects(heh, ["ENG", "MATH", "CIVIC", "ICT", "BIO", "TT", "FRE", "GEO"]).warnings
    ).toEqual([]);
  });
});
