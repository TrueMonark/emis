-- Phase 5: special (weekend) classes with their own register, and the phone sync operation log.

-- ---------------------------------------------------------------------------------------------
-- Special classes: a lesson on a Saturday or Sunday, asked for by the teacher and approved by the
-- HOD (or head/deputy). The only way attendance is taken on a weekend.
-- ---------------------------------------------------------------------------------------------
CREATE TYPE "SpecialClassStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "special_classes" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "venue" TEXT,
    "reason" TEXT,
    "status" "SpecialClassStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_classes_pkey" PRIMARY KEY ("id"),
    -- Saturday (6) or Sunday (0) only
    CONSTRAINT "special_classes_weekend_only" CHECK (EXTRACT(DOW FROM "date") IN (0, 6))
);
CREATE INDEX "special_classes_schoolId_idx" ON "special_classes"("schoolId");
CREATE INDEX "special_classes_classId_date_idx" ON "special_classes"("classId", "date");
CREATE INDEX "special_classes_teacherId_date_idx" ON "special_classes"("teacherId", "date");
CREATE INDEX "special_classes_status_idx" ON "special_classes"("status");
ALTER TABLE "special_classes" ADD CONSTRAINT "special_classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_classes" ADD CONSTRAINT "special_classes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "special_classes" ADD CONSTRAINT "special_classes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "special_classes" ADD CONSTRAINT "special_classes_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "special_classes" ADD CONSTRAINT "special_classes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "special_class_attendance" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "specialClassId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_class_attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "special_class_attendance_specialClassId_studentId_key" ON "special_class_attendance"("specialClassId", "studentId");
CREATE INDEX "special_class_attendance_schoolId_idx" ON "special_class_attendance"("schoolId");
CREATE INDEX "special_class_attendance_studentId_idx" ON "special_class_attendance"("studentId");
ALTER TABLE "special_class_attendance" ADD CONSTRAINT "special_class_attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_class_attendance" ADD CONSTRAINT "special_class_attendance_specialClassId_fkey" FOREIGN KEY ("specialClassId") REFERENCES "special_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "special_class_attendance" ADD CONSTRAINT "special_class_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "special_class_attendance" ADD CONSTRAINT "special_class_attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Each school sees only its own rows (same policy as every school-owned table).
ALTER TABLE "special_classes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "special_classes"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
ALTER TABLE "special_class_attendance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "special_class_attendance"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

-- Both sync to phones: versions and the change log, as in Phase 3c.
CREATE TRIGGER "special_classes_bump_version" BEFORE UPDATE ON "special_classes"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "special_classes_change_log" AFTER INSERT OR UPDATE OR DELETE ON "special_classes"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();
CREATE TRIGGER "special_class_attendance_bump_version" BEFORE UPDATE ON "special_class_attendance"
  FOR EACH ROW EXECUTE FUNCTION "emis_bump_version"();
CREATE TRIGGER "special_class_attendance_change_log" AFTER INSERT OR UPDATE OR DELETE ON "special_class_attendance"
  FOR EACH ROW EXECUTE FUNCTION "emis_record_change"();

-- ---------------------------------------------------------------------------------------------
-- Phone sync: every operation a phone sends, by its id (a resend gets the first answer).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE "sync_operations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "userId" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "deviceId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sync_operations_schoolId_userId_opId_key" ON "sync_operations"("schoolId", "userId", "opId");
CREATE INDEX "sync_operations_schoolId_idx" ON "sync_operations"("schoolId");
CREATE INDEX "sync_operations_userId_receivedAt_idx" ON "sync_operations"("userId", "receivedAt");
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sync_operations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sync_operations"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

-- New tables after the 3a default privileges still get them; stated here so nothing depends on it.
GRANT SELECT, INSERT, UPDATE, DELETE ON "special_classes", "special_class_attendance", "sync_operations" TO emis_app;
