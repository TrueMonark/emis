-- Phase 4a: education office accounts (HQ → PEO → DEBS), the account chain, first-time school
-- setup, and an audit log.

-- Accounts without a teacher profile (office staff) need a name to show.
ALTER TABLE "users" ADD COLUMN "displayName" TEXT;

-- A school created from now on starts in setup; schools that already exist are set up.
ALTER TABLE "schools" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);
UPDATE "schools" SET "setupCompletedAt" = CURRENT_TIMESTAMP WHERE "setupCompletedAt" IS NULL;

CREATE TYPE "OfficeRole" AS ENUM ('OFFICE_HEAD', 'OFFICER');

CREATE TABLE "office_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "role" "OfficeRole" NOT NULL,
    "title" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "office_memberships_userId_officeId_key" ON "office_memberships"("userId", "officeId");
CREATE INDEX "office_memberships_officeId_status_idx" ON "office_memberships"("officeId", "status");
-- At most one ACTIVE office role per person.
CREATE UNIQUE INDEX "office_memberships_one_active" ON "office_memberships"("userId") WHERE "status" = 'ACTIVE';
ALTER TABLE "office_memberships" ADD CONSTRAINT "office_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "office_memberships" ADD CONSTRAINT "office_memberships_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "education_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "schoolId" TEXT,
    "officeId" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_log_officeId_at_idx" ON "audit_log"("officeId", "at");
CREATE INDEX "audit_log_schoolId_at_idx" ON "audit_log"("schoolId", "at");
CREATE INDEX "audit_log_actorUserId_at_idx" ON "audit_log"("actorUserId", "at");

-- Both are national tables (read before a school is known, and across schools by offices).
-- The audit log can be added to and read, never changed or deleted by the app.
GRANT SELECT, INSERT, UPDATE, DELETE ON "office_memberships" TO emis_app;
GRANT SELECT, INSERT ON "audit_log" TO emis_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM emis_app;
