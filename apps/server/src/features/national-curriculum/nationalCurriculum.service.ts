import { z } from "zod";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { checkPathwaySubjects, type PathwayRules } from "@school/shared/curriculum/pathways";
import prisma from "@/lib/db/prisma";
import { requireSchoolId } from "@/lib/db/tenant";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";

export interface CurriculumContext {
  userId: string;
  role: string;
}

export const addFromCatalogueSchema = z.object({
  catalogueSubjectIds: z.array(z.string().min(1)).min(1, "Choose at least one subject"),
  departmentId: z.string().min(1).optional().nullable(),
});

export const setPathwaysSchema = z.object({
  pathwayIds: z.array(z.string().min(1)),
});

export const setClassPathwaySchema = z.object({
  pathwayId: z.string().min(1).nullable(),
});

export const linkSubjectSchema = z.object({
  catalogueSubjectId: z.string().min(1).nullable(),
});

/**
 * The national subject catalogue and pathways (2023 Curriculum Framework) as a school uses
 * them: which national subjects it offers, which pathways it offers, and whether a class's
 * subjects fit its pathway. National lists are read-only here; they change through migrations
 * or `npm run db:sync-catalogue`.
 */
export class NationalCurriculumService {
  private assertLeader(context: CurriculumContext) {
    if (!isSchoolLeader(context.role)) {
      throw new UnauthorizedError("Only the head teacher or deputy can change the school's curriculum");
    }
  }

  /** The national catalogue, each entry with the school subject that offers it (if any). */
  async listCatalogue() {
    const [catalogue, offered] = await Promise.all([
      prisma.catalogueSubject.findMany({ orderBy: [{ sortOrder: "asc" }] }),
      prisma.subject.findMany({
        where: { deletedAt: null, catalogueSubjectId: { not: null } },
        select: { id: true, name: true, code: true, catalogueSubjectId: true },
      }),
    ]);
    const bySubject = new Map(offered.map((s) => [s.catalogueSubjectId!, s]));
    return catalogue.map((c) => ({
      ...c,
      schoolSubject: bySubject.get(c.id) ?? null,
    }));
  }

  /**
   * Adds national subjects to the school's offering. A subject the school already offers is
   * skipped; an existing subject with the same code that isn't linked yet is linked instead of
   * creating a duplicate.
   */
  async addFromCatalogue(input: z.infer<typeof addFromCatalogueSchema>, context: CurriculumContext) {
    this.assertLeader(context);
    if (input.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
      if (!dept) throw new NotFoundError("Department not found");
    }
    const entries = await prisma.catalogueSubject.findMany({
      where: { id: { in: input.catalogueSubjectIds } },
    });
    if (entries.length !== new Set(input.catalogueSubjectIds).size) {
      throw new NotFoundError("Some of those subjects aren't in the national catalogue");
    }

    const added: string[] = [];
    const linked: string[] = [];
    const skipped: string[] = [];
    for (const entry of entries) {
      const alreadyOffered = await prisma.subject.findFirst({
        where: { catalogueSubjectId: entry.id, deletedAt: null },
        select: { id: true },
      });
      if (alreadyOffered) {
        skipped.push(entry.name);
        continue;
      }
      const sameCode = await prisma.subject.findFirst({
        where: { code: entry.code },
        select: { id: true, catalogueSubjectId: true, deletedAt: true },
      });
      if (sameCode && !sameCode.catalogueSubjectId && !sameCode.deletedAt) {
        await prisma.subject.update({ where: { id: sameCode.id }, data: { catalogueSubjectId: entry.id } });
        linked.push(entry.name);
        continue;
      }
      if (sameCode) {
        // The code is taken by another (or a deleted) subject: use a distinct code.
        skipped.push(`${entry.name} (code ${entry.code} is already used)`);
        continue;
      }
      await prisma.subject.create({
        data: {
          code: entry.code,
          name: entry.name,
          catalogueSubjectId: entry.id,
          ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        },
      });
      added.push(entry.name);
    }
    return { added, linked, skipped };
  }

  /** Link a school subject to a catalogue entry, or unlink it (making it a local subject). */
  async linkSubject(subjectId: string, catalogueSubjectId: string | null, context: CurriculumContext) {
    this.assertLeader(context);
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
    if (!subject) throw new NotFoundError("Subject not found");
    if (catalogueSubjectId) {
      const entry = await prisma.catalogueSubject.findUnique({ where: { id: catalogueSubjectId }, select: { id: true } });
      if (!entry) throw new NotFoundError("That subject isn't in the national catalogue");
    }
    return prisma.subject.update({ where: { id: subjectId }, data: { catalogueSubjectId } });
  }

  /** National pathways, each marked with whether this school offers it. */
  async listPathways() {
    const [pathways, offered] = await Promise.all([
      prisma.pathway.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.schoolPathway.findMany({ select: { pathwayId: true } }),
    ]);
    const offeredIds = new Set(offered.map((o) => o.pathwayId));
    return pathways.map((p) => ({ ...p, offered: offeredIds.has(p.id) }));
  }

  /** Replace the list of pathways the school offers. */
  async setOfferedPathways(pathwayIds: string[], context: CurriculumContext) {
    this.assertLeader(context);
    const unique = [...new Set(pathwayIds)];
    const found = await prisma.pathway.count({ where: { id: { in: unique } } });
    if (found !== unique.length) throw new NotFoundError("Some of those pathways don't exist");

    await prisma.$transaction([
      prisma.schoolPathway.deleteMany({ where: { pathwayId: { notIn: unique } } }),
      ...unique.map((pathwayId) =>
        prisma.schoolPathway.upsert({
          where: { schoolId_pathwayId: { schoolId: requireSchoolId(), pathwayId } },
          update: {},
          create: { pathwayId },
        })
      ),
    ]);
    return this.listPathways();
  }

  /** Tie a class to one of the school's pathways (or clear it). */
  async setClassPathway(classId: string, pathwayId: string | null, context: CurriculumContext) {
    this.assertLeader(context);
    const cls = await prisma.class.findUnique({ where: { id: classId }, include: { grade: true } });
    if (!cls) throw new NotFoundError("Class not found");
    if (pathwayId) {
      const pathway = await prisma.pathway.findUnique({ where: { id: pathwayId } });
      if (!pathway) throw new NotFoundError("Pathway not found");
      const offered = await prisma.schoolPathway.findFirst({ where: { pathwayId } });
      if (!offered) throw new ValidationError("The school doesn't offer that pathway yet — add it under Pathways first");
      if (cls.grade.stage !== pathway.stage) {
        throw new ValidationError(
          `${pathway.name} is an ${pathway.stage === "A_LEVEL" ? "A-level" : "O-level"} pathway; ${cls.grade.name} isn't at that stage`
        );
      }
    }
    return prisma.class.update({
      where: { id: classId },
      data: { pathwayId },
      include: { pathway: true },
    });
  }

  /**
   * Checks a class's subjects against its pathway's rules. Only warns: the framework has gaps,
   * so a school can always go ahead.
   */
  async checkClassPathway(classId: string) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        pathway: true,
        classSubjects: {
          include: { subject: { include: { catalogueSubject: true } } },
        },
      },
    });
    if (!cls) throw new NotFoundError("Class not found");
    if (!cls.pathway) return { pathway: null, warnings: [], localSubjects: [] as string[] };

    const codes: string[] = [];
    const localSubjects: string[] = [];
    for (const cs of cls.classSubjects) {
      if (cs.subject.catalogueSubject) codes.push(cs.subject.catalogueSubject.code);
      else localSubjects.push(cs.subject.name);
    }
    const catalogue = await prisma.catalogueSubject.findMany({ select: { code: true, name: true } });
    const names = new Map(catalogue.map((c) => [c.code, c.name]));
    const result = checkPathwaySubjects(
      cls.pathway.rules as unknown as PathwayRules,
      codes,
      (code) => names.get(code) ?? code
    );
    return {
      pathway: { id: cls.pathway.id, name: cls.pathway.name, code: cls.pathway.code },
      warnings: result.warnings,
      localSubjects,
    };
  }
}

export const nationalCurriculumService = new NationalCurriculumService();
