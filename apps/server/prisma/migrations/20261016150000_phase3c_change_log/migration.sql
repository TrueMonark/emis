-- Phase 3c: offline-ready data (docs/design/phase-3-foundation.md §7, rules 1–4).
--
-- 1. IDs: already random and collision-free (cuid), so a phone can make them offline.
-- 2. "version" on every syncable table, raised by one on each change (trigger, so every code
--    path does it). A phone sends the version it last saw; the server can tell if someone else
--    changed the row meanwhile.
-- 3 + 4. "change_log": every insert, update and delete on those tables is written there by a
--    trigger, with the transaction id. Deletes are recorded as op DELETE: the log line is the
--    tombstone, so a deletion reaches phones that were offline without keeping deleted rows in
--    the tables (no query has to learn to skip them).
--
-- The sync cursor is a transaction id, not a sequence number: a pull returns the changes of
-- transactions that have all finished (below the snapshot's xmin), so a long transaction that
-- commits late is never skipped (see features/sync/changeLog.repository.ts).

CREATE TABLE "change_log" (
    "seq" BIGSERIAL NOT NULL,
    "schoolId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "txid" BIGINT NOT NULL DEFAULT (pg_current_xact_id()::text::bigint),
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("seq")
);
CREATE INDEX "change_log_schoolId_txid_seq_idx" ON "change_log"("schoolId", "txid", "seq");
CREATE INDEX "change_log_schoolId_entity_entityId_idx" ON "change_log"("schoolId", "entity", "entityId");

-- Each school reads only its own changes; nobody but the triggers writes them.
ALTER TABLE "change_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "change_log"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
GRANT SELECT ON "change_log" TO emis_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "change_log" FROM emis_app;
REVOKE ALL ON SEQUENCE "change_log_seq_seq" FROM emis_app;

-- Writes one log line per changed row. SECURITY DEFINER: runs as the database owner, so the
-- app role can't write (or forge) log lines itself.
CREATE FUNCTION "emis_record_change"() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who TEXT := NULLIF(current_setting('app.user_id', true), '');
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO "change_log" ("schoolId", "entity", "entityId", "op", "changedBy")
      VALUES (OLD."schoolId", TG_TABLE_NAME, OLD."id", 'DELETE', who);
    RETURN OLD;
  END IF;
  INSERT INTO "change_log" ("schoolId", "entity", "entityId", "op", "changedBy")
    VALUES (NEW."schoolId", TG_TABLE_NAME, NEW."id", TG_OP, who);
  RETURN NEW;
END;
$$;

-- Raises "version" on every real update (an update that changes nothing keeps its version).
CREATE FUNCTION "emis_bump_version"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW."version" := OLD."version" + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER TABLE "academic_years" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "academic_years_bump_version" BEFORE UPDATE ON "academic_years"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "academic_years_change_log" AFTER INSERT OR UPDATE OR DELETE ON "academic_years"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "terms" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "terms_bump_version" BEFORE UPDATE ON "terms"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "terms_change_log" AFTER INSERT OR UPDATE OR DELETE ON "terms"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "grades" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "grades_bump_version" BEFORE UPDATE ON "grades"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "grades_change_log" AFTER INSERT OR UPDATE OR DELETE ON "grades"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "classes" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "classes_bump_version" BEFORE UPDATE ON "classes"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "classes_change_log" AFTER INSERT OR UPDATE OR DELETE ON "classes"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "subjects" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "subjects_bump_version" BEFORE UPDATE ON "subjects"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "subjects_change_log" AFTER INSERT OR UPDATE OR DELETE ON "subjects"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "class_subjects" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "class_subjects_bump_version" BEFORE UPDATE ON "class_subjects"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "class_subjects_change_log" AFTER INSERT OR UPDATE OR DELETE ON "class_subjects"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "students" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "students_bump_version" BEFORE UPDATE ON "students"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "students_change_log" AFTER INSERT OR UPDATE OR DELETE ON "students"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "student_class_enrollments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "student_class_enrollments_bump_version" BEFORE UPDATE ON "student_class_enrollments"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "student_class_enrollments_change_log" AFTER INSERT OR UPDATE OR DELETE ON "student_class_enrollments"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "class_teacher_assignments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "class_teacher_assignments_bump_version" BEFORE UPDATE ON "class_teacher_assignments"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "class_teacher_assignments_change_log" AFTER INSERT OR UPDATE OR DELETE ON "class_teacher_assignments"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "subject_teacher_assignments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "subject_teacher_assignments_bump_version" BEFORE UPDATE ON "subject_teacher_assignments"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "subject_teacher_assignments_change_log" AFTER INSERT OR UPDATE OR DELETE ON "subject_teacher_assignments"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "timetable_slots" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "timetable_slots_bump_version" BEFORE UPDATE ON "timetable_slots"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "timetable_slots_change_log" AFTER INSERT OR UPDATE OR DELETE ON "timetable_slots"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "assessments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "assessments_bump_version" BEFORE UPDATE ON "assessments"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "assessments_change_log" AFTER INSERT OR UPDATE OR DELETE ON "assessments"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "student_assessment_results" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "student_assessment_results_bump_version" BEFORE UPDATE ON "student_assessment_results"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "student_assessment_results_change_log" AFTER INSERT OR UPDATE OR DELETE ON "student_assessment_results"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "attendance_records" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "attendance_records_bump_version" BEFORE UPDATE ON "attendance_records"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "attendance_records_change_log" AFTER INSERT OR UPDATE OR DELETE ON "attendance_records"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "lesson_logs" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "lesson_logs_bump_version" BEFORE UPDATE ON "lesson_logs"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "lesson_logs_change_log" AFTER INSERT OR UPDATE OR DELETE ON "lesson_logs"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

ALTER TABLE "register_covers" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER "register_covers_bump_version" BEFORE UPDATE ON "register_covers"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "register_covers_change_log" AFTER INSERT OR UPDATE OR DELETE ON "register_covers"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();
