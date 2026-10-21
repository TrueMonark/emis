-- School fees (requested 19 October 2026): the Finance role, the fees switch per school, and fees,
-- charges, discounts, payment plans, payments with numbered receipts. Amounts are whole ngwee.

-- The Finance role (bursar / accounts clerk): school fees and money only.
ALTER TYPE "Role" ADD VALUE 'FINANCE';

-- The fees module: on for private schools, and wherever the DEBS switches it on.
ALTER TABLE "schools" ADD COLUMN "feesEnabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "schools" SET "feesEnabled" = true WHERE "category" = 'PRIVATE';

CREATE TYPE "FeeCategory" AS ENUM ('TUITION', 'BOARDING', 'TRANSPORT', 'MEALS', 'EXAMINATION', 'UNIFORM', 'BOOKS', 'DEVELOPMENT', 'TRIP', 'EVENT', 'OTHER');
CREATE TYPE "FeeTargetKind" AS ENUM ('ALL', 'YEAR_LEVELS', 'CLASSES', 'LEARNERS');
CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'BANK_DEPOSIT', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'OTHER');
CREATE TYPE "FeePaymentStatus" AS ENUM ('RECORDED', 'VOIDED');
CREATE TYPE "FeeDiscountKind" AS ENUM ('PERCENT', 'AMOUNT');

CREATE TABLE "fees" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "name" TEXT NOT NULL,
    "category" "FeeCategory" NOT NULL,
    "description" TEXT,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "amountNgwee" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "targetKind" "FeeTargetKind" NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fees_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fees_amount_positive" CHECK ("amountNgwee" > 0)
);
CREATE INDEX "fees_schoolId_idx" ON "fees"("schoolId");
CREATE INDEX "fees_academicYearId_termId_idx" ON "fees"("academicYearId", "termId");

CREATE TABLE "fee_targets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "feeId" TEXT NOT NULL,
    "gradeId" TEXT,
    "classId" TEXT,
    CONSTRAINT "fee_targets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fee_targets_schoolId_idx" ON "fee_targets"("schoolId");
CREATE INDEX "fee_targets_feeId_idx" ON "fee_targets"("feeId");

CREATE TABLE "fee_instalments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "feeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "percent" INTEGER NOT NULL,
    CONSTRAINT "fee_instalments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fee_instalments_percent_range" CHECK ("percent" BETWEEN 1 AND 100)
);
CREATE INDEX "fee_instalments_schoolId_idx" ON "fee_instalments"("schoolId");
CREATE INDEX "fee_instalments_feeId_idx" ON "fee_instalments"("feeId");

CREATE TABLE "fee_charges" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "feeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "originalNgwee" INTEGER NOT NULL,
    "discountNgwee" INTEGER NOT NULL DEFAULT 0,
    "amountNgwee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_charges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fee_charges_amounts" CHECK ("discountNgwee" >= 0 AND "amountNgwee" >= 0 AND "amountNgwee" = "originalNgwee" - "discountNgwee")
);
CREATE UNIQUE INDEX "fee_charges_feeId_studentId_key" ON "fee_charges"("feeId", "studentId");
CREATE INDEX "fee_charges_schoolId_idx" ON "fee_charges"("schoolId");
CREATE INDEX "fee_charges_studentId_idx" ON "fee_charges"("studentId");

CREATE TABLE "fee_discounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FeeDiscountKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "categories" "FeeCategory"[],
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "fee_discounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fee_discounts_value" CHECK ("value" > 0 AND ("kind" <> 'PERCENT' OR "value" <= 100))
);
CREATE INDEX "fee_discounts_schoolId_idx" ON "fee_discounts"("schoolId");
CREATE INDEX "fee_discounts_studentId_academicYearId_idx" ON "fee_discounts"("studentId", "academicYearId");

CREATE TABLE "fee_payments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "studentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amountNgwee" INTEGER NOT NULL,
    "method" "FeePaymentMethod" NOT NULL,
    "reference" TEXT,
    "payerName" TEXT,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "feeId" TEXT,
    "notes" TEXT,
    "status" "FeePaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "voidReason" TEXT,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "receivedById" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fee_payments_amount_positive" CHECK ("amountNgwee" > 0)
);
CREATE UNIQUE INDEX "fee_payments_schoolId_receiptNumber_key" ON "fee_payments"("schoolId", "receiptNumber");
CREATE INDEX "fee_payments_schoolId_idx" ON "fee_payments"("schoolId");
CREATE INDEX "fee_payments_studentId_idx" ON "fee_payments"("studentId");
CREATE INDEX "fee_payments_paidOn_idx" ON "fee_payments"("paidOn");

CREATE TABLE "fee_receipt_counters" (
    "schoolId" TEXT NOT NULL DEFAULT current_setting('app.school_id'::text, true),
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "fee_receipt_counters_pkey" PRIMARY KEY ("schoolId", "year")
);

ALTER TABLE "fees" ADD CONSTRAINT "fees_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fees" ADD CONSTRAINT "fees_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fees" ADD CONSTRAINT "fees_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_targets" ADD CONSTRAINT "fee_targets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_targets" ADD CONSTRAINT "fee_targets_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_targets" ADD CONSTRAINT "fee_targets_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_targets" ADD CONSTRAINT "fee_targets_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_instalments" ADD CONSTRAINT "fee_instalments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_instalments" ADD CONSTRAINT "fee_instalments_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every fees table is school-owned: each school sees only its own rows.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fees', 'fee_targets', 'fee_instalments', 'fee_charges', 'fee_discounts', 'fee_payments', 'fee_receipt_counters'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "school_isolation" ON %I
      USING ("schoolId" = current_setting('app.school_id', true))
      WITH CHECK ("schoolId" = current_setting('app.school_id', true))$p$, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO emis_app', t);
  END LOOP;
END $$;

-- Payments are money records: the app can void them (status), never delete them.
REVOKE DELETE, TRUNCATE ON "fee_payments" FROM emis_app;
