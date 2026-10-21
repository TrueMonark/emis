"use client";

import { ResetRequestsList } from "@/components/accounts/reset-requests-list";
import { useCurrentOffice } from "@/components/offices/office-context";

/**
 * "Forgot password?" requests this office handles: head teachers with no deputy (DEBS), DEBS
 * staff (PEO), PEO staff (HQ), and the office's own officers when no one else can.
 */
export default function OfficeRequestsPage() {
  const office = useCurrentOffice();
  const isHead = office.role === "OFFICE_HEAD";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Password reset requests</h1>
        <p className="text-sm text-muted-foreground">
          People who pressed &quot;Forgot password?&quot; and are reset by this office: school heads with no deputy (or
          the other way round), and staff of the offices below yours.
          {!isHead && " Only the head of the office can reset them."}
        </p>
      </div>
      <ResetRequestsList basePath="/office/password-resets" canAct={isHead} emptyText="No requests waiting." />
    </div>
  );
}
