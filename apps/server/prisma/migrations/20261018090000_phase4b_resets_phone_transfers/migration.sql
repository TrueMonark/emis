-- Phase 4b: "Forgot password?" requests, signing in with a mobile number, and transfers.

-- ---------------------------------------------------------------------------------------------
-- Signing in with a mobile number. One account per number.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- Fill it from the teacher profiles, written the same way as the app writes it (+260XXXXXXXXX).
-- A number shared by two or more profiles is left out (those people sign in with email until it
-- is sorted out): one number can only open one account.
WITH normalised AS (
  SELECT p."userId",
         CASE
           WHEN regexp_replace(p."phone", '[\s-]', '', 'g') ~ '^\+260[0-9]{9}$'
             THEN regexp_replace(p."phone", '[\s-]', '', 'g')
           WHEN regexp_replace(p."phone", '[\s-]', '', 'g') ~ '^260[0-9]{9}$'
             THEN '+' || regexp_replace(p."phone", '[\s-]', '', 'g')
           WHEN regexp_replace(p."phone", '[\s-]', '', 'g') ~ '^0[0-9]{9}$'
             THEN '+260' || substr(regexp_replace(p."phone", '[\s-]', '', 'g'), 2)
         END AS "phone"
  FROM "teacher_profiles" p
),
unique_numbers AS (
  SELECT "phone" FROM normalised WHERE "phone" IS NOT NULL GROUP BY "phone" HAVING count(*) = 1
)
UPDATE "users" u
SET "phone" = n."phone"
FROM normalised n
JOIN unique_numbers un ON un."phone" = n."phone"
WHERE u."id" = n."userId";

-- ---------------------------------------------------------------------------------------------
-- Transfers: a PENDING membership at the new school, confirmed by the old school or the DEBS.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "school_memberships" ADD COLUMN "requestedById" TEXT;
ALTER TABLE "school_memberships" ADD COLUMN "requestedAt" TIMESTAMP(3);
ALTER TABLE "school_memberships" ADD COLUMN "confirmedById" TEXT;
ALTER TABLE "school_memberships" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "school_memberships" ADD COLUMN "endReason" TEXT;

-- At most one transfer waiting per person.
CREATE UNIQUE INDEX "school_memberships_one_pending" ON "school_memberships"("userId") WHERE "status" = 'PENDING';

-- ---------------------------------------------------------------------------------------------
-- "Forgot password?" requests.
-- ---------------------------------------------------------------------------------------------
CREATE TYPE "PasswordResetStatus" AS ENUM ('OPEN', 'RESOLVED', 'DECLINED');

CREATE TABLE "password_reset_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PasswordResetStatus" NOT NULL DEFAULT 'OPEN',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handlerSchoolId" TEXT,
    "handlerOfficeId" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id"),
    -- Exactly one of the two says who handles it.
    CONSTRAINT "password_reset_requests_one_handler" CHECK (("handlerSchoolId" IS NULL) <> ("handlerOfficeId" IS NULL))
);
CREATE INDEX "password_reset_requests_userId_status_idx" ON "password_reset_requests"("userId", "status");
CREATE INDEX "password_reset_requests_handlerSchoolId_status_idx" ON "password_reset_requests"("handlerSchoolId", "status");
CREATE INDEX "password_reset_requests_handlerOfficeId_status_idx" ON "password_reset_requests"("handlerOfficeId", "status");
-- At most one open request per person (asking again doesn't pile up requests).
CREATE UNIQUE INDEX "password_reset_requests_one_open" ON "password_reset_requests"("userId") WHERE "status" = 'OPEN';
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A national table: requests are made before anyone is signed in, and handled by schools or
-- offices. Who may see and handle which request is decided in passwordReset.service.ts.
GRANT SELECT, INSERT, UPDATE ON "password_reset_requests" TO emis_app;
