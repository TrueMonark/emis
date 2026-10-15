-- Register cover: the class teacher's morning register handed to another teacher for chosen days.

-- CreateTable
CREATE TABLE "register_covers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_covers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "register_covers_schoolId_idx" ON "register_covers"("schoolId");

-- CreateIndex
CREATE INDEX "register_covers_classId_startDate_endDate_idx" ON "register_covers"("classId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "register_covers_teacherId_startDate_endDate_idx" ON "register_covers"("teacherId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "register_covers" ADD CONSTRAINT "register_covers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_covers" ADD CONSTRAINT "register_covers_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_covers" ADD CONSTRAINT "register_covers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Each school only sees its own covers (same rule as every school-owned table).
GRANT SELECT, INSERT, UPDATE, DELETE ON "register_covers" TO emis_app;
ALTER TABLE "register_covers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "register_covers"
  USING ("schoolId" = current_setting('app.school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.school_id', true));
