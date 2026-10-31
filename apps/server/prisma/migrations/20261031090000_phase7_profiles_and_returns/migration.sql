-- Phase 7 (31 October 2026): school profile indicators for the DEBS / PEO / HQ offices, school
-- facilities, and returns (office opens a round → school drafts and submits → DEBS approves or
-- sends back).

-- Safe to run again after a failed attempt (Prisma doesn't wrap a migration in a transaction, so
-- a failure part-way leaves the first objects behind). Nothing here existed before Phase 7.
DROP FUNCTION IF EXISTS emis_school_indicators(text[], date, date, date[]);
DROP FUNCTION IF EXISTS emis_school_enrolment_by_level(text[]);
DROP TABLE IF EXISTS "school_return_events", "school_returns", "return_rounds", "school_facilities" CASCADE;
DROP TYPE IF EXISTS "ReturnEventAction", "SchoolReturnStatus", "ReturnRoundStatus", "PowerSource", "WaterSource";

-- ── School facilities (national table, one row per school) ──────────────────────────────────
CREATE TYPE "WaterSource" AS ENUM ('PIPED', 'BOREHOLE', 'PROTECTED_WELL', 'UNPROTECTED_WELL', 'SURFACE_WATER', 'RAINWATER', 'NONE');
CREATE TYPE "PowerSource" AS ENUM ('GRID', 'SOLAR', 'GENERATOR', 'NONE');

CREATE TABLE "school_facilities" (
    "schoolId" TEXT NOT NULL,
    "classrooms" INTEGER,
    "desks" INTEGER,
    "toiletsBoys" INTEGER,
    "toiletsGirls" INTEGER,
    "toiletsStaff" INTEGER,
    "waterSource" "WaterSource",
    "power" "PowerSource",
    "internet" BOOLEAN,
    "notes" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_facilities_pkey" PRIMARY KEY ("schoolId"),
    CONSTRAINT "school_facilities_counts" CHECK (
      coalesce("classrooms", 0) >= 0 AND coalesce("desks", 0) >= 0 AND coalesce("toiletsBoys", 0) >= 0
      AND coalesce("toiletsGirls", 0) >= 0 AND coalesce("toiletsStaff", 0) >= 0)
);
ALTER TABLE "school_facilities" ADD CONSTRAINT "school_facilities_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Read by the school and the offices over it; written by the school's head/deputy (checked in the service).
GRANT SELECT, INSERT, UPDATE ON "school_facilities" TO emis_app;
REVOKE DELETE, TRUNCATE ON "school_facilities" FROM emis_app;

-- ── Return rounds and school returns (national tables: figures only, no learner names) ──────
CREATE TYPE "ReturnRoundStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "SchoolReturnStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED');
CREATE TYPE "ReturnEventAction" AS ENUM ('STARTED', 'REFRESHED', 'SAVED', 'SUBMITTED', 'RETURNED', 'APPROVED', 'REOPENED');

CREATE TABLE "return_rounds" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "officeId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "ReturnRoundStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "return_rounds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "return_rounds_period" CHECK ("periodEnd" >= "periodStart")
);
CREATE INDEX "return_rounds_officeId_idx" ON "return_rounds"("officeId");
ALTER TABLE "return_rounds" ADD CONSTRAINT "return_rounds_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "education_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
GRANT SELECT, INSERT, UPDATE ON "return_rounds" TO emis_app;
REVOKE DELETE, TRUNCATE ON "return_rounds" FROM emis_app;

CREATE TABLE "school_returns" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "SchoolReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "figures" JSONB NOT NULL,
    "facilities" JSONB NOT NULL,
    "figuresAt" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_returns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_returns_roundId_schoolId_key" ON "school_returns"("roundId", "schoolId");
CREATE INDEX "school_returns_schoolId_idx" ON "school_returns"("schoolId");
ALTER TABLE "school_returns" ADD CONSTRAINT "school_returns_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "return_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_returns" ADD CONSTRAINT "school_returns_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
GRANT SELECT, INSERT, UPDATE ON "school_returns" TO emis_app;
REVOKE DELETE, TRUNCATE ON "school_returns" FROM emis_app;

CREATE TABLE "school_return_events" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "action" "ReturnEventAction" NOT NULL,
    "byUserId" TEXT,
    "comment" TEXT,
    "figures" JSONB,
    "facilities" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_return_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_return_events_returnId_at_idx" ON "school_return_events"("returnId", "at");
ALTER TABLE "school_return_events" ADD CONSTRAINT "school_return_events_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "school_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- The history is only ever added to.
GRANT SELECT, INSERT ON "school_return_events" TO emis_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "school_return_events" FROM emis_app;

-- ── Aggregate figures across schools ────────────────────────────────────────────────────────
-- The offices see figures (counts), never learner records. These two functions are the only way
-- the app reads across schools: SECURITY DEFINER (they run as the database owner, so row-level
-- security doesn't hide other schools' rows) and they return nothing but counts per school.
-- The app calls them only for schools the caller may see (offices: their area, checked in
-- `indicatorsService`; a school: itself).

-- Counts per school. Period figures (attendance, registers, admissions, leavers) are between
-- p_from and p_to; school days exclude weekends, p_holidays (the national public holidays,
-- worked out by the app) and the school's own closures.
CREATE OR REPLACE FUNCTION emis_school_indicators(p_school_ids text[], p_from date, p_to date, p_holidays date[])
RETURNS TABLE (
  school_id text,
  learners_male int, learners_female int,
  new_male int, new_female int,
  left_male int, left_female int,
  repeaters_male int, repeaters_female int,
  orphans_male int, orphans_female int,
  vulnerable_male int, vulnerable_female int,
  special_needs_male int, special_needs_female int,
  teachers int, teachers_male int, teachers_female int,
  teachers_degree int, teachers_diploma int, teachers_certificate int,
  classes int,
  attendance_marks int, attendance_present int,
  register_class_days int, school_days int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH s AS (
    SELECT DISTINCT x AS id FROM unnest(p_school_ids) AS x
  ),
  days AS (
    SELECT d::date AS day
    FROM generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') AS d
    WHERE extract(isodow FROM d) < 6
      AND NOT (d::date = ANY (coalesce(p_holidays, '{}'::date[])))
  ),
  open_days AS (
    SELECT s.id AS school_id, days.day
    FROM s CROSS JOIN days
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_closures c
      WHERE c."schoolId" = s.id AND days.day BETWEEN c."startDate" AND c."endDate"
    )
  ),
  open_count AS (
    SELECT school_id, count(*) AS n FROM open_days GROUP BY school_id
  ),
  learners AS (
    SELECT st."schoolId" AS school_id,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND st.gender::text = 'MALE') AS learners_male,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND st.gender::text = 'FEMALE') AS learners_female,
      count(*) FILTER (WHERE st."admissionDate"::date BETWEEN p_from AND p_to AND st.gender::text = 'MALE') AS new_male,
      count(*) FILTER (WHERE st."admissionDate"::date BETWEEN p_from AND p_to AND st.gender::text = 'FEMALE') AS new_female,
      count(*) FILTER (WHERE st.status::text IN ('WITHDRAWN', 'TRANSFERRED') AND st."updatedAt"::date BETWEEN p_from AND p_to AND st.gender::text = 'MALE') AS left_male,
      count(*) FILTER (WHERE st.status::text IN ('WITHDRAWN', 'TRANSFERRED') AND st."updatedAt"::date BETWEEN p_from AND p_to AND st.gender::text = 'FEMALE') AS left_female,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND (st.vulnerability::text = 'ORPHAN' OR st."orphanType" IS NOT NULL) AND st.gender::text = 'MALE') AS orphans_male,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND (st.vulnerability::text = 'ORPHAN' OR st."orphanType" IS NOT NULL) AND st.gender::text = 'FEMALE') AS orphans_female,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND st.vulnerability::text = 'VULNERABLE_CHILD' AND st.gender::text = 'MALE') AS vulnerable_male,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND st.vulnerability::text = 'VULNERABLE_CHILD' AND st.gender::text = 'FEMALE') AS vulnerable_female,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND st.vulnerability::text = 'SPECIAL_NEEDS' AND st.gender::text = 'MALE') AS special_needs_male,
      count(*) FILTER (WHERE st.status::text = 'ACTIVE' AND st.vulnerability::text = 'SPECIAL_NEEDS' AND st.gender::text = 'FEMALE') AS special_needs_female
    FROM public.students st
    WHERE st."schoolId" = ANY (p_school_ids) AND st."deletedAt" IS NULL
    GROUP BY st."schoolId"
  ),
  repeaters AS (
    SELECT st."schoolId" AS school_id,
      count(DISTINCT st.id) FILTER (WHERE st.gender::text = 'MALE') AS repeaters_male,
      count(DISTINCT st.id) FILTER (WHERE st.gender::text = 'FEMALE') AS repeaters_female
    FROM public.student_promotions p
    JOIN public.students st ON st.id = p."studentId"
    WHERE p."schoolId" = ANY (p_school_ids)
      AND p.status::text = 'REPEATED'
      AND p."academicYear" = extract(year FROM p_to)::int
      AND st.status::text = 'ACTIVE' AND st."deletedAt" IS NULL
    GROUP BY st."schoolId"
  ),
  staff AS (
    SELECT m."schoolId" AS school_id,
      count(*) AS teachers,
      count(*) FILTER (WHERE tp.gender::text = 'MALE') AS teachers_male,
      count(*) FILTER (WHERE tp.gender::text = 'FEMALE') AS teachers_female,
      count(*) FILTER (WHERE tp.qualification::text IN ('DEGREE', 'MASTERS', 'DOCTORATE')) AS teachers_degree,
      count(*) FILTER (WHERE tp.qualification::text = 'DIPLOMA') AS teachers_diploma,
      count(*) FILTER (WHERE tp.qualification::text = 'CERTIFICATE') AS teachers_certificate
    FROM public.school_memberships m
    LEFT JOIN public.teacher_profiles tp ON tp."userId" = m."userId"
    WHERE m."schoolId" = ANY (p_school_ids)
      AND m.status::text = 'ACTIVE'
      AND m.role::text IN ('TEACHER', 'HEAD_TEACHER', 'DEPUTY_HEAD', 'ADMIN')
    GROUP BY m."schoolId"
  ),
  class_count AS (
    SELECT c."schoolId" AS school_id, count(*) AS classes
    FROM public.classes c
    WHERE c."schoolId" = ANY (p_school_ids) AND c.status::text = 'ACTIVE' AND c."deletedAt" IS NULL
    GROUP BY c."schoolId"
  ),
  att AS (
    SELECT a."schoolId" AS school_id,
      count(*) AS marks,
      count(*) FILTER (WHERE a.status::text IN ('PRESENT', 'LATE')) AS present,
      count(DISTINCT a."classId" || '|' || a."date"::date::text) AS class_days
    FROM public.attendance_records a
    JOIN open_days o ON o.school_id = a."schoolId" AND o.day = a."date"::date
    WHERE a."schoolId" = ANY (p_school_ids)
      AND a."date" >= p_from::timestamp AND a."date" < (p_to + 1)::timestamp
    GROUP BY a."schoolId"
  )
  SELECT s.id,
    coalesce(l.learners_male, 0)::int, coalesce(l.learners_female, 0)::int,
    coalesce(l.new_male, 0)::int, coalesce(l.new_female, 0)::int,
    coalesce(l.left_male, 0)::int, coalesce(l.left_female, 0)::int,
    coalesce(r.repeaters_male, 0)::int, coalesce(r.repeaters_female, 0)::int,
    coalesce(l.orphans_male, 0)::int, coalesce(l.orphans_female, 0)::int,
    coalesce(l.vulnerable_male, 0)::int, coalesce(l.vulnerable_female, 0)::int,
    coalesce(l.special_needs_male, 0)::int, coalesce(l.special_needs_female, 0)::int,
    coalesce(t.teachers, 0)::int, coalesce(t.teachers_male, 0)::int, coalesce(t.teachers_female, 0)::int,
    coalesce(t.teachers_degree, 0)::int, coalesce(t.teachers_diploma, 0)::int, coalesce(t.teachers_certificate, 0)::int,
    coalesce(cc.classes, 0)::int,
    coalesce(a.marks, 0)::int, coalesce(a.present, 0)::int,
    coalesce(a.class_days, 0)::int, coalesce(oc.n, 0)::int
  FROM s
  LEFT JOIN learners l ON l.school_id = s.id
  LEFT JOIN repeaters r ON r.school_id = s.id
  LEFT JOIN staff t ON t.school_id = s.id
  LEFT JOIN class_count cc ON cc.school_id = s.id
  LEFT JOIN att a ON a.school_id = s.id
  LEFT JOIN open_count oc ON oc.school_id = s.id;
END;
$$;

-- Learners in a class this year (the school's active academic year), per year level and sex.
CREATE OR REPLACE FUNCTION emis_school_enrolment_by_level(p_school_ids text[])
RETURNS TABLE (school_id text, grade_name text, stage text, seq int, male int, female int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT g."schoolId", g.name, g.stage::text, g.sequence,
    count(st.id) FILTER (WHERE st.gender::text = 'MALE')::int,
    count(st.id) FILTER (WHERE st.gender::text = 'FEMALE')::int
  FROM public.grades g
  LEFT JOIN public.classes c ON c."gradeId" = g.id
  LEFT JOIN public.student_class_enrollments e
    ON e."classId" = c.id
   AND e.status::text = 'ACTIVE'
   AND e."academicYearId" IN (SELECT y.id FROM public.academic_years y WHERE y."schoolId" = g."schoolId" AND y."isActive")
  LEFT JOIN public.students st
    ON st.id = e."studentId" AND st.status::text = 'ACTIVE' AND st."deletedAt" IS NULL
  WHERE g."schoolId" = ANY (p_school_ids)
  GROUP BY g."schoolId", g.id, g.name, g.stage, g.sequence
  ORDER BY g."schoolId", g.sequence;
END;
$$;

REVOKE ALL ON FUNCTION emis_school_indicators(text[], date, date, date[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION emis_school_enrolment_by_level(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION emis_school_indicators(text[], date, date, date[]) TO emis_app;
GRANT EXECUTE ON FUNCTION emis_school_enrolment_by_level(text[]) TO emis_app;
