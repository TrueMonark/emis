import * as Crypto from "expo-crypto";
import { enqueue } from "./db";
import { notifyDataChanged } from "./events";
import { todayIso } from "./dates";
import { mustGoOnline, offlineDays } from "./sync";
import {
  attendanceKey,
  classLabel,
  logKey,
  markKey,
  noSchoolReason,
  registerMarks,
  scoresOf,
  specialKey,
  subjectName,
  termFor,
  type AttendanceStatus,
  type Assessment,
  type Slot,
  type SpecialClass,
} from "./queries";

/**
 * Saving on the phone: every save becomes one sync operation in the outbox (sent at once when
 * there's signal, later otherwise), and shows on screen straight away. The server checks
 * everything again when it arrives; these checks only stop mistakes early.
 */

export class SaveError extends Error {}

/** Every save: refuse once the phone has been offline longer than the school allows. */
function checkOfflineLimit() {
  if (mustGoOnline()) throw new SaveError(`This phone hasn't synced for more than ${offlineDays()} days. Connect to the internet and sync once, then carry on.`);
}

const newOp = (type: string, payload: unknown, label: string) => ({
  opId: Crypto.randomUUID(),
  type,
  payload,
  madeAt: new Date().toISOString(),
  label,
});

/** The daily register (slot null) or a period register. */
export function saveRegister(input: {
  classId: string;
  day: string;
  slot: Slot | null;
  marks: { studentId: string; status: AttendanceStatus; remarks?: string | null }[];
}) {
  checkOfflineLimit();
  const { classId, day, slot } = input;
  const why = noSchoolReason(day);
  if (why) throw new SaveError(`There's no register on ${why}. Use a special class for lessons that day.`);
  if (day > todayIso()) throw new SaveError("You can't take a register for a day that hasn't come yet");
  const term = termFor(day);
  if (!term) throw new SaveError("That day isn't in a term");
  if (input.marks.length === 0) throw new SaveError("Mark at least one learner");

  const current = registerMarks(classId, day, slot?.id ?? null);
  const changed = input.marks.filter((m) => {
    const c = current.get(m.studentId);
    return !c || c.status !== m.status || (c.remarks ?? "") !== (m.remarks ?? "");
  });
  if (changed.length === 0) return 0;

  const label = slot
    ? `${subjectName(slot.subjectId)} register, ${classLabel(classId)}, ${day}`
    : `Daily register, ${classLabel(classId)}, ${day}`;
  enqueue(
    newOp(
      "attendance.mark",
      {
        classId,
        termId: term.id,
        date: day,
        timetableSlotId: slot?.id ?? null,
        records: changed.map((m) => ({
          studentId: m.studentId,
          status: m.status,
          remarks: m.remarks || null,
          baseVersion: current.get(m.studentId)?.version ?? null,
        })),
      },
      label
    ),
    changed.map((m) => ({ key: attendanceKey(classId, day, slot?.id ?? null, m.studentId), value: { status: m.status, remarks: m.remarks ?? null } }))
  );
  notifyDataChanged();
  return changed.length;
}

export function saveMarks(assessment: Assessment, entries: { studentId: string; marks: number | null; absent: boolean }[]) {
  checkOfflineLimit();
  if (assessment.status !== "PUBLISHED") throw new SaveError("Marks can only be entered while the assessment is published");
  const current = scoresOf(assessment.id);
  const rows = entries
    .filter((e) => e.absent || e.marks !== null)
    .map((e) => ({ studentId: e.studentId, marksObtained: e.absent ? 0 : e.marks!, isAbsent: e.absent }));
  for (const r of rows) {
    if (!r.isAbsent && (r.marksObtained < 0 || r.marksObtained > assessment.totalMarks)) {
      throw new SaveError(`Marks must be between 0 and ${assessment.totalMarks}`);
    }
  }
  const changed = rows.filter((r) => {
    const c = current.get(r.studentId);
    return !c || c.marksObtained !== r.marksObtained || c.isAbsent !== r.isAbsent;
  });
  if (changed.length === 0) return 0;
  enqueue(
    newOp(
      "marks.enter",
      {
        assessmentId: assessment.id,
        results: changed.map((r) => ({
          ...r,
          baseVersion: current.get(r.studentId)?.version ?? null,
        })),
      },
      `Marks: ${assessment.title}, ${classLabel(assessment.classId)}`
    ),
    changed.map((r) => ({ key: markKey(assessment.id, r.studentId), value: { marksObtained: r.marksObtained, isAbsent: r.isAbsent } }))
  );
  notifyDataChanged();
  return changed.length;
}

export function saveLessonLog(slot: Slot, day: string, topic: string, subtopics: string) {
  checkOfflineLimit();
  if (topic.trim().length < 2) throw new SaveError("Write the topic taught");
  if (day > todayIso()) throw new SaveError("You can't log a lesson that hasn't happened yet");
  enqueue(
    newOp(
      "lessonLog.save",
      { timetableSlotId: slot.id, date: day, topic: topic.trim(), subtopics: subtopics.trim() || null },
      `Lesson log: ${subjectName(slot.subjectId)}, ${classLabel(slot.classId)}, ${day}`
    ),
    [{ key: logKey(slot.id, day), value: { topic: topic.trim(), subtopics: subtopics.trim() || null } }]
  );
  notifyDataChanged();
}

export function saveSpecialRegister(sc: SpecialClass, marks: { studentId: string; status: AttendanceStatus }[]) {
  checkOfflineLimit();
  if (sc.status !== "APPROVED") throw new SaveError("This special class hasn't been approved yet");
  if (sc.date.slice(0, 10) > todayIso()) throw new SaveError("The register opens on the day of the class");
  if (marks.length === 0) throw new SaveError("Mark at least one learner");
  enqueue(
    newOp("specialClass.register", { specialClassId: sc.id, records: marks }, `Special class register: ${sc.topic}, ${classLabel(sc.classId)}`),
    marks.map((m) => ({ key: specialKey(sc.id, m.studentId), value: { status: m.status } }))
  );
  notifyDataChanged();
}
