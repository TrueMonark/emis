-- Phase 9b (4 November 2026): School Based Assessment (SBA) score sheets. One sheet per
-- teacher, subject, class and school year; six tasks marked out of what the teacher sets;
-- teacher submits -> HOD approves or sends back -> head teacher confirms. School-owned, with
-- the same row-level security as every other school table. The offices get progress counts
-- only (emis_sba_progress), never marks.

ALTER TABLE "schools" ADD COLUMN "eczCentreCode" TEXT;

CREATE TYPE "SbaSheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'HOD_APPROVED', 'CONFIRMED');
CREATE TYPE "SbaEventAction" AS ENUM ('STARTED', 'SUBMITTED', 'RETURNED', 'HOD_APPROVED', 'CONFIRMED', 'REOPENED');

CREATE TABLE "sba_sheets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "SbaSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "hodDecidedAt" TIMESTAMP(3),
    "hodDecidedById" TEXT,
    "reviewComment" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sba_sheets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "sba_tasks" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "sheetId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "dueDate" DATE,
    CONSTRAINT "sba_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sba_tasks_number" CHECK ("number" BETWEEN 1 AND 6),
    CONSTRAINT "sba_tasks_max" CHECK ("maxMarks" > 0)
);
CREATE TABLE "sba_marks" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marks" DOUBLE PRECISION,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sba_marks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sba_marks_not_negative" CHECK ("marks" IS NULL OR "marks" >= 0)
);
CREATE TABLE "sba_learner_notes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "sheetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examinationNumber" TEXT,
    "comment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sba_learner_notes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "sba_sheet_events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "sheetId" TEXT NOT NULL,
    "action" "SbaEventAction" NOT NULL,
    "byUserId" TEXT,
    "comment" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sba_sheet_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sba_sheets_academicYearId_classId_subjectId_teacherId_key" ON "sba_sheets"("academicYearId", "classId", "subjectId", "teacherId");
CREATE INDEX "sba_sheets_schoolId_idx" ON "sba_sheets"("schoolId");
CREATE INDEX "sba_sheets_teacherId_idx" ON "sba_sheets"("teacherId");
CREATE INDEX "sba_sheets_classId_subjectId_idx" ON "sba_sheets"("classId", "subjectId");
CREATE UNIQUE INDEX "sba_tasks_sheetId_number_key" ON "sba_tasks"("sheetId", "number");
CREATE INDEX "sba_tasks_schoolId_idx" ON "sba_tasks"("schoolId");
CREATE UNIQUE INDEX "sba_marks_taskId_studentId_key" ON "sba_marks"("taskId", "studentId");
CREATE INDEX "sba_marks_schoolId_idx" ON "sba_marks"("schoolId");
CREATE INDEX "sba_marks_studentId_idx" ON "sba_marks"("studentId");
CREATE UNIQUE INDEX "sba_learner_notes_sheetId_studentId_key" ON "sba_learner_notes"("sheetId", "studentId");
CREATE INDEX "sba_learner_notes_schoolId_idx" ON "sba_learner_notes"("schoolId");
CREATE INDEX "sba_sheet_events_sheetId_at_idx" ON "sba_sheet_events"("sheetId", "at");
CREATE INDEX "sba_sheet_events_schoolId_idx" ON "sba_sheet_events"("schoolId");

ALTER TABLE "sba_sheets" ADD CONSTRAINT "sba_sheets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_sheets" ADD CONSTRAINT "sba_sheets_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_sheets" ADD CONSTRAINT "sba_sheets_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_sheets" ADD CONSTRAINT "sba_sheets_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_sheets" ADD CONSTRAINT "sba_sheets_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_tasks" ADD CONSTRAINT "sba_tasks_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_tasks" ADD CONSTRAINT "sba_tasks_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sba_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sba_marks" ADD CONSTRAINT "sba_marks_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_marks" ADD CONSTRAINT "sba_marks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "sba_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sba_marks" ADD CONSTRAINT "sba_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sba_learner_notes" ADD CONSTRAINT "sba_learner_notes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_learner_notes" ADD CONSTRAINT "sba_learner_notes_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sba_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sba_learner_notes" ADD CONSTRAINT "sba_learner_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sba_sheet_events" ADD CONSTRAINT "sba_sheet_events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sba_sheet_events" ADD CONSTRAINT "sba_sheet_events_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sba_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sba_sheets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sba_sheets"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
ALTER TABLE "sba_tasks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sba_tasks"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
ALTER TABLE "sba_marks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sba_marks"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
ALTER TABLE "sba_learner_notes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sba_learner_notes"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
ALTER TABLE "sba_sheet_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sba_sheet_events"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

-- Sheets and tasks are never deleted by the app (a sheet is reopened instead); marks and
-- notes are edited while the sheet is open; the history is only ever added to.
GRANT SELECT, INSERT, UPDATE ON "sba_sheets", "sba_tasks" TO emis_app;
REVOKE DELETE, TRUNCATE ON "sba_sheets", "sba_tasks" FROM emis_app;
GRANT SELECT, INSERT, UPDATE ON "sba_marks", "sba_learner_notes" TO emis_app;
REVOKE DELETE, TRUNCATE ON "sba_marks", "sba_learner_notes" FROM emis_app;
GRANT SELECT, INSERT ON "sba_sheet_events" TO emis_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "sba_sheet_events" FROM emis_app;

-- Progress for the offices: per school, how many sheets are expected this school year (each
-- teacher, subject and class taught in a 2023-curriculum O-level class) and how many are in
-- each state. Counts only; SECURITY DEFINER like the Phase 7 indicator functions.
CREATE OR REPLACE FUNCTION emis_sba_progress(p_school_ids text[])
RETURNS TABLE (school_id text, expected int, draft int, submitted int, returned int, hod_approved int, confirmed int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH s AS (SELECT DISTINCT x AS id FROM unnest(p_school_ids) AS x),
  yr AS (
    SELECT y.id, y."schoolId" FROM public.academic_years y
    WHERE y."schoolId" = ANY (p_school_ids) AND y."isActive"
  ),
  exp AS (
    SELECT a."schoolId" AS school_id, count(DISTINCT a."teacherId" || '|' || a."subjectId" || '|' || a."classId") AS n
    FROM public.subject_teacher_assignments a
    JOIN yr ON yr.id = a."academicYearId"
    JOIN public.classes c ON c.id = a."classId"
    JOIN public.grades g ON g.id = c."gradeId"
    WHERE a."endedAt" IS NULL AND g.stage::text = 'O_LEVEL' AND g.curriculum::text = 'CBC_2023'
    GROUP BY a."schoolId"
  ),
  sh AS (
    SELECT sb."schoolId" AS school_id,
      count(*) FILTER (WHERE sb.status::text = 'DRAFT') AS draft,
      count(*) FILTER (WHERE sb.status::text = 'SUBMITTED') AS submitted,
      count(*) FILTER (WHERE sb.status::text = 'RETURNED') AS returned,
      count(*) FILTER (WHERE sb.status::text = 'HOD_APPROVED') AS hod_approved,
      count(*) FILTER (WHERE sb.status::text = 'CONFIRMED') AS confirmed
    FROM public.sba_sheets sb
    JOIN yr ON yr.id = sb."academicYearId"
    GROUP BY sb."schoolId"
  )
  SELECT s.id,
    coalesce(exp.n, 0)::int,
    coalesce(sh.draft, 0)::int, coalesce(sh.submitted, 0)::int, coalesce(sh.returned, 0)::int,
    coalesce(sh.hod_approved, 0)::int, coalesce(sh.confirmed, 0)::int
  FROM s
  LEFT JOIN exp ON exp.school_id = s.id
  LEFT JOIN sh ON sh.school_id = s.id;
END;
$$;
REVOKE ALL ON FUNCTION emis_sba_progress(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION emis_sba_progress(text[]) TO emis_app;
