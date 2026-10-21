"use client";

import { TransfersList } from "@/components/transfers/transfers-list";
import { useCurrentOffice } from "@/components/offices/office-context";

/** Staff transfers into or out of schools in this office's area, waiting for confirmation. */
export default function OfficeTransfersPage() {
  const office = useCurrentOffice();
  const isHead = office.role === "OFFICE_HEAD";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Transfers</h1>
        <p className="text-sm text-muted-foreground">
          A school asks for a teacher; the teacher&apos;s current school or this office confirms it. On confirmation they
          move over completely, and their old school&apos;s classes are released.
          {!isHead && " Only the head of the office can confirm or turn them down."}
        </p>
      </div>
      <TransfersList basePath="/office/transfers" canAct={isHead} emptyText="No transfers waiting." />
    </div>
  );
}
