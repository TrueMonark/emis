-- Phase 3b: year levels per school, national subject catalogue, pathways, learner numbers.
--
-- 1. Grades become each school's own year levels (stage, curriculum, national exam). The old
--    shared Grade 1–12 rows are copied into every school, classes and subject links are moved
--    to the school's copy, and the shared rows are removed. Names, order and progression are
--    kept as they were.
-- 2. National subject catalogue and the O-level / A-level pathways (2023 Curriculum
--    Framework), plus which pathways each school offers. School subjects whose name matches a
--    catalogue subject are linked to it.
-- 3. Every learner gets a system-wide learner number (ZM + year + 7 characters + check).
-- 4. Promotions and report cards record year-level names (Form 1 has no old grade number).
-- 5. Timetable settings can hold a different period length per stage (30 min lower primary).

-- ---------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------
CREATE TYPE "YearStage" AS ENUM ('ECE', 'LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY', 'O_LEVEL', 'A_LEVEL', 'LSEND', 'YALE');
CREATE TYPE "Curriculum" AS ENUM ('LEGACY_2013', 'CBC_2023');
CREATE TYPE "NationalExam" AS ENUM ('NONE', 'PSLE_LEGACY', 'PSLE_2023', 'JSSL', 'SC_O_LEGACY', 'SC_O_2023', 'SC_A');

-- ---------------------------------------------------------------------------------------------
-- 1. Year levels per school
-- ---------------------------------------------------------------------------------------------
DROP INDEX IF EXISTS "grades_level_key";
DROP INDEX IF EXISTS "grades_sequence_key";
DROP INDEX IF EXISTS "grades_nextGradeId_key";

ALTER TABLE "grades"
  ADD COLUMN "schoolId" TEXT,
  ADD COLUMN "shortName" TEXT,
  ADD COLUMN "stage" "YearStage",
  ADD COLUMN "curriculum" "Curriculum" NOT NULL DEFAULT 'LEGACY_2013',
  ADD COLUMN "exam" "NationalExam" NOT NULL DEFAULT 'NONE';
ALTER TABLE "grades" ALTER COLUMN "level" DROP NOT NULL;

-- Describe the existing (shared) grades. "Form n" names are the 2023 curriculum; everything
-- else follows the 2013 structure (PSLE at Grade 7, JSSL at Grade 9, School Certificate at 12).
UPDATE "grades" SET
  "stage" = (CASE
    WHEN "name" ~* '^\s*form\s*[1-4]\M' THEN 'O_LEVEL'
    WHEN "name" ~* '^\s*form\s*[5-6]\M' THEN 'A_LEVEL'
    WHEN "level" IN ('GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4') THEN 'LOWER_PRIMARY'
    WHEN "level" IN ('GRADE_5', 'GRADE_6', 'GRADE_7') THEN 'UPPER_PRIMARY'
    WHEN "level" IN ('GRADE_8', 'GRADE_9') THEN 'JUNIOR_SECONDARY'
    ELSE 'O_LEVEL'
  END)::"YearStage",
  "curriculum" = (CASE WHEN "name" ~* '^\s*form\s*[1-6]\M' THEN 'CBC_2023' ELSE 'LEGACY_2013' END)::"Curriculum",
  "exam" = (CASE
    WHEN "name" ~* '^\s*form\s*4\M' THEN 'SC_O_2023'
    WHEN "name" ~* '^\s*form\s*6\M' THEN 'SC_A'
    WHEN "name" ~* '^\s*form\s*[1-6]\M' THEN 'NONE'
    WHEN "level" = 'GRADE_7' THEN 'PSLE_LEGACY'
    WHEN "level" = 'GRADE_9' THEN 'JSSL'
    WHEN "level" = 'GRADE_12' THEN 'SC_O_LEGACY'
    ELSE 'NONE'
  END)::"NationalExam",
  "shortName" = (CASE
    WHEN "name" ~* '^\s*form\s*\d' THEN 'F' || substring("name" from '(\d+)')
    WHEN "name" ~* '^\s*grade\s*\d' THEN 'G' || substring("name" from '(\d+)')
    ELSE NULL
  END);

-- A Form-named level carries no old grade number from here on (Form 1 isn't "Grade 8").
UPDATE "grades" SET "level" = NULL WHERE "curriculum" = 'CBC_2023';

-- Copy every shared grade into every school (stable ids, so re-running on a copy gives the
-- same result), then point each school's classes and subject links at its own copy.
CREATE TEMP TABLE "_grade_copy" AS
  SELECT g."id" AS "oldId",
         s."id" AS "schoolId",
         'yl' || substr(md5(s."id" || ':' || g."id"), 1, 23) AS "newId"
  FROM "grades" g CROSS JOIN "schools" s
  WHERE g."schoolId" IS NULL;

INSERT INTO "grades" ("id", "schoolId", "level", "name", "shortName", "schoolLevel", "stage",
                      "curriculum", "exam", "sequence", "nextGradeId", "createdAt", "updatedAt")
  SELECT c."newId", c."schoolId", g."level", g."name", g."shortName", g."schoolLevel", g."stage",
         g."curriculum", g."exam", g."sequence", NULL, g."createdAt", CURRENT_TIMESTAMP
  FROM "_grade_copy" c JOIN "grades" g ON g."id" = c."oldId";

UPDATE "grades" n SET "nextGradeId" = nc."newId"
  FROM "_grade_copy" c
  JOIN "grades" o ON o."id" = c."oldId"
  JOIN "_grade_copy" nc ON nc."oldId" = o."nextGradeId" AND nc."schoolId" = c."schoolId"
  WHERE n."id" = c."newId";

UPDATE "classes" t SET "gradeId" = c."newId"
  FROM "_grade_copy" c WHERE t."gradeId" = c."oldId" AND t."schoolId" = c."schoolId";
UPDATE "grade_subjects" t SET "gradeId" = c."newId"
  FROM "_grade_copy" c WHERE t."gradeId" = c."oldId" AND t."schoolId" = c."schoolId";
UPDATE "subject_period_requirements" t SET "gradeId" = c."newId"
  FROM "_grade_copy" c WHERE t."gradeId" = c."oldId" AND t."schoolId" = c."schoolId";

-- Nothing may still point at a shared grade before those rows go (deleting one would also
-- delete its classes).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "classes" t JOIN "grades" g ON g."id" = t."gradeId" WHERE g."schoolId" IS NULL)
     OR EXISTS (SELECT 1 FROM "grade_subjects" t JOIN "grades" g ON g."id" = t."gradeId" WHERE g."schoolId" IS NULL)
     OR EXISTS (SELECT 1 FROM "subject_period_requirements" t JOIN "grades" g ON g."id" = t."gradeId" WHERE g."schoolId" IS NULL)
  THEN
    RAISE EXCEPTION 'Phase 3b: some classes or subject links still use a shared grade; nothing was changed';
  END IF;
END $$;

UPDATE "grades" SET "nextGradeId" = NULL WHERE "schoolId" IS NULL;
DELETE FROM "grades" WHERE "schoolId" IS NULL;
DROP TABLE "_grade_copy";

ALTER TABLE "grades" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "grades" ALTER COLUMN "schoolId" SET DEFAULT current_setting('app.school_id'::text, true);
ALTER TABLE "grades" ALTER COLUMN "stage" SET NOT NULL;

CREATE UNIQUE INDEX "grades_schoolId_sequence_key" ON "grades"("schoolId", "sequence");
CREATE UNIQUE INDEX "grades_schoolId_name_key" ON "grades"("schoolId", "name");
CREATE INDEX "grades_schoolId_idx" ON "grades"("schoolId");
CREATE INDEX "grades_nextGradeId_idx" ON "grades"("nextGradeId");
ALTER TABLE "grades" ADD CONSTRAINT "grades_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "grades"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

-- ---------------------------------------------------------------------------------------------
-- 2. National subject catalogue and pathways
-- ---------------------------------------------------------------------------------------------
CREATE TABLE "catalogue_subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupNumber" INTEGER,
    "stages" "YearStage"[],
    "periodsPerWeek" JSONB,
    "compulsoryOLevel" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogue_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "catalogue_subjects_code_key" ON "catalogue_subjects"("code");

CREATE TABLE "pathways" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "YearStage" NOT NULL,
    "rules" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathways_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pathways_code_key" ON "pathways"("code");

CREATE TABLE "school_pathways" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "pathwayId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_pathways_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_pathways_schoolId_pathwayId_key" ON "school_pathways"("schoolId", "pathwayId");
CREATE INDEX "school_pathways_schoolId_idx" ON "school_pathways"("schoolId");
ALTER TABLE "school_pathways" ADD CONSTRAINT "school_pathways_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_pathways" ADD CONSTRAINT "school_pathways_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_pathways" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "school_pathways"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));

-- National lists are read by every school; only migrations and maintenance change them.
GRANT SELECT ON "catalogue_subjects", "pathways" TO emis_app;
REVOKE INSERT, UPDATE, DELETE ON "catalogue_subjects", "pathways" FROM emis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "school_pathways" TO emis_app;

-- Classes and enrolments can name a pathway; school subjects can name their catalogue entry.
ALTER TABLE "classes" ADD COLUMN "pathwayId" TEXT;
ALTER TABLE "classes" ADD CONSTRAINT "classes_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_class_enrollments" ADD COLUMN "pathwayId" TEXT;
ALTER TABLE "student_class_enrollments" ADD CONSTRAINT "student_class_enrollments_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD COLUMN "catalogueSubjectId" TEXT;
CREATE INDEX "subjects_catalogueSubjectId_idx" ON "subjects"("catalogueSubjectId");
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_catalogueSubjectId_fkey" FOREIGN KEY ("catalogueSubjectId") REFERENCES "catalogue_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The national lists (generated from packages/shared/src/curriculum/catalogue.ts and pathways.ts)
INSERT INTO "catalogue_subjects" ("id", "code", "name", "groupName", "groupNumber", "stages", "periodsPerWeek", "compulsoryOLevel", "sortOrder", "updatedAt") VALUES
  ('cat_eng', 'ENG', 'English Language', 'Language and Literature', 1, ARRAY['UPPER_PRIMARY', 'O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":6,"A_LEVEL":6}'::jsonb, true, 1, CURRENT_TIMESTAMP),
  ('cat_lit', 'LIT', 'Literature in English', 'Language and Literature', 1, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":7.5}'::jsonb, false, 2, CURRENT_TIMESTAMP),
  ('cat_zl', 'ZL', 'Zambian Languages', 'Language and Literature', 1, ARRAY['UPPER_PRIMARY', 'O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":7.5}'::jsonb, false, 3, CURRENT_TIMESTAMP),
  ('cat_lzl', 'LZL', 'Literature in Zambian Languages', 'Language and Literature', 1, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":7.5}'::jsonb, false, 4, CURRENT_TIMESTAMP),
  ('cat_fre', 'FRE', 'French', 'Language and Literature', 1, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":4.5}'::jsonb, false, 5, CURRENT_TIMESTAMP),
  ('cat_chi', 'CHI', 'Chinese', 'Language and Literature', 1, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":4.5}'::jsonb, false, 6, CURRENT_TIMESTAMP),
  ('cat_por', 'POR', 'Portuguese', 'Language and Literature', 1, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":4.5}'::jsonb, false, 7, CURRENT_TIMESTAMP),
  ('cat_swa', 'SWA', 'Swahili', 'Language and Literature', 1, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":4.5}'::jsonb, false, 8, CURRENT_TIMESTAMP),
  ('cat_math', 'MATH', 'Mathematics', 'Mathematics', 2, ARRAY['UPPER_PRIMARY', 'O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":6,"A_LEVEL":12}'::jsonb, true, 9, CURRENT_TIMESTAMP),
  ('cat_geo', 'GEO', 'Geography', 'Social Sciences', 3, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":9}'::jsonb, false, 10, CURRENT_TIMESTAMP),
  ('cat_hist', 'HIST', 'History', 'Social Sciences', 3, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":6}'::jsonb, false, 11, CURRENT_TIMESTAMP),
  ('cat_re', 'RE', 'Religious Education', 'Social Sciences', 3, ARRAY['O_LEVEL']::"YearStage"[], '{"O_LEVEL":5}'::jsonb, false, 12, CURRENT_TIMESTAMP),
  ('cat_rs', 'RS', 'Religious Studies', 'Social Sciences', NULL, ARRAY['A_LEVEL']::"YearStage"[], '{"A_LEVEL":6}'::jsonb, false, 13, CURRENT_TIMESTAMP),
  ('cat_civic', 'CIVIC', 'Civic Education', 'Social Sciences', 3, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":5,"A_LEVEL":6}'::jsonb, true, 14, CURRENT_TIMESTAMP),
  ('cat_econ', 'ECON', 'Economics', 'Social Sciences', NULL, ARRAY['A_LEVEL']::"YearStage"[], '{"A_LEVEL":6}'::jsonb, false, 15, CURRENT_TIMESTAMP),
  ('cat_agric', 'AGRIC', 'Agricultural Science', 'Natural Sciences', 4, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 16, CURRENT_TIMESTAMP),
  ('cat_bio', 'BIO', 'Biology', 'Natural Sciences', 4, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":6,"A_LEVEL":12}'::jsonb, false, 17, CURRENT_TIMESTAMP),
  ('cat_chem', 'CHEM', 'Chemistry', 'Natural Sciences', 4, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":6,"A_LEVEL":12}'::jsonb, false, 18, CURRENT_TIMESTAMP),
  ('cat_phy', 'PHY', 'Physics', 'Natural Sciences', 4, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":6,"A_LEVEL":12}'::jsonb, false, 19, CURRENT_TIMESTAMP),
  ('cat_mus', 'MUS', 'Music', 'Performing and Creative Arts', 5, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 20, CURRENT_TIMESTAMP),
  ('cat_art', 'ART', 'Art and Design', 'Performing and Creative Arts', 5, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 21, CURRENT_TIMESTAMP),
  ('cat_fash', 'FASH', 'Fashion and Fabrics', 'Home Economics and Hospitality', 6, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 22, CURRENT_TIMESTAMP),
  ('cat_food', 'FOOD', 'Food and Nutrition', 'Home Economics and Hospitality', 6, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 23, CURRENT_TIMESTAMP),
  ('cat_hosp', 'HOSP', 'Hospitality Management', 'Home Economics and Hospitality', 6, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 24, CURRENT_TIMESTAMP),
  ('cat_tt', 'TT', 'Travel and Tourism', 'Home Economics and Hospitality', 6, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 25, CURRENT_TIMESTAMP),
  ('cat_poa', 'POA', 'Principles of Accounts', 'Business and Finance', 7, ARRAY['O_LEVEL']::"YearStage"[], '{"O_LEVEL":5}'::jsonb, false, 26, CURRENT_TIMESTAMP),
  ('cat_comm', 'COMM', 'Commerce', 'Business and Finance', 7, ARRAY['O_LEVEL']::"YearStage"[], '{"O_LEVEL":5}'::jsonb, false, 27, CURRENT_TIMESTAMP),
  ('cat_bs', 'BS', 'Business Studies', 'Business and Finance', NULL, ARRAY['A_LEVEL']::"YearStage"[], '{"A_LEVEL":6}'::jsonb, false, 28, CURRENT_TIMESTAMP),
  ('cat_acc', 'ACC', 'Accounting', 'Business and Finance', NULL, ARRAY['A_LEVEL']::"YearStage"[], '{"A_LEVEL":6}'::jsonb, false, 29, CURRENT_TIMESTAMP),
  ('cat_cs', 'CS', 'Computer Science', 'Technology', 8, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 30, CURRENT_TIMESTAMP),
  ('cat_ict', 'ICT', 'Information and Communication Technology', 'Technology', 8, ARRAY['O_LEVEL']::"YearStage"[], '{"O_LEVEL":5}'::jsonb, false, 31, CURRENT_TIMESTAMP),
  ('cat_dt', 'DT', 'Design and Technology', 'Technology', 8, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 32, CURRENT_TIMESTAMP),
  ('cat_pe', 'PE', 'Physical Education', 'Physical Education and Sports', 9, ARRAY['O_LEVEL', 'A_LEVEL']::"YearStage"[], '{"O_LEVEL":12,"A_LEVEL":12}'::jsonb, false, 33, CURRENT_TIMESTAMP),
  ('cat_brl', 'BRL', 'Braille', 'Other', NULL, ARRAY['O_LEVEL']::"YearStage"[], '{"O_LEVEL":5}'::jsonb, false, 34, CURRENT_TIMESTAMP),
  ('cat_sci', 'SCI', 'Science', 'Early childhood and primary learning areas', NULL, ARRAY['UPPER_PRIMARY']::"YearStage"[], NULL, false, 35, CURRENT_TIMESTAMP),
  ('cat_sst', 'SST', 'Social Studies', 'Early childhood and primary learning areas', NULL, ARRAY['UPPER_PRIMARY']::"YearStage"[], NULL, false, 36, CURRENT_TIMESTAMP),
  ('cat_ts', 'TS', 'Technology Studies', 'Early childhood and primary learning areas', NULL, ARRAY['UPPER_PRIMARY']::"YearStage"[], NULL, false, 37, CURRENT_TIMESTAMP),
  ('cat_exa', 'EXA', 'Expressive Arts', 'Early childhood and primary learning areas', NULL, ARRAY['UPPER_PRIMARY']::"YearStage"[], NULL, false, 38, CURRENT_TIMESTAMP),
  ('cat_he', 'HE', 'Home Economics', 'Early childhood and primary learning areas', NULL, ARRAY['UPPER_PRIMARY']::"YearStage"[], NULL, false, 39, CURRENT_TIMESTAMP),
  ('cat_litlang', 'LITLANG', 'Literacy and Language', 'Early childhood and primary learning areas', NULL, ARRAY['LOWER_PRIMARY']::"YearStage"[], NULL, false, 40, CURRENT_TIMESTAMP),
  ('cat_mathsci', 'MATHSCI', 'Mathematics and Science', 'Early childhood and primary learning areas', NULL, ARRAY['LOWER_PRIMARY']::"YearStage"[], NULL, false, 41, CURRENT_TIMESTAMP),
  ('cat_cts', 'CTS', 'Creative and Technology Studies', 'Early childhood and primary learning areas', NULL, ARRAY['ECE', 'LOWER_PRIMARY']::"YearStage"[], NULL, false, 42, CURRENT_TIMESTAMP),
  ('cat_prelit', 'PRELIT', 'Pre-Literacy and Language', 'Early childhood and primary learning areas', NULL, ARRAY['ECE']::"YearStage"[], NULL, false, 43, CURRENT_TIMESTAMP),
  ('cat_premath', 'PREMATH', 'Pre-Mathematics and Science', 'Early childhood and primary learning areas', NULL, ARRAY['ECE']::"YearStage"[], NULL, false, 44, CURRENT_TIMESTAMP);

INSERT INTO "pathways" ("id", "code", "name", "stage", "rules", "sortOrder", "updatedAt") VALUES
  ('pw_ol_natsci', 'OL_NATSCI', 'Natural Sciences (STEM)', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC","BIO","CHEM","PHY"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"}],"choose":[],"minSubjects":6,"maxSubjects":7}'::jsonb, 1, CURRENT_TIMESTAMP),
  ('pw_ol_tech', 'OL_TECH', 'Technology (STEM)', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC","PHY","CHEM"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"}],"choose":[{"count":1,"from":["CS","DT"],"label":"Computer Science or Design and Technology"}],"minSubjects":6,"maxSubjects":7}'::jsonb, 2, CURRENT_TIMESTAMP),
  ('pw_ol_agric', 'OL_AGRIC', 'Agriculture (STEM)', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC","AGRIC","CHEM","PHY"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"}],"choose":[],"minSubjects":6,"maxSubjects":7}'::jsonb, 3, CURRENT_TIMESTAMP),
  ('pw_ol_heh', 'OL_HEH', 'Home Economics and Hospitality', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC","BIO"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"},{"code":"CHEM","unless":"TT"}],"choose":[{"count":1,"from":["FASH","FOOD","HOSP","TT"],"label":"one Home Economics and Hospitality subject"},{"count":1,"from":["FRE","CHI","POR","SWA"],"label":"one foreign language"}],"minSubjects":6,"maxSubjects":8,"notes":["Chemistry is optional for Travel and Tourism learners."]}'::jsonb, 4, CURRENT_TIMESTAMP),
  ('pw_ol_socsci', 'OL_SOCSCI', 'Social Sciences', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"}],"choose":[{"count":1,"from":["GEO","HIST","RE"],"label":"one more Social Sciences subject"},{"count":1,"from":["LIT","ZL","LZL","FRE","CHI","POR","SWA"],"label":"one more Language and Literature subject"},{"count":1,"from":["BIO","CHEM","PHY"],"label":"one Natural Science (not Agricultural Science)"}],"minSubjects":6,"maxSubjects":7}'::jsonb, 5, CURRENT_TIMESTAMP),
  ('pw_ol_busfin', 'OL_BUSFIN', 'Business and Finance', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC","POA","COMM"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"}],"choose":[{"count":1,"from":["BIO","CHEM","PHY"],"label":"one Natural Science (not Agricultural Science)"}],"minSubjects":6,"maxSubjects":7}'::jsonb, 6, CURRENT_TIMESTAMP),
  ('pw_ol_pca', 'OL_PCA', 'Performing and Creative Arts', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC","ZL"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"}],"choose":[{"count":1,"from":["MUS","ART"],"label":"Music or Art and Design"},{"count":1,"from":["LIT","LZL"],"label":"Literature in English or in a Zambian Language"}],"minSubjects":6,"maxSubjects":7}'::jsonb, 7, CURRENT_TIMESTAMP),
  ('pw_ol_pes', 'OL_PES', 'Physical Education and Sports', 'O_LEVEL', '{"compulsory":["ENG","MATH","CIVIC","BIO","PE"],"compulsoryUnlessTaking":[{"code":"ICT","unless":"CS"}],"choose":[{"count":1,"from":["GEO","HIST","RE","CHEM","PHY"],"label":"one Social Science or Natural Science (not Agricultural Science)"}],"minSubjects":6,"maxSubjects":7}'::jsonb, 8, CURRENT_TIMESTAMP),
  ('pw_al_stem', 'AL_STEM', 'STEM', 'A_LEVEL', '{"compulsory":[],"choose":[],"minSubjects":3,"maxSubjects":4,"notes":["The framework names the A-level pathways but not their subject combinations; only the 3–4 subject limit is checked."]}'::jsonb, 9, CURRENT_TIMESTAMP),
  ('pw_al_ssl', 'AL_SSL', 'Social Science and Languages', 'A_LEVEL', '{"compulsory":[],"choose":[],"minSubjects":3,"maxSubjects":4,"notes":["The framework names the A-level pathways but not their subject combinations; only the 3–4 subject limit is checked."]}'::jsonb, 10, CURRENT_TIMESTAMP),
  ('pw_al_bus', 'AL_BUS', 'Business Studies', 'A_LEVEL', '{"compulsory":[],"choose":[],"minSubjects":3,"maxSubjects":4,"notes":["The framework names the A-level pathways but not their subject combinations; only the 3–4 subject limit is checked."]}'::jsonb, 11, CURRENT_TIMESTAMP),
  ('pw_al_pes', 'AL_PES', 'Physical Education and Sports', 'A_LEVEL', '{"compulsory":[],"choose":[],"minSubjects":3,"maxSubjects":4,"notes":["The framework names the A-level pathways but not their subject combinations; only the 3–4 subject limit is checked."]}'::jsonb, 12, CURRENT_TIMESTAMP),
  ('pw_al_pca', 'AL_PCA', 'Performing and Creative Arts', 'A_LEVEL', '{"compulsory":[],"choose":[],"minSubjects":3,"maxSubjects":4,"notes":["The framework names the A-level pathways but not their subject combinations; only the 3–4 subject limit is checked."]}'::jsonb, 13, CURRENT_TIMESTAMP);

-- Link existing school subjects to the catalogue where the name is the same (or a common
-- older name). Unmatched subjects stay as the school's own local subjects.
UPDATE "subjects" s SET "catalogueSubjectId" = c."id"
  FROM "catalogue_subjects" c
  WHERE s."catalogueSubjectId" IS NULL
    AND (
      lower(trim(s."name")) = lower(c."name")
      OR (c."code" = 'ENG' AND lower(trim(s."name")) = 'english')
      OR (c."code" = 'ICT' AND lower(trim(s."name")) IN ('ict', 'computer studies'))
      OR (c."code" = 'ZL' AND lower(trim(s."name")) IN ('zambian language', 'cinyanja', 'icibemba', 'silozi', 'chitonga', 'kiikaonde', 'lunda', 'luvale'))
    );

-- ---------------------------------------------------------------------------------------------
-- 3. Learner numbers
-- ---------------------------------------------------------------------------------------------
-- Same rules as packages/shared/src/curriculum/learner-number.ts: 31 characters (no 0/O, 1/I,
-- L), check character = sum of (position × value) mod 31 over the year digits and the 7.
-- The database fills the number in for every new learner (column default), whichever screen,
-- import or script creates them; the year is the year of first registration in the system.
CREATE FUNCTION "emis_learner_check"(year_digits TEXT, body TEXT) RETURNS TEXT AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  total INTEGER := 0;
  i INTEGER;
BEGIN
  FOR i IN 1..2 LOOP
    total := total + i * substr(year_digits, i, 1)::INTEGER;
  END LOOP;
  FOR i IN 1..7 LOOP
    total := total + (i + 2) * (strpos(alphabet, substr(body, i, 1)) - 1);
  END LOOP;
  RETURN substr(alphabet, (total % 31) + 1, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE FUNCTION "emis_new_learner_number"(registered_at TIMESTAMP DEFAULT now()) RETURNS TEXT AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  yy TEXT := to_char(registered_at, 'YY');
  body TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..7 LOOP
    body := body || substr(alphabet, 1 + floor(random() * 31)::INTEGER, 1);
  END LOOP;
  RETURN 'ZM' || yy || '-' || body || '-' || "emis_learner_check"(yy, body);
END;
$$ LANGUAGE plpgsql VOLATILE;

GRANT EXECUTE ON FUNCTION "emis_learner_check"(TEXT, TEXT) TO emis_app;
GRANT EXECUTE ON FUNCTION "emis_new_learner_number"(TIMESTAMP) TO emis_app;

-- Existing learners: numbered by the year their record was created. A clash (about one in
-- 27 billion) just draws again.
ALTER TABLE "students" ADD COLUMN "learnerNumber" TEXT;
DO $$
DECLARE
  st RECORD;
  candidate TEXT;
BEGIN
  FOR st IN SELECT "id", "createdAt" FROM "students" WHERE "learnerNumber" IS NULL LOOP
    LOOP
      candidate := "emis_new_learner_number"(st."createdAt");
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "students" WHERE "learnerNumber" = candidate);
    END LOOP;
    UPDATE "students" SET "learnerNumber" = candidate WHERE "id" = st."id";
  END LOOP;
END $$;

ALTER TABLE "students" ALTER COLUMN "learnerNumber" SET NOT NULL;
ALTER TABLE "students" ALTER COLUMN "learnerNumber" SET DEFAULT "emis_new_learner_number"();
CREATE UNIQUE INDEX "students_learnerNumber_key" ON "students"("learnerNumber");

-- ---------------------------------------------------------------------------------------------
-- 4. Promotions and report cards: year-level names
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "student_promotions" ALTER COLUMN "fromGradeLevel" DROP NOT NULL;
ALTER TABLE "student_promotions"
  ADD COLUMN "fromGradeId" TEXT,
  ADD COLUMN "toGradeId" TEXT,
  ADD COLUMN "fromGradeName" TEXT,
  ADD COLUMN "toGradeName" TEXT;
UPDATE "student_promotions" SET
  "fromGradeName" = 'Grade ' || replace("fromGradeLevel"::TEXT, 'GRADE_', ''),
  "toGradeName" = CASE WHEN "toGradeLevel" IS NULL THEN NULL
                       ELSE 'Grade ' || replace("toGradeLevel"::TEXT, 'GRADE_', '') END
  WHERE "fromGradeLevel" IS NOT NULL;

ALTER TABLE "report_cards" ADD COLUMN "nextGradeName" TEXT;
UPDATE "report_cards" SET "nextGradeName" = 'Grade ' || replace("nextGrade"::TEXT, 'GRADE_', '')
  WHERE "nextGrade" IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 5. Period length per stage
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "timetable_configurations" ADD COLUMN "stagePeriodDurations" JSONB;
