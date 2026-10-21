import prisma from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant";

export interface StaffProfileSummary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  staffNumber: string;
  phone: string;
}

/**
 * Who someone is (name, staff number, phone), whichever school — if any — is asking.
 *
 * Teacher profiles are only visible to the person themselves and to schools they belong to (or
 * belonged to), so a school asking for a transfer, or an office handling a reset request, can't
 * see the profile of someone who isn't (yet) theirs. This reads each profile in that person's
 * own context, which the profiles policy always allows. Only for showing who someone is in
 * transfers and reset requests, after an exact email/phone match or for a request routed to
 * the reader. Never for changing a profile.
 */
export async function staffProfileSummaries(userIds: string[]): Promise<Map<string, StaffProfileSummary>> {
  const unique = [...new Set(userIds)];
  const rows = await Promise.all(
    unique.map((userId) =>
      runWithTenant({ schoolId: null, userId }, () =>
        prisma.teacherProfile.findUnique({
          where: { userId },
          select: { id: true, userId: true, firstName: true, lastName: true, staffNumber: true, phone: true },
        })
      )
    )
  );
  return new Map(rows.filter((r): r is StaffProfileSummary => !!r).map((r) => [r.userId, r]));
}

export async function staffProfileSummary(userId: string): Promise<StaffProfileSummary | null> {
  return (await staffProfileSummaries([userId])).get(userId) ?? null;
}
