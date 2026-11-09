-- Phase 8 (2 November 2026): announcements (circulars) from HQ, the PEOs and the DEBS offices to
-- their schools, with private attachments, read receipts and optional acknowledgement.

CREATE TYPE "AnnouncementAudience" AS ENUM ('LEADERS', 'ALL_STAFF');

CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" TEXT,
    "withdrawReason" TEXT,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_officeId_publishedAt_idx" ON "announcements"("officeId", "publishedAt");
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "education_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- National table: who may read it is decided by the app. Never deleted (withdrawn instead).
GRANT SELECT, INSERT, UPDATE ON "announcements" TO emis_app;
REVOKE DELETE, TRUNCATE ON "announcements" FROM emis_app;

CREATE TABLE "announcement_attachments" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "announcement_attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "announcement_attachments_storageKey_key" ON "announcement_attachments"("storageKey");
CREATE INDEX "announcement_attachments_announcementId_idx" ON "announcement_attachments"("announcementId");
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
GRANT SELECT, INSERT ON "announcement_attachments" TO emis_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "announcement_attachments" FROM emis_app;

CREATE TABLE "announcement_reads" (
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("announcementId", "userId")
);
CREATE INDEX "announcement_reads_announcementId_schoolId_idx" ON "announcement_reads"("announcementId", "schoolId");
CREATE INDEX "announcement_reads_userId_idx" ON "announcement_reads"("userId");
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Added when someone opens it; updated once when they acknowledge.
GRANT SELECT, INSERT, UPDATE ON "announcement_reads" TO emis_app;
REVOKE DELETE, TRUNCATE ON "announcement_reads" FROM emis_app;
