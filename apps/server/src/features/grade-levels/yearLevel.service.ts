import { z } from "zod";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import {
  YEAR_LEVEL_TEMPLATES,
  getYearLevelTemplate,
  schoolLevelForStage,
  type YearStage,
} from "@school/shared/curriculum/year-levels";
import type { GradeLevel } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";

export interface YearLevelContext {
  userId: string;
  role: string;
}

const STAGES = [
  "ECE",
  "LOWER_PRIMARY",
  "UPPER_PRIMARY",
  "JUNIOR_SECONDARY",
  "O_LEVEL",
  "A_LEVEL",
  "LSEND",
  "YALE",
] as const;
const CURRICULA = ["LEGACY_2013", "CBC_2023"] as const;
const EXAMS = ["NONE", "PSLE_LEGACY", "PSLE_2023", "JSSL", "SC_O_LEGACY", "SC_O_2023", "SC_A"] as const;

const yearLevelFields = {
  name: z.string().trim().min(1, "Give the year level a name").max(40),
  shortName: z.string().trim().max(8).nullable(),
  stage: z.enum(STAGES),
  curriculum: z.enum(CURRICULA),
  exam: z.enum(EXAMS),
  nextGradeId: z.string().min(1).nullable(),
};

export const yearLevelInputSchema = z.object({
  name: yearLevelFields.name,
  shortName: yearLevelFields.shortName.optional(),
  stage: yearLevelFields.stage,
  curriculum: yearLevelFields.curriculum.default("CBC_2023"),
  exam: yearLevelFields.exam.default("NONE"),
  nextGradeId: yearLevelFields.nextGradeId.optional(),
});
export type YearLevelInput = z.infer<typeof yearLevelInputSchema>;
// No defaults here: a field left out of an update stays as it is.
export const yearLevelUpdateSchema = z.object({
  name: yearLevelFields.name.optional(),
  shortName: yearLevelFields.shortName.optional(),
  stage: yearLevelFields.stage.optional(),
  curriculum: yearLevelFields.curriculum.optional(),
  exam: yearLevelFields.exam.optional(),
  nextGradeId: yearLevelFields.nextGradeId.optional(),
});

/**
 * A school's year levels (Phase 3b). The head or deputy sets them up — usually from a template
 * ("Primary Grades 1–6", "Secondary Forms 1–6", "Changeover 2026") — and adjusts from there.
 * Every school has its own list, so renaming "Grade 8" to "Form 1" at one school changes
 * nothing anywhere else.
 */
export class YearLevelService {
  private assertLeader(context: YearLevelContext) {
    if (!isSchoolLeader(context.role)) {
      throw new UnauthorizedError("Only the head teacher or deputy can change year levels");
    }
  }

  async list() {
    return prisma.grade.findMany({
      orderBy: { sequence: "asc" },
      include: {
        nextGrade: { select: { id: true, name: true } },
        _count: { select: { classes: true } },
      },
    });
  }

  listTemplates() {
    return YEAR_LEVEL_TEMPLATES.map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      levels: t.levels.map((l) => l.name),
    }));
  }

  private async assertNextInSchool(nextGradeId: string | null | undefined, selfId?: string) {
    if (!nextGradeId) return;
    if (selfId && nextGradeId === selfId) {
      throw new ValidationError("A year level can't lead to itself");
    }
    const next = await prisma.grade.findUnique({ where: { id: nextGradeId }, select: { id: true } });
    if (!next) throw new NotFoundError("The next year level wasn't found");
  }

  async create(input: YearLevelInput, context: YearLevelContext) {
    this.assertLeader(context);
    await this.assertNextInSchool(input.nextGradeId);
    if (await prisma.grade.findFirst({ where: { name: input.name } })) {
      throw new ConflictError(`There's already a year level called "${input.name}"`);
    }
    const last = await prisma.grade.findFirst({ orderBy: { sequence: "desc" }, select: { sequence: true } });
    return prisma.grade.create({
      data: {
        name: input.name,
        shortName: input.shortName || null,
        stage: input.stage,
        curriculum: input.curriculum,
        exam: input.exam,
        schoolLevel: schoolLevelForStage(input.stage),
        sequence: (last?.sequence ?? 0) + 1,
        ...(input.nextGradeId ? { nextGrade: { connect: { id: input.nextGradeId } } } : {}),
      },
    });
  }

  async update(id: string, input: z.infer<typeof yearLevelUpdateSchema>, context: YearLevelContext) {
    this.assertLeader(context);
    const existing = await prisma.grade.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Year level not found");
    await this.assertNextInSchool(input.nextGradeId, id);
    if (input.name && input.name !== existing.name) {
      if (await prisma.grade.findFirst({ where: { name: input.name, id: { not: id } } })) {
        throw new ConflictError(`There's already a year level called "${input.name}"`);
      }
    }
    const stage = (input.stage ?? existing.stage) as YearStage;
    return prisma.grade.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.shortName !== undefined && { shortName: input.shortName || null }),
        ...(input.stage !== undefined && { stage: input.stage, schoolLevel: schoolLevelForStage(stage) }),
        ...(input.curriculum !== undefined && { curriculum: input.curriculum }),
        ...(input.exam !== undefined && { exam: input.exam }),
        ...(input.nextGradeId !== undefined &&
          (input.nextGradeId
            ? { nextGrade: { connect: { id: input.nextGradeId } } }
            : { nextGrade: { disconnect: true } })),
      },
    });
  }

  async remove(id: string, context: YearLevelContext) {
    this.assertLeader(context);
    const existing = await prisma.grade.findUnique({
      where: { id },
      include: { _count: { select: { classes: true } } },
    });
    if (!existing) throw new NotFoundError("Year level not found");
    if (existing._count.classes > 0) {
      throw new ConflictError(
        `${existing.name} still has ${existing._count.classes} class(es) — move or delete them first`
      );
    }
    await prisma.$transaction([
      prisma.grade.updateMany({ where: { nextGradeId: id }, data: { nextGradeId: null } }),
      prisma.grade.delete({ where: { id } }),
    ]);
  }

  /** Put the year levels in this order (ids, first to last). */
  async reorder(ids: string[], context: YearLevelContext) {
    this.assertLeader(context);
    const all = await prisma.grade.findMany({ select: { id: true } });
    const known = new Set(all.map((g) => g.id));
    if (ids.length !== all.length || ids.some((id) => !known.has(id)) || new Set(ids).size !== ids.length) {
      throw new ValidationError("Send every year level exactly once");
    }
    // Two steps so the "one position per level" rule never sees a duplicate midway.
    await prisma.$transaction([
      ...ids.map((id, i) => prisma.grade.update({ where: { id }, data: { sequence: -(i + 1) } })),
      ...ids.map((id, i) => prisma.grade.update({ where: { id }, data: { sequence: i + 1 } })),
    ]);
    return this.list();
  }

  /**
   * Adds a template's year levels. Levels the school already has (same name) are left as they
   * are; new ones go after the existing ones, in the template's order, and are linked to the
   * level learners normally move to.
   */
  async applyTemplate(key: string, context: YearLevelContext | null) {
    if (context) this.assertLeader(context);
    const template = getYearLevelTemplate(key);
    if (!template) throw new ValidationError("Unknown template");

    const existing = await prisma.grade.findMany({ select: { id: true, name: true, sequence: true, nextGradeId: true } });
    const byName = new Map(existing.map((g) => [g.name.toLowerCase(), g]));
    let sequence = existing.reduce((m, g) => Math.max(m, g.sequence), 0);
    const created: string[] = [];

    for (const item of template.levels) {
      if (byName.has(item.name.toLowerCase())) continue;
      sequence += 1;
      const row = await prisma.grade.create({
        data: {
          name: item.name,
          shortName: item.shortName,
          stage: item.stage,
          curriculum: item.curriculum,
          exam: item.exam,
          level: item.level ? (item.level as GradeLevel) : null,
          schoolLevel: schoolLevelForStage(item.stage),
          sequence,
        },
        select: { id: true, name: true, sequence: true, nextGradeId: true },
      });
      byName.set(item.name.toLowerCase(), row);
      created.push(row.name);
    }

    // Link progression where it isn't set yet (the school's own links are kept).
    for (const item of template.levels) {
      if (!item.next) continue;
      const from = byName.get(item.name.toLowerCase());
      const to = byName.get(item.next.toLowerCase());
      if (from && to && !from.nextGradeId) {
        await prisma.grade.update({ where: { id: from.id }, data: { nextGradeId: to.id } });
        from.nextGradeId = to.id;
      }
    }

    return { created, levels: await this.list() };
  }
}

export const yearLevelService = new YearLevelService();
