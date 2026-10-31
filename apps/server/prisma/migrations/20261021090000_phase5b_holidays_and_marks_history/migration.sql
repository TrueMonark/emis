-- Phase 5b (21 October 2026): public holidays and school closures block registers like
-- weekends; every mark change is kept.

-- ── National public holiday changes (HQ) ────────────────────────────────────────────────────
CREATE TYPE "HolidayChangeKind" AS ENUM ('ADD', 'CANCEL');

CREATE TABLE "public_holiday_changes" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "HolidayChangeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_holiday_changes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "public_holiday_changes_date_key" ON "public_holiday_changes"("date");
-- National: every school reads it, the app writes it (HQ only, checked in the service).
GRANT SELECT, INSERT, UPDATE, DELETE ON "public_holiday_changes" TO emis_app;

-- ── School closures ─────────────────────────────────────────────────────────────────────────
CREATE TABLE "school_closures" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_closures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_closures_dates" CHECK ("endDate" >= "startDate")
);
CREATE INDEX "school_closures_schoolId_idx" ON "school_closures"("schoolId");
CREATE INDEX "school_closures_schoolId_startDate_idx" ON "school_closures"("schoolId", "startDate");
ALTER TABLE "school_closures" ADD CONSTRAINT "school_closures_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_closures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "school_closures"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "school_closures" TO emis_app;

-- ── Special classes may also be on a public holiday or closure day (checked in the app) ─────
ALTER TABLE "special_classes" DROP CONSTRAINT "special_classes_weekend_only";

-- ── Marks history ───────────────────────────────────────────────────────────────────────────
CREATE TYPE "MarkChangeAction" AS ENUM ('CREATED', 'CHANGED', 'DELETED', 'PHONE_NOT_APPLIED');

CREATE TABLE "mark_changes" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "resultId" TEXT,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" "MarkChangeAction" NOT NULL,
    "oldMarks" DOUBLE PRECISION,
    "newMarks" DOUBLE PRECISION,
    "oldAbsent" BOOLEAN,
    "newAbsent" BOOLEAN,
    "oldRemarks" TEXT,
    "newRemarks" TEXT,
    "changedById" TEXT,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mark_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mark_changes_schoolId_idx" ON "mark_changes"("schoolId");
CREATE INDEX "mark_changes_assessmentId_studentId_changedAt_idx" ON "mark_changes"("assessmentId", "studentId", "changedAt");
ALTER TABLE "mark_changes" ADD CONSTRAINT "mark_changes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mark_changes" ADD CONSTRAINT "mark_changes_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mark_changes" ADD CONSTRAINT "mark_changes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mark_changes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "mark_changes"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
-- Read, and add the "phone change not applied" lines; never change or delete.
GRANT SELECT, INSERT ON "mark_changes" TO emis_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "mark_changes" FROM emis_app;

-- One line per real change of a mark, whatever wrote it (web, phone, import). SECURITY DEFINER,
-- like the change log, so the line is written even though the app role can't change history.
-- Who: app.user_id; where from: app.source (PHONE for phone sync, else WEB; SYSTEM without a user).
CREATE FUNCTION "emis_record_mark_change"() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who TEXT := NULLIF(current_setting('app.user_id', true), '');
  src TEXT := COALESCE(NULLIF(current_setting('app.source', true), ''), CASE WHEN who IS NULL THEN 'SYSTEM' ELSE 'WEB' END);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "mark_changes" ("schoolId", "resultId", "assessmentId", "studentId", "action",
        "newMarks", "newAbsent", "newRemarks", "changedById", "source")
      VALUES (NEW."schoolId", NEW."id", NEW."assessmentId", NEW."studentId", 'CREATED',
        NEW."marksObtained", NEW."isAbsent", NEW."remarks", who, src);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW."marksObtained" IS DISTINCT FROM OLD."marksObtained"
       OR NEW."isAbsent" IS DISTINCT FROM OLD."isAbsent"
       OR NEW."remarks" IS DISTINCT FROM OLD."remarks" THEN
      INSERT INTO "mark_changes" ("schoolId", "resultId", "assessmentId", "studentId", "action",
          "oldMarks", "newMarks", "oldAbsent", "newAbsent", "oldRemarks", "newRemarks", "changedById", "source")
        VALUES (NEW."schoolId", NEW."id", NEW."assessmentId", NEW."studentId", 'CHANGED',
          OLD."marksObtained", NEW."marksObtained", OLD."isAbsent", NEW."isAbsent", OLD."remarks", NEW."remarks", who, src);
    END IF;
    RETURN NEW;
  ELSE
    -- A learner or assessment being deleted takes its history with it (cascade); only record
    -- a result deleted on its own.
    IF EXISTS (SELECT 1 FROM "assessments" WHERE "id" = OLD."assessmentId")
       AND EXISTS (SELECT 1 FROM "students" WHERE "id" = OLD."studentId") THEN
      INSERT INTO "mark_changes" ("schoolId", "resultId", "assessmentId", "studentId", "action",
          "oldMarks", "oldAbsent", "oldRemarks", "changedById", "source")
        VALUES (OLD."schoolId", OLD."id", OLD."assessmentId", OLD."studentId", 'DELETED',
          OLD."marksObtained", OLD."isAbsent", OLD."remarks", who, src);
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER "student_assessment_results_mark_history"
  AFTER INSERT OR UPDATE OR DELETE ON "student_assessment_results"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_mark_change"();
