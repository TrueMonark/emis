import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import prisma from "@/lib/db/prisma";
import { requireSchoolId } from "@/lib/db/tenant";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { auditService } from "@/features/audit/audit.service";

export interface SetupStep {
  key: "details" | "academicYear" | "terms" | "yearLevels" | "subjects";
  done: boolean;
  /** Steps that must be done before the school can start; the others are recommended */
  required: boolean;
}

/**
 * First-time setup of a school registered by its district office (Phase 4). Until the head (or
 * deputy) finishes it, the school's pages are limited to the setup steps (withAuth). The required
 * steps are the ones other screens can't work without.
 */
export class SchoolSetupService {
  async getStatus() {
    const schoolId = requireSchoolId();
    const [school, activeYear, levels, subjects] = await Promise.all([
      prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
        select: {
          id: true,
          name: true,
          emisNumber: true,
          category: true,
          setupCompletedAt: true,
          districtOffice: { select: { name: true } },
        },
      }),
      prisma.academicYear.findFirst({
        where: { isActive: true },
        select: { id: true, year: true, _count: { select: { terms: true } } },
      }),
      prisma.grade.count(),
      prisma.subject.count({ where: { deletedAt: null } }),
    ]);
    const steps: SetupStep[] = [
      { key: "details", done: school.name.trim().length > 0, required: true },
      { key: "academicYear", done: !!activeYear, required: true },
      { key: "terms", done: (activeYear?._count.terms ?? 0) > 0, required: true },
      { key: "yearLevels", done: levels > 0, required: true },
      { key: "subjects", done: subjects > 0, required: false },
    ];
    return {
      school,
      setupComplete: !!school.setupCompletedAt,
      activeAcademicYear: activeYear ? { id: activeYear.id, year: activeYear.year } : null,
      steps,
      canFinish: steps.every((s) => !s.required || s.done),
    };
  }

  async complete(context: { userId: string; role: string }) {
    if (!isSchoolLeader(context.role)) {
      throw new UnauthorizedError("Only the head teacher or deputy can finish the school's setup");
    }
    const status = await this.getStatus();
    if (status.setupComplete) return status;
    if (!status.canFinish) {
      const missing = status.steps.filter((s) => s.required && !s.done).map((s) => STEP_LABELS[s.key]);
      throw new ValidationError(`Still to do: ${missing.join(", ")}`);
    }
    await prisma.school.update({ where: { id: status.school.id }, data: { setupCompletedAt: new Date() } });
    await auditService.record({
      action: "SETUP_COMPLETED",
      targetType: "SCHOOL",
      targetId: status.school.id,
      schoolId: status.school.id,
      summary: `${status.school.name} finished its first-time setup`,
    });
    return this.getStatus();
  }
}

const STEP_LABELS: Record<SetupStep["key"], string> = {
  details: "school details",
  academicYear: "an active academic year",
  terms: "terms for the academic year",
  yearLevels: "year levels",
  subjects: "subjects",
};

export const schoolSetupService = new SchoolSetupService();
