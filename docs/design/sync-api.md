# Phone sync API (Phase 5, built 18 October 2026)

What the teacher phone app (Phase 6) talks to. It builds on Phase 3c: versions, the change log
written by triggers, the transaction-safe cursor, and the teacher scope. Every call is a normal
signed-in request (`Authorization: Bearer <token>` from `/api/auth/login`) and runs in the
teacher's school. It's for staff with a teacher profile; others get 403.

A deactivated account (or one whose school membership ended) gets 401/403 on its next call, so a
lost phone stops syncing the moment the school deactivates the account.

## 1. Snapshot: `GET /api/sync/snapshot`

The first download, and again whenever the phone is told to resync.

```json
{
  "cursor": "1234.9223372036854775807",
  "scope": "kq3Zp1…",
  "serverTime": "2026-10-18T09:00:00.000Z",
  "settings": { "offlineDays": 14 },
  "me": { "userId": "…", "teacherProfileId": "…", "name": "Esther Banda" },
  "data": { "classes": [ … ], "students": [ … ], "attendance_records": [ … ], … }
}
```

- **`data`** has one list per table in `SYNC_ENTITIES`:
  - academic_years, terms, grades, classes, subjects, class_subjects;
  - students, student_class_enrollments, class_teacher_assignments, subject_teacher_assignments;
  - timetable_slots, assessments, student_assessment_results, attendance_records (this term),
    lesson_logs, register_covers;
  - special_classes, special_class_attendance.
- **Rows are scoped** to the teacher (`teacherScope.service.ts`). Each row has only the fields the
  app needs (`syncRecords.repository.ts`). Learners carry name, gender, learner number and status
  only.
- **Every row has `id` and `version`.**
- **`cursor`** is taken before the rows are read. Changes made during the download come again in
  the next pull, and applying them twice is harmless.
- **`scope`** is a fingerprint of what decides the teacher's scope: the year, active term, their
  classes and subjects, and their covers.
- **`settings.offlineDays`** (env `SYNC_OFFLINE_DAYS`, default 14) is how long the app may work
  offline before it must connect once.

## 2. Changes: `GET /api/sync/changes?cursor=…&scope=…&limit=500`

```json
{ "resyncRequired": false, "cursor": "…", "scope": "…", "hasMore": false,
  "changes": [
    { "entity": "attendance_records", "id": "…", "op": "UPSERT", "record": { "id": "…", "version": 3, … } },
    { "entity": "attendance_records", "id": "…", "op": "DELETE" }
  ] }
```

- **Order and ids:** changes come oldest first, one entry per row (its latest state).
- **Kinds of change:**
  - `UPSERT` carries the row with the phone's fields;
  - `DELETE` is a tombstone. It's sent for any deleted id, and the phone ignores ids it doesn't
    hold.
- **Rows newly in scope:** a learner enrolled in the class comes with the learner row.
- **More to fetch:** while `hasMore` is true, call again at once with the new cursor. Store the
  cursor only after applying the page.
- **`{ "resyncRequired": true, "reason": "…" }`** means take a new snapshot. It's sent when the
  cursor is missing or invalid, or when the scope fingerprint changed: a new class, a cover, a new
  term. In those cases rows the phone never had come into scope without changing themselves.

## 3. Push: `POST /api/sync/push`

```json
{ "deviceId": "phone-uuid",
  "operations": [
    { "opId": "uuid-1", "type": "attendance.mark", "madeAt": "2026-10-16T07:42:10+02:00",
      "payload": { "classId": "…", "termId": "…", "date": "2026-10-16", "timetableSlotId": null,
                   "records": [ { "studentId": "…", "status": "ABSENT", "baseVersion": 2 } ] } }
  ] }
```

**Answer:** one result per operation, in order:
`{ "opId": "uuid-1", "status": "applied" | "rejected" | "in_progress", "duplicate"?: true, "error"?: "…", "result"?: { … } }`.

- **At most 100 operations per push.** One rejected operation doesn't stop the others.
- **Each opId is applied once** (table `sync_operations`, per person). Resending it returns the
  first answer with `duplicate: true` and changes nothing. `in_progress` means the same id is
  being applied right now; send it again later.
- **`madeAt`** is when the change was made on the phone. A time in the future counts as "now".

| type | payload | rules |
|---|---|---|
| `attendance.mark` | classId, termId, date (YYYY-MM-DD), timetableSlotId (null = daily register), records [{ studentId, status, remarks?, baseVersion? }] | Same service as the web: no weekends, public holidays or school closure days, class teacher / cover / own period only, no future dates, no closed year. **Conflicts:** if the server's mark changed after `madeAt` (and after the `baseVersion` the phone saw), the server's mark is kept and listed in `result.conflicts`. |
| `specialClass.register` | specialClassId, records [{ studentId, status, remarks? }] | Only the teacher who asked for the weekend class (or the head/deputy), only once approved, on or after its day. |
| `marks.enter` | assessmentId, results [{ studentId, marksObtained, isAbsent?, remarks?, baseVersion? }] | Refused once the assessment is COMPLETED or its entry window has closed; otherwise as the web. **Conflicts (Phase 5b):** same rule as attendance — a mark changed on the server after `madeAt` (and after `baseVersion`) is kept, listed in `result.conflicts` (with the server's mark), and written to the marks history as "not applied". Every applied mark is in the history with source PHONE. |
| `lessonLog.save` | timetableSlotId, date, topic, subtopics? | Own period on its own weekday (as the web). |

Anything else is rejected: unknown type, invalid payload, or a refusal by the service. The
reason is in `error`, ready to show to the teacher.

## What's not in Phase 5
- Learner and staff details are read-only on phones (design §7 rule 6).
- ~~Marks have no history line yet.~~ Done in Phase 5b: every mark change is in the marks
  history, and an older phone change no longer overwrites a newer mark.
- ~~The app itself~~ Built in Phase 6: `apps/mobile` (offline storage, PIN, the "waiting to sync" counter).


## Calendar (Phase 5b)

Snapshots and pulls carry `calendar: { from, to, nonSchoolDays: [{ date, kind, name }] }`:
public holidays (`PUBLIC_HOLIDAY`, the national list after HQ's changes) and the school's
closure days (`SCHOOL_CLOSURE`) from a month ago to four months ahead. Weekends are not listed.
The phone should refuse to start a daily or period register on those days (the server refuses it
anyway) and offer only special classes. Replace the whole list on every pull.
