-- Phase 3a: many schools in one database.
--
-- 1. Education offices (HQ, provinces, districts), schools and school memberships.
-- 2. A "schoolId" on every school-owned table. Existing data is moved into one school.
-- 3. Each person's role at their school becomes a membership; the old ADMIN role becomes
--    HEAD_TEACHER (head and deputy have the same rights).
-- 4. Row-level security: the app works as the role "emis_app", which only sees the rows of
--    the school set in "app.school_id" for the current transaction (lib/db/tenant.ts).

-- CreateEnum
CREATE TYPE "EducationOfficeType" AS ENUM ('HQ', 'PROVINCIAL', 'DISTRICT');

-- CreateEnum
CREATE TYPE "EmisNumberStatus" AS ENUM ('CONFIRMED', 'PENDING', 'DISPUTED');

-- CreateEnum
CREATE TYPE "SchoolCategory" AS ENUM ('PUBLIC', 'AIDED', 'COMMUNITY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "education_offices" (
    "id" TEXT NOT NULL,
    "type" "EducationOfficeType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emisNumber" TEXT,
    "emisStatus" "EmisNumberStatus" NOT NULL DEFAULT 'PENDING',
    "category" "SchoolCategory" NOT NULL DEFAULT 'PUBLIC',
    "agency" TEXT,
    "districtOfficeId" TEXT NOT NULL,
    "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_memberships_pkey" PRIMARY KEY ("id")
);

-- schoolId: nullable first, filled in below, then made required.
-- AlterTable
ALTER TABLE "academic_years" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "terms" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "grade_subjects" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "student_guardians" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "student_class_enrollments" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "student_promotions" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "teacher_subjects" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "teacher_departments" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "class_teacher_assignments" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "subject_teacher_assignments" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "class_subjects" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "timetable_configurations" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "timetable_slots" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "lesson_logs" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "time_slots" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "class_timetables" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "secondary_timetables" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "subject_period_requirements" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "assessment_windows" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "student_assessment_results" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "report_cards" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "report_card_subjects" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "user_permissions" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "sms_logs" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "sms_templates" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "schoolId" TEXT DEFAULT current_setting('app.school_id'::text, true);

-- ---------------------------------------------------------------------------------------------
-- The national office tree: Ministry HQ and the 10 provincial offices. District offices are
-- added later (the official list is not loaded yet). "Not yet assigned" holds schools whose
-- district hasn't been set.
-- ---------------------------------------------------------------------------------------------
INSERT INTO "education_offices" ("id", "type", "name", "code", "parentId", "updatedAt") VALUES
  ('office-hq', 'HQ', 'Ministry of Education Headquarters', 'HQ', NULL, now());
INSERT INTO "education_offices" ("id", "type", "name", "code", "parentId", "updatedAt") VALUES
  ('office-prov-central', 'PROVINCIAL', 'Central Provincial Education Office', 'PEO-CENTRAL', 'office-hq', now()),
  ('office-prov-copperbelt', 'PROVINCIAL', 'Copperbelt Provincial Education Office', 'PEO-COPPERBELT', 'office-hq', now()),
  ('office-prov-eastern', 'PROVINCIAL', 'Eastern Provincial Education Office', 'PEO-EASTERN', 'office-hq', now()),
  ('office-prov-luapula', 'PROVINCIAL', 'Luapula Provincial Education Office', 'PEO-LUAPULA', 'office-hq', now()),
  ('office-prov-lusaka', 'PROVINCIAL', 'Lusaka Provincial Education Office', 'PEO-LUSAKA', 'office-hq', now()),
  ('office-prov-muchinga', 'PROVINCIAL', 'Muchinga Provincial Education Office', 'PEO-MUCHINGA', 'office-hq', now()),
  ('office-prov-northern', 'PROVINCIAL', 'Northern Provincial Education Office', 'PEO-NORTHERN', 'office-hq', now()),
  ('office-prov-northwestern', 'PROVINCIAL', 'North-Western Provincial Education Office', 'PEO-NORTHWESTERN', 'office-hq', now()),
  ('office-prov-southern', 'PROVINCIAL', 'Southern Provincial Education Office', 'PEO-SOUTHERN', 'office-hq', now()),
  ('office-prov-western', 'PROVINCIAL', 'Western Provincial Education Office', 'PEO-WESTERN', 'office-hq', now()),
  ('office-prov-unassigned', 'PROVINCIAL', 'Province not yet assigned', 'PEO-UNASSIGNED', 'office-hq', now());
INSERT INTO "education_offices" ("id", "type", "name", "code", "parentId", "updatedAt") VALUES
  ('office-district-unassigned', 'DISTRICT', 'District not yet assigned', 'DEBS-UNASSIGNED', 'office-prov-unassigned', now());

-- ---------------------------------------------------------------------------------------------
-- Existing data (a database in use before multi-school) moves into one school. A fresh database
-- gets no school here; schools are created by the district office (or the seed).
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  owned_tables text[] := ARRAY['academic_years', 'terms', 'classes', 'subjects', 'grade_subjects', 'departments', 'students', 'guardians', 'student_guardians', 'student_class_enrollments', 'student_promotions', 'teacher_subjects', 'teacher_departments', 'class_teacher_assignments', 'subject_teacher_assignments', 'class_subjects', 'timetable_configurations', 'timetable_slots', 'lesson_logs', 'rooms', 'time_slots', 'class_timetables', 'secondary_timetables', 'subject_period_requirements', 'assessments', 'assessment_windows', 'student_assessment_results', 'report_cards', 'report_card_subjects', 'attendance_records', 'user_permissions', 'system_settings', 'sms_logs', 'sms_templates', 'notifications'];
  t text;
  has_data boolean := EXISTS (SELECT 1 FROM "users");
  sid text := 'school-' || replace(gen_random_uuid()::text, '-', '');
  school_name text;
BEGIN
  IF NOT has_data THEN
    FOREACH t IN ARRAY owned_tables LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', t) INTO has_data;
      EXIT WHEN has_data;
    END LOOP;
  END IF;

  IF has_data THEN
    SELECT NULLIF(btrim(value #>> '{}'), '') INTO school_name
      FROM "system_settings" WHERE "key" = 'name' AND "category" = 'school_info' LIMIT 1;

    INSERT INTO "schools" ("id", "name", "districtOfficeId", "updatedAt")
      VALUES (sid, COALESCE(school_name, 'School name not set'), 'office-district-unassigned', now());

    FOREACH t IN ARRAY owned_tables LOOP
      EXECUTE format('UPDATE %I SET "schoolId" = $1 WHERE "schoolId" IS NULL', t) USING sid;
    END LOOP;

    -- Head teacher and deputy have the same rights; the old ADMIN (meant for the head) becomes
    -- HEAD_TEACHER.
    UPDATE "users" SET "role" = 'HEAD_TEACHER' WHERE "role" = 'ADMIN';

    INSERT INTO "school_memberships" ("id", "userId", "schoolId", "role", "status", "startDate", "updatedAt")
      SELECT 'mbr-' || replace(gen_random_uuid()::text, '-', ''), u."id", sid, u."role", 'ACTIVE', u."createdAt", now()
      FROM "users" u;
  END IF;
END $$;

-- Every row now has a school.
ALTER TABLE "academic_years" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "terms" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "classes" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "subjects" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "grade_subjects" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "departments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "students" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "guardians" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "student_guardians" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "student_class_enrollments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "student_promotions" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "teacher_subjects" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "teacher_departments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "class_teacher_assignments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "subject_teacher_assignments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "class_subjects" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "timetable_configurations" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "timetable_slots" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "lesson_logs" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "rooms" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "time_slots" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "class_timetables" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "secondary_timetables" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "subject_period_requirements" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "assessments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "assessment_windows" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "student_assessment_results" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "report_cards" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "report_card_subjects" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "attendance_records" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "user_permissions" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "system_settings" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "sms_logs" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "sms_templates" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "schoolId" SET NOT NULL;

-- Unique rules become per school (e.g. two schools may both have subject code "MATH").
-- DropIndex
DROP INDEX "academic_years_year_key";

-- DropIndex
DROP INDEX "classes_gradeId_name_key";

-- DropIndex
DROP INDEX "subjects_code_key";

-- DropIndex
DROP INDEX "departments_code_key";

-- DropIndex
DROP INDEX "students_studentNumber_key";

-- DropIndex
DROP INDEX "rooms_name_key";

-- DropIndex
DROP INDEX "rooms_code_key";

-- DropIndex
DROP INDEX "time_slots_startTime_endTime_key";

-- DropIndex
DROP INDEX "user_permissions_userId_permission_key";

-- DropIndex
DROP INDEX "system_settings_key_key";

-- DropIndex
DROP INDEX "sms_templates_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "education_offices_code_key" ON "education_offices"("code");

-- CreateIndex
CREATE INDEX "education_offices_parentId_idx" ON "education_offices"("parentId");

-- CreateIndex
CREATE INDEX "education_offices_type_idx" ON "education_offices"("type");

-- CreateIndex
CREATE UNIQUE INDEX "schools_emisNumber_key" ON "schools"("emisNumber");

-- CreateIndex
CREATE INDEX "schools_districtOfficeId_idx" ON "schools"("districtOfficeId");

-- CreateIndex
CREATE INDEX "school_memberships_schoolId_status_idx" ON "school_memberships"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "school_memberships_userId_schoolId_key" ON "school_memberships"("userId", "schoolId");

-- CreateIndex
CREATE INDEX "academic_years_schoolId_idx" ON "academic_years"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_schoolId_year_key" ON "academic_years"("schoolId", "year");

-- CreateIndex
CREATE INDEX "terms_schoolId_idx" ON "terms"("schoolId");

-- CreateIndex
CREATE INDEX "classes_schoolId_idx" ON "classes"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_schoolId_gradeId_name_key" ON "classes"("schoolId", "gradeId", "name");

-- CreateIndex
CREATE INDEX "subjects_schoolId_idx" ON "subjects"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_schoolId_code_key" ON "subjects"("schoolId", "code");

-- CreateIndex
CREATE INDEX "grade_subjects_schoolId_idx" ON "grade_subjects"("schoolId");

-- CreateIndex
CREATE INDEX "departments_schoolId_idx" ON "departments"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_schoolId_code_key" ON "departments"("schoolId", "code");

-- CreateIndex
CREATE INDEX "students_schoolId_idx" ON "students"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_studentNumber_key" ON "students"("schoolId", "studentNumber");

-- CreateIndex
CREATE INDEX "guardians_schoolId_idx" ON "guardians"("schoolId");

-- CreateIndex
CREATE INDEX "student_guardians_schoolId_idx" ON "student_guardians"("schoolId");

-- CreateIndex
CREATE INDEX "student_class_enrollments_schoolId_idx" ON "student_class_enrollments"("schoolId");

-- CreateIndex
CREATE INDEX "student_promotions_schoolId_idx" ON "student_promotions"("schoolId");

-- CreateIndex
CREATE INDEX "teacher_subjects_schoolId_idx" ON "teacher_subjects"("schoolId");

-- CreateIndex
CREATE INDEX "teacher_departments_schoolId_idx" ON "teacher_departments"("schoolId");

-- CreateIndex
CREATE INDEX "class_teacher_assignments_schoolId_idx" ON "class_teacher_assignments"("schoolId");

-- CreateIndex
CREATE INDEX "subject_teacher_assignments_schoolId_idx" ON "subject_teacher_assignments"("schoolId");

-- CreateIndex
CREATE INDEX "class_subjects_schoolId_idx" ON "class_subjects"("schoolId");

-- CreateIndex
CREATE INDEX "timetable_configurations_schoolId_idx" ON "timetable_configurations"("schoolId");

-- CreateIndex
CREATE INDEX "timetable_slots_schoolId_idx" ON "timetable_slots"("schoolId");

-- CreateIndex
CREATE INDEX "lesson_logs_schoolId_idx" ON "lesson_logs"("schoolId");

-- CreateIndex
CREATE INDEX "rooms_schoolId_idx" ON "rooms"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_schoolId_name_key" ON "rooms"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_schoolId_code_key" ON "rooms"("schoolId", "code");

-- CreateIndex
CREATE INDEX "time_slots_schoolId_idx" ON "time_slots"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_schoolId_startTime_endTime_key" ON "time_slots"("schoolId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "class_timetables_schoolId_idx" ON "class_timetables"("schoolId");

-- CreateIndex
CREATE INDEX "secondary_timetables_schoolId_idx" ON "secondary_timetables"("schoolId");

-- CreateIndex
CREATE INDEX "subject_period_requirements_schoolId_idx" ON "subject_period_requirements"("schoolId");

-- CreateIndex
CREATE INDEX "assessments_schoolId_idx" ON "assessments"("schoolId");

-- CreateIndex
CREATE INDEX "assessment_windows_schoolId_idx" ON "assessment_windows"("schoolId");

-- CreateIndex
CREATE INDEX "student_assessment_results_schoolId_idx" ON "student_assessment_results"("schoolId");

-- CreateIndex
CREATE INDEX "report_cards_schoolId_idx" ON "report_cards"("schoolId");

-- CreateIndex
CREATE INDEX "report_card_subjects_schoolId_idx" ON "report_card_subjects"("schoolId");

-- CreateIndex
CREATE INDEX "attendance_records_schoolId_idx" ON "attendance_records"("schoolId");

-- CreateIndex
CREATE INDEX "user_permissions_schoolId_idx" ON "user_permissions"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_schoolId_userId_permission_key" ON "user_permissions"("schoolId", "userId", "permission");

-- CreateIndex
CREATE INDEX "system_settings_schoolId_idx" ON "system_settings"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_schoolId_key_key" ON "system_settings"("schoolId", "key");

-- CreateIndex
CREATE INDEX "sms_logs_schoolId_idx" ON "sms_logs"("schoolId");

-- CreateIndex
CREATE INDEX "sms_templates_schoolId_idx" ON "sms_templates"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_templates_schoolId_name_key" ON "sms_templates"("schoolId", "name");

-- CreateIndex
CREATE INDEX "notifications_schoolId_idx" ON "notifications"("schoolId");

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_subjects" ADD CONSTRAINT "grade_subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_class_enrollments" ADD CONSTRAINT "student_class_enrollments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_offices" ADD CONSTRAINT "education_offices_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "education_offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_districtOfficeId_fkey" FOREIGN KEY ("districtOfficeId") REFERENCES "education_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_departments" ADD CONSTRAINT "teacher_departments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_teacher_assignments" ADD CONSTRAINT "subject_teacher_assignments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_configurations" ADD CONSTRAINT "timetable_configurations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_logs" ADD CONSTRAINT "lesson_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_timetables" ADD CONSTRAINT "class_timetables_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_timetables" ADD CONSTRAINT "secondary_timetables_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_period_requirements" ADD CONSTRAINT "subject_period_requirements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_windows" ADD CONSTRAINT "assessment_windows_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_assessment_results" ADD CONSTRAINT "student_assessment_results_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card_subjects" ADD CONSTRAINT "report_card_subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most one ACTIVE school membership per person (a transfer waits as PENDING). A trigger,
-- because Prisma can't describe a partial unique index.
CREATE FUNCTION "emis_one_active_membership"() RETURNS trigger AS $fn$
BEGIN
  IF NEW."status" = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM "school_memberships"
    WHERE "userId" = NEW."userId" AND "status" = 'ACTIVE' AND "id" <> NEW."id"
      AND "schoolId" <> NEW."schoolId" -- the same school is the unique key's job (and upserts)
  ) THEN
    RAISE EXCEPTION 'A person can only be active at one school at a time (user %)', NEW."userId"
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER "school_memberships_one_active"
  BEFORE INSERT OR UPDATE OF "status", "userId" ON "school_memberships"
  FOR EACH ROW EXECUTE FUNCTION "emis_one_active_membership"();

-- ---------------------------------------------------------------------------------------------
-- Row-level security.
-- The app runs every query as "emis_app" (set for each transaction, see lib/db/tenant.ts) with
-- app.school_id set for that transaction. The database owner (migrations, maintenance) is not
-- restricted. emis_app can't log in by itself.
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'emis_app') THEN
    CREATE ROLE emis_app NOLOGIN;
  END IF;
END $$;
GRANT emis_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO emis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO emis_app;
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON "_prisma_migrations" FROM emis_app;
  END IF;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO emis_app;

ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "academic_years"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "terms"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "classes"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "subjects"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "grade_subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "grade_subjects"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "departments"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "students"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "guardians" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "guardians"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "student_guardians" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "student_guardians"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "student_class_enrollments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "student_class_enrollments"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "student_promotions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "student_promotions"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "teacher_subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "teacher_subjects"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "teacher_departments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "teacher_departments"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "class_teacher_assignments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "class_teacher_assignments"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "subject_teacher_assignments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "subject_teacher_assignments"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "class_subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "class_subjects"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "timetable_configurations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "timetable_configurations"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "timetable_slots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "timetable_slots"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "lesson_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "lesson_logs"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "rooms"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "time_slots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "time_slots"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "class_timetables" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "class_timetables"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "secondary_timetables" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "secondary_timetables"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "subject_period_requirements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "subject_period_requirements"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "assessments"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "assessment_windows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "assessment_windows"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "student_assessment_results" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "student_assessment_results"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "report_cards" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "report_cards"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "report_card_subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "report_card_subjects"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "attendance_records"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "user_permissions"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "system_settings"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "sms_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sms_logs"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "sms_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "sms_templates"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "notifications"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

-- Teacher profiles belong to the person (they move with them between schools). A school sees
-- the profiles of people who are or were its members, and can change only current (not ENDED)
-- members' profiles. Everyone can always see and update their own profile.
ALTER TABLE "teacher_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON "teacher_profiles" FOR SELECT USING (
  "userId" = current_setting('app.user_id', true)
  OR EXISTS (SELECT 1 FROM "school_memberships" m
             WHERE m."userId" = "teacher_profiles"."userId"
               AND m."schoolId" = current_setting('app.school_id', true))
);
CREATE POLICY "profiles_create" ON "teacher_profiles" FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_change" ON "teacher_profiles" FOR UPDATE USING (
  "userId" = current_setting('app.user_id', true)
  OR EXISTS (SELECT 1 FROM "school_memberships" m
             WHERE m."userId" = "teacher_profiles"."userId"
               AND m."schoolId" = current_setting('app.school_id', true)
               AND m."status" <> 'ENDED')
);
CREATE POLICY "profiles_delete" ON "teacher_profiles" FOR DELETE USING (
  EXISTS (SELECT 1 FROM "school_memberships" m
          WHERE m."userId" = "teacher_profiles"."userId"
            AND m."schoolId" = current_setting('app.school_id', true)
            AND m."status" <> 'ENDED')
);
