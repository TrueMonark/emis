import type { Prisma, PowerSource, WaterSource } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/** One row of `emis_school_indicators` (counts per school; see the Phase 7 migration). */
export interface IndicatorRow {
  school_id: string;
  learners_male: number;
  learners_female: number;
  new_male: number;
  new_female: number;
  left_male: number;
  left_female: number;
  repeaters_male: number;
  repeaters_female: number;
  orphans_male: number;
  orphans_female: number;
  vulnerable_male: number;
  vulnerable_female: number;
  special_needs_male: number;
  special_needs_female: number;
  teachers: number;
  teachers_male: number;
  teachers_female: number;
  teachers_degree: number;
  teachers_diploma: number;
  teachers_certificate: number;
  classes: number;
  attendance_marks: number;
  attendance_present: number;
  register_class_days: number;
  school_days: number;
}

export interface LevelRow {
  school_id: string;
  grade_name: string;
  stage: string;
  seq: number;
  male: number;
  female: number;
}

export interface SchoolInScope {
  id: string;
  name: string;
  emisNumber: string | null;
  category: string;
  setupCompletedAt: Date | null;
  districtOfficeId: string;
  districtOffice: { id: string; name: string; parentId: string | null };
}

const schoolSelect = {
  id: true,
  name: true,
  emisNumber: true,
  category: true,
  setupCompletedAt: true,
  districtOfficeId: true,
  districtOffice: { select: { id: true, name: true, parentId: true } },
} satisfies Prisma.SchoolSelect;

/**
 * Figures across schools (Phase 7). The two SQL functions are the only cross-school reads and
 * return counts only; callers decide which schools may be asked for (indicators.service.ts).
 */
export class IndicatorsRepository {
  /** Counts per school; dates are YYYY-MM-DD. */
  indicators(schoolIds: string[], from: string, to: string, holidays: string[]) {
    if (schoolIds.length === 0) return Promise.resolve([] as IndicatorRow[]);
    return prisma.$queryRaw<IndicatorRow[]>`
      SELECT * FROM emis_school_indicators(${schoolIds}::text[], ${from}::date, ${to}::date, ${holidays}::date[])`;
  }

  /** Learners in a class this year, per school and year level. */
  enrolmentByLevel(schoolIds: string[]) {
    if (schoolIds.length === 0) return Promise.resolve([] as LevelRow[]);
    return prisma.$queryRaw<LevelRow[]>`SELECT * FROM emis_school_enrolment_by_level(${schoolIds}::text[])`;
  }

  facilities(schoolIds: string[]) {
    return prisma.schoolFacilities.findMany({ where: { schoolId: { in: schoolIds } } });
  }

  upsertFacilities(
    schoolId: string,
    data: {
      classrooms: number | null;
      desks: number | null;
      toiletsBoys: number | null;
      toiletsGirls: number | null;
      toiletsStaff: number | null;
      waterSource: WaterSource | null;
      power: PowerSource | null;
      internet: boolean | null;
      notes: string | null;
      updatedById: string;
    }
  ) {
    return prisma.schoolFacilities.upsert({ where: { schoolId }, create: { schoolId, ...data }, update: data });
  }

  /** Active schools matching `where` (the office's area), with their district. */
  findSchools(where: Prisma.SchoolWhereInput): Promise<SchoolInScope[]> {
    return prisma.school.findMany({
      where: { ...where, status: "ACTIVE" },
      select: schoolSelect,
      orderBy: { name: "asc" },
    });
  }

  findSchool(id: string) {
    return prisma.school.findUnique({ where: { id }, select: { ...schoolSelect, agency: true, status: true, eczCentreCode: true } });
  }

  findOffice(id: string) {
    return prisma.educationOffice.findUnique({ where: { id }, select: { id: true, name: true, type: true, parentId: true } });
  }

  findOffices(ids: string[]) {
    return prisma.educationOffice.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, type: true, parentId: true } });
  }

  /** The head teacher and deputy of a school (names and phone, for the office's school page). */
  findLeaders(schoolId: string) {
    return prisma.schoolMembership.findMany({
      where: { schoolId, status: "ACTIVE", role: { in: ["HEAD_TEACHER", "DEPUTY_HEAD", "ADMIN"] } },
      select: { role: true, user: { select: { displayName: true, email: true, phone: true } } },
      orderBy: { role: "asc" },
    });
  }
}

export const indicatorsRepository = new IndicatorsRepository();
