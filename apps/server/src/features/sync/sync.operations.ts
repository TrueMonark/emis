import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { attendanceRecordService } from "@/features/attendance/attendanceRecord.service";
import { assessmentService } from "@/features/assessments/assessment.service";
import { lessonLogService } from "@/features/lesson-logs/lessonLog.service";
import { specialClassService } from "@/features/special-classes/specialClass.service";
import { normalizeToUtcMidnight } from "@/lib/utils/date-utils";
import { syncOperationRepository } from "./syncOperation.repository";

/**
 * The operations a phone can send (design §7 rule 5). Each one goes through the same services as
 * the web pages, so the same permissions and rules apply (weekend rule, register covers, slot
 * ownership, closed years…). What's extra for phones is the conflict rule per kind of data
 * (rule 6), because an offline change can arrive hours after it was made.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);

const attendanceMark = z.object({
  classId: z.string().min(1),
  termId: z.string().min(1),
  date: z.string().regex(DAY),
  /** null/absent = the daily register */
  timetableSlotId: z.string().min(1).nullable().optional(),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: STATUS,
        remarks: z.string().max(300).nullable().optional(),
        /** The version of the server's record the phone changed (absent for a new mark) */
        baseVersion: z.number().int().positive().nullable().optional(),
      })
    )
    .min(1)
    .max(200),
});

const specialClassRegister = z.object({
  specialClassId: z.string().min(1),
  records: z
    .array(z.object({ studentId: z.string().min(1), status: STATUS, remarks: z.string().max(300).nullable().optional() }))
    .min(1)
    .max(200),
});

const marksEnter = z.object({
  assessmentId: z.string().min(1),
  results: z
    .array(
      z.object({
        studentId: z.string().min(1),
        marksObtained: z.number().min(0),
        isAbsent: z.boolean().optional(),
        remarks: z.string().max(300).nullable().optional(),
      })
    )
    .min(1)
    .max(200),
});

const lessonLogSave = z.object({
  timetableSlotId: z.string().min(1),
  date: z.string().regex(DAY),
  topic: z.string().trim().min(1).max(300),
  subtopics: z.string().max(1000).nullable().optional(),
});

export const OPERATION_TYPES = ["attendance.mark", "specialClass.register", "marks.enter", "lessonLog.save"] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

export interface OperationContext {
  userId: string;
  role: Role;
  teacherProfileId: string;
  /** When the change was made on the phone (never later than now) */
  madeAt: Date;
}

/** Thrown for an operation the server won't apply: the message goes back to the phone. */
export class OperationRejected extends Error {}

type Result = Prisma.InputJsonObject;

export async function runOperation(type: OperationType, payload: unknown, ctx: OperationContext): Promise<Result> {
  switch (type) {
    case "attendance.mark":
      return markAttendance(parse(attendanceMark, payload), ctx);
    case "specialClass.register": {
      const p = parse(specialClassRegister, payload);
      const r = await specialClassService.saveRegister(p.specialClassId, { records: p.records }, ctx);
      return { saved: r.saved };
    }
    case "marks.enter":
      return enterMarks(parse(marksEnter, payload), ctx);
    case "lessonLog.save": {
      const p = parse(lessonLogSave, payload);
      const log = await lessonLogService.logLesson(
        { timetableSlotId: p.timetableSlotId, date: normalizeToUtcMidnight(p.date), topic: p.topic, subtopics: p.subtopics ?? undefined },
        ctx
      );
      return { lessonLogId: log.id };
    }
  }
}

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const r = schema.safeParse(payload);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new OperationRejected(`Invalid data${issue ? ` (${issue.path.join(".")}: ${issue.message})` : ""}`);
  }
  return r.data;
}

/**
 * Attendance: one mark per learner per register; the later change wins. A mark the server has
 * that was changed after the phone made its change (someone corrected it meanwhile) is kept, and
 * reported back as a conflict with the server's mark. Registers the service refuses (weekend,
 * not your class, closed year, future date…) reject the whole operation.
 */
async function markAttendance(p: z.infer<typeof attendanceMark>, ctx: OperationContext): Promise<Result> {
  const date = normalizeToUtcMidnight(p.date);
  const slotId = p.timetableSlotId ?? null;
  const current = await syncOperationRepository.findAttendance(p.classId, date, slotId, p.records.map((r) => r.studentId));
  const byStudent = new Map(current.map((c) => [c.studentId, c]));

  const conflicts: { studentId: string; serverStatus: string; serverVersion: number; reason: string }[] = [];
  const apply = p.records.filter((r) => {
    const server = byStudent.get(r.studentId);
    if (!server) return true;
    const changedSinceBase = r.baseVersion == null || server.version > r.baseVersion;
    if (changedSinceBase && server.updatedAt > ctx.madeAt) {
      conflicts.push({
        studentId: r.studentId,
        serverStatus: server.status,
        serverVersion: server.version,
        reason: "Changed on the server after your change was made; the newer mark was kept",
      });
      return false;
    }
    return true;
  });

  let applied = 0;
  let failed: { studentId: string; error: string }[] = [];
  if (apply.length > 0) {
    const r = await attendanceRecordService.bulkMarkAttendance(
      {
        classId: p.classId,
        termId: p.termId,
        date,
        timetableSlotId: slotId,
        records: apply.map((a) => ({ studentId: a.studentId, status: a.status, remarks: a.remarks ?? undefined })),
      },
      ctx
    );
    applied = r.successful;
    failed = r.failed;
  }
  if (applied === 0 && conflicts.length === 0 && failed.length > 0) throw new OperationRejected(failed[0].error);
  return { applied, conflicts, failed };
}

/**
 * Marks: rejected once the assessment is completed or its entry window has closed; otherwise
 * entered through the same service as the web (the later entry wins).
 */
async function enterMarks(p: z.infer<typeof marksEnter>, ctx: OperationContext): Promise<Result> {
  const assessment = await syncOperationRepository.findAssessmentForEntry(p.assessmentId);
  if (!assessment) throw new OperationRejected("Assessment not found");
  if (assessment.status === "COMPLETED") {
    throw new OperationRejected("This assessment has been completed; marks can no longer be changed from the phone");
  }
  const window = await syncOperationRepository.findWindow(assessment.termId, assessment.examType);
  if (window && new Date() > window.closesAt) {
    throw new OperationRejected(
      `The marks entry window closed on ${window.closesAt.toLocaleString("en-GB", { timeZone: "Africa/Lusaka" })}`
    );
  }
  const r = await assessmentService.bulkEnterResults(
    p.assessmentId,
    p.results.map((x) => ({ studentId: x.studentId, marksObtained: x.marksObtained, isAbsent: x.isAbsent, remarks: x.remarks ?? undefined })),
    ctx
  );
  if (r.successful === 0 && r.failed.length > 0) throw new OperationRejected(r.failed[0].error);
  return { applied: r.successful, failed: r.failed };
}
