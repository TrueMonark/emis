import prisma from "@/lib/db/prisma";
import type { Prisma, Role } from "@prisma/client";
import { SCHOOL_LEADER_ROLES } from "@school/shared/auth/role-hierarchy";
import {
  staffProfileSummaries,
  staffProfileSummary,
  type StaffProfileSummary,
} from "@/features/schools/staffProfile.repository";

// The profile isn't selected through the user: teacher profiles are hidden from schools the
// person doesn't belong to yet, so it's attached separately (staffProfileSummaries).
const personSelect = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  isActive: true,
} satisfies Prisma.UserSelect;

type PersonRow = Prisma.UserGetPayload<{ select: typeof personSelect }>;
export type Person = PersonRow & { profile: StaffProfileSummary | null };

async function withProfile(user: PersonRow | null): Promise<Person | null> {
  if (!user) return null;
  return { ...user, profile: await staffProfileSummary(user.id) };
}

async function withProfiles<T extends { user: PersonRow }>(rows: T[]): Promise<(Omit<T, "user"> & { user: Person })[]> {
  const profiles = await staffProfileSummaries(rows.map((r) => r.user.id));
  return rows.map((r) => ({ ...r, user: { ...r.user, profile: profiles.get(r.user.id) ?? null } }));
}

const pendingSelect = {
  id: true,
  userId: true,
  schoolId: true,
  role: true,
  status: true,
  endDate: true,
  requestedById: true,
  requestedAt: true,
  school: { select: { id: true, name: true, districtOfficeId: true } },
  user: { select: personSelect },
} satisfies Prisma.SchoolMembershipSelect;

type PendingRow = Prisma.SchoolMembershipGetPayload<{ select: typeof pendingSelect }>;
export type PendingTransfer = Omit<PendingRow, "user"> & { user: Person };

/**
 * Transfers (Phase 4b): a PENDING school membership at the new school, confirmed by the old
 * school (or the DEBS). School memberships and users are national tables; the old school's
 * class assignments are school-owned, so `confirm` must run inside the old school's context.
 */
export class TransferRepository {
  async findUserByEmail(email: string) {
    return withProfile(await prisma.user.findUnique({ where: { email }, select: personSelect }));
  }

  async findUserByPhone(phone: string) {
    return withProfile(await prisma.user.findUnique({ where: { phone }, select: personSelect }));
  }

  async findUser(id: string) {
    return withProfile(await prisma.user.findUnique({ where: { id }, select: personSelect }));
  }

  /** All of the person's school memberships that aren't ENDED (their current school, a transfer waiting). */
  findCurrentMemberships(userId: string) {
    return prisma.schoolMembership.findMany({
      where: { userId, status: { in: ["ACTIVE", "PENDING"] } },
      select: { id: true, schoolId: true, status: true, role: true, school: { select: { name: true, districtOfficeId: true } } },
    });
  }

  findMembership(userId: string, schoolId: string) {
    return prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
      select: { id: true, status: true, endDate: true },
    });
  }

  async findPending(id: string): Promise<PendingTransfer | null> {
    const row = await prisma.schoolMembership.findFirst({ where: { id, status: "PENDING" }, select: pendingSelect });
    return row ? (await withProfiles([row]))[0] : null;
  }

  /** A transfer request: a new PENDING membership, or a former one (ENDED) reopened as PENDING. */
  upsertPending(data: { userId: string; schoolId: string; role: Role; requestedById: string }) {
    const fields = { status: "PENDING" as const, role: data.role, requestedById: data.requestedById, requestedAt: new Date() };
    return prisma.schoolMembership.upsert({
      where: { userId_schoolId: { userId: data.userId, schoolId: data.schoolId } },
      update: fields,
      create: { userId: data.userId, schoolId: data.schoolId, ...fields },
      select: { id: true, school: { select: { id: true, name: true } } },
    });
  }

  /** Someone with no current school joins straight away (nobody to confirm with). */
  joinNow(data: { userId: string; schoolId: string; role: Role; requestedById: string }) {
    const now = new Date();
    const fields = {
      status: "ACTIVE" as const,
      role: data.role,
      startDate: now,
      endDate: null,
      endReason: null,
      requestedById: data.requestedById,
      requestedAt: now,
      confirmedById: data.requestedById,
      confirmedAt: now,
    };
    return prisma.$transaction([
      prisma.schoolMembership.upsert({
        where: { userId_schoolId: { userId: data.userId, schoolId: data.schoolId } },
        update: fields,
        create: { userId: data.userId, schoolId: data.schoolId, ...fields },
      }),
      prisma.user.update({ where: { id: data.userId }, data: { role: data.role } }),
    ]);
  }

  /**
   * Withdrawn or turned down: a brand-new request disappears; a former membership that was
   * reopened goes back to ENDED (its history stays).
   */
  async dropPending(p: { id: string; endDate: Date | null }) {
    if (p.endDate) {
      await prisma.schoolMembership.update({
        where: { id: p.id },
        data: { status: "ENDED", requestedById: null, requestedAt: null },
      });
    } else {
      await prisma.schoolMembership.delete({ where: { id: p.id } });
    }
  }

  /** Pending transfers into these schools, or of people currently at these schools. */
  async findPendingTouching(schoolIds: string[] | "ALL") {
    const where: Prisma.SchoolMembershipWhereInput =
      schoolIds === "ALL"
        ? { status: "PENDING" }
        : {
            status: "PENDING",
            OR: [
              { schoolId: { in: schoolIds } },
              { user: { schoolMemberships: { some: { status: "ACTIVE", schoolId: { in: schoolIds } } } } },
            ],
          };
    return withProfiles(await prisma.schoolMembership.findMany({ where, select: pendingSelect, orderBy: { requestedAt: "asc" } }));
  }

  findActiveSchoolOf(userIds: string[]) {
    return prisma.schoolMembership.findMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      select: { id: true, userId: true, schoolId: true, role: true, school: { select: { id: true, name: true, districtOfficeId: true } } },
    });
  }

  findUserNames(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, displayName: true },
    });
  }

  findSchoolLeaders(schoolId: string, exceptUserId: string) {
    return prisma.schoolMembership.findMany({
      where: { schoolId, status: "ACTIVE", role: { in: [...SCHOOL_LEADER_ROLES] }, userId: { not: exceptUserId } },
      select: { userId: true },
    });
  }

  findOffice(id: string) {
    return prisma.educationOffice.findUnique({ where: { id }, select: { id: true, parentId: true, name: true } });
  }

  /**
   * Confirm a transfer. Must run inside the OLD school's context: its class-teacher and subject
   * assignments end today, the person stops being HOD there, their department and subject links
   * there are removed, and register covers still to come are cancelled. Then the old membership
   * ends and the new one becomes ACTIVE, in the same transaction.
   */
  confirm(input: {
    oldMembershipId: string;
    pendingId: string;
    userId: string;
    role: Role;
    teacherProfileId: string | null;
    confirmedById: string;
  }) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return prisma.$transaction(async (tx) => {
      let released = { classTeacher: 0, subjects: 0, covers: 0, timetableSlots: 0 };
      if (input.teacherProfileId) {
        const teacherId = input.teacherProfileId;
        const [classTeacher, subjects, covers] = await Promise.all([
          tx.classTeacherAssignment.updateMany({ where: { teacherId, endedAt: null }, data: { endedAt: now } }),
          tx.subjectTeacherAssignment.updateMany({ where: { teacherId, endedAt: null }, data: { endedAt: now } }),
          tx.registerCover.updateMany({
            where: { teacherId, cancelledAt: null, endDate: { gte: today } },
            data: { cancelledAt: now },
          }),
        ]);
        await tx.department.updateMany({ where: { hodTeacherId: teacherId }, data: { hodTeacherId: null } });
        await tx.teacherDepartment.deleteMany({ where: { teacherId } });
        await tx.teacherSubject.deleteMany({ where: { teacherId } });
        const timetableSlots = await tx.timetableSlot.count({ where: { teacherId } });
        released = { classTeacher: classTeacher.count, subjects: subjects.count, covers: covers.count, timetableSlots };
      }
      await tx.schoolMembership.update({
        where: { id: input.oldMembershipId },
        data: { status: "ENDED", endDate: now, endReason: "TRANSFERRED" },
      });
      await tx.schoolMembership.update({
        where: { id: input.pendingId },
        data: {
          status: "ACTIVE",
          startDate: now,
          endDate: null,
          endReason: null,
          confirmedById: input.confirmedById,
          confirmedAt: now,
        },
      });
      await tx.user.update({ where: { id: input.userId }, data: { role: input.role } });
      return released;
    });
  }

  /** In-app notifications (school-owned table: call inside that school's context). */
  notify(senderId: string, recipientIds: string[], subject: string, message: string, membershipId: string) {
    if (recipientIds.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        senderId,
        recipientId,
        subject,
        message,
        type: "APPROVAL_REQUEST" as const,
        relatedEntityType: "TRANSFER",
        relatedEntityId: membershipId,
      })),
    });
  }
}

export const transferRepository = new TransferRepository();
