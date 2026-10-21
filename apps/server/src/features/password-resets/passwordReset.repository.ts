import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { SCHOOL_LEADER_ROLES } from "@school/shared/auth/role-hierarchy";
import { staffProfileSummaries, type StaffProfileSummary } from "@/features/schools/staffProfile.repository";

// The teacher profile is attached separately (staffProfileSummaries): offices, and requests made
// before anyone signs in, can't see it through the user.
const personSelect = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const requestSelect = {
  id: true,
  userId: true,
  status: true,
  requestedAt: true,
  handlerSchoolId: true,
  handlerOfficeId: true,
  handledById: true,
  handledAt: true,
  user: { select: personSelect },
} satisfies Prisma.PasswordResetRequestSelect;

type RequestRow = Prisma.PasswordResetRequestGetPayload<{ select: typeof requestSelect }>;
export type ResetRequestRow = Omit<RequestRow, "user"> & {
  user: RequestRow["user"] & { profile: StaffProfileSummary | null };
};

async function withProfiles(rows: RequestRow[]): Promise<ResetRequestRow[]> {
  const profiles = await staffProfileSummaries(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, user: { ...r.user, profile: profiles.get(r.userId) ?? null } }));
}
async function withProfile(row: RequestRow | null): Promise<ResetRequestRow | null> {
  return row ? (await withProfiles([row]))[0] : null;
}

/**
 * "Forgot password?" requests (global table: made before anyone is signed in). Thin data access;
 * who may see and handle which request is decided in passwordReset.service.ts.
 */
export class PasswordResetRepository {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
  }

  findUserByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone }, select: { id: true, isActive: true } });
  }

  /** The person's ACTIVE school membership with the school's district. */
  findActiveSchoolMembership(userId: string) {
    return prisma.schoolMembership.findFirst({
      where: { userId, status: "ACTIVE", school: { status: "ACTIVE" } },
      select: {
        schoolId: true,
        role: true,
        school: { select: { name: true, districtOfficeId: true } },
      },
    });
  }

  findActiveOfficeMembership(userId: string) {
    return prisma.officeMembership.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { officeId: true, role: true, office: { select: { id: true, parentId: true, name: true } } },
    });
  }

  /** Active head teachers / deputies (incl. the old ADMIN) of the school, except one person. */
  findSchoolLeaders(schoolId: string, exceptUserId: string) {
    return prisma.schoolMembership.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
        role: { in: [...SCHOOL_LEADER_ROLES] },
        userId: { not: exceptUserId },
        user: { isActive: true },
      },
      select: { userId: true, role: true },
    });
  }

  findOffice(id: string) {
    return prisma.educationOffice.findUnique({ where: { id }, select: { id: true, parentId: true, name: true, type: true } });
  }

  countOfficeHeads(officeId: string, exceptUserId: string) {
    return prisma.officeMembership.count({
      where: { officeId, status: "ACTIVE", role: "OFFICE_HEAD", userId: { not: exceptUserId }, user: { isActive: true } },
    });
  }

  async findOpenForUser(userId: string) {
    return withProfile(await prisma.passwordResetRequest.findFirst({ where: { userId, status: "OPEN" }, select: requestSelect }));
  }

  async create(data: { userId: string; handlerSchoolId: string | null; handlerOfficeId: string | null }) {
    return (await withProfile(await prisma.passwordResetRequest.create({ data, select: requestSelect })))!;
  }

  /** Asked again: the request starts over (fresh date, possibly a different handler). */
  async renew(id: string, data: { handlerSchoolId: string | null; handlerOfficeId: string | null }) {
    const row = await prisma.passwordResetRequest.update({
      where: { id },
      data: { ...data, requestedAt: new Date() },
      select: requestSelect,
    });
    return (await withProfile(row))!;
  }

  async findById(id: string) {
    return withProfile(await prisma.passwordResetRequest.findUnique({ where: { id }, select: requestSelect }));
  }

  async findOpen(where: { handlerSchoolId?: string; handlerOfficeId?: string }, since: Date, exceptUserId: string) {
    const rows = await prisma.passwordResetRequest.findMany({
      where: { ...where, status: "OPEN", requestedAt: { gte: since }, userId: { not: exceptUserId } },
      select: requestSelect,
      orderBy: { requestedAt: "asc" },
    });
    return withProfiles(rows);
  }

  /** Where the person works now (for showing who is asking). */
  findRolesOf(userIds: string[]) {
    return Promise.all([
      prisma.schoolMembership.findMany({
        where: { userId: { in: userIds }, status: "ACTIVE" },
        select: { userId: true, role: true, school: { select: { name: true } } },
      }),
      prisma.officeMembership.findMany({
        where: { userId: { in: userIds }, status: "ACTIVE" },
        select: { userId: true, role: true, title: true, office: { select: { name: true } } },
      }),
    ]);
  }

  /** Issue the one-time password and close the request, together. */
  resolve(requestId: string, userId: string, handledById: string, otp: { passwordHash: string; expiresAt: Date }) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: otp.passwordHash, hasDefaultPassword: true, temporaryPasswordExpiresAt: otp.expiresAt },
      }),
      prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: { status: "RESOLVED", handledById, handledAt: new Date() },
      }),
    ]);
  }

  decline(requestId: string, handledById: string) {
    return prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED", handledById, handledAt: new Date() },
    });
  }

  /** In-app notifications to the school's leaders (school-owned table: call inside that school). */
  notifySchoolLeaders(senderId: string, recipientIds: string[], subject: string, message: string, requestId: string) {
    return prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        senderId,
        recipientId,
        subject,
        message,
        type: "APPROVAL_REQUEST" as const,
        priority: "HIGH" as const,
        relatedEntityType: "PASSWORD_RESET_REQUEST",
        relatedEntityId: requestId,
      })),
    });
  }
}

export const passwordResetRepository = new PasswordResetRepository();
