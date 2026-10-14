import prisma from "@/lib/db/prisma";
import { Role } from "@school/shared/types/prisma-enums";

/** Shown when someone signs in (or calls the API) without an ACTIVE school membership. */
export const NO_SCHOOL_MESSAGE =
  "Your account isn't linked to a school at the moment. Contact your head teacher or district office.";

/**
 * School memberships: a person's role at a school (global table — read before the school is
 * known, e.g. at sign-in). At most one ACTIVE membership per person (database trigger).
 * User.role mirrors the ACTIVE membership's role, so both are written together.
 */
export class SchoolMembershipRepository {
  /** The person's ACTIVE membership, if any. */
  async findActiveForUser(userId: string) {
    return prisma.schoolMembership.findFirst({
      where: { userId, status: "ACTIVE", school: { status: "ACTIVE" } },
      select: { id: true, schoolId: true, role: true },
    });
  }

  /** Whether the person is (or was) a member of the school. */
  async isMember(userId: string, schoolId: string, options: { currentOnly?: boolean } = {}) {
    const count = await prisma.schoolMembership.count({
      where: {
        userId,
        schoolId,
        ...(options.currentOnly ? { status: { not: "ENDED" } } : {}),
      },
    });
    return count > 0;
  }

  /** Make the person an ACTIVE member of the school with this role (new accounts). */
  async createActive(userId: string, schoolId: string, role: Role) {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.schoolMembership.create({
        data: { userId, schoolId, role, status: "ACTIVE" },
      });
      await tx.user.update({ where: { id: userId }, data: { role } });
      return membership;
    });
  }

  /** Change the person's role at the school (and the mirrored User.role). */
  async updateRole(userId: string, schoolId: string, role: Role) {
    return prisma.$transaction(async (tx) => {
      await tx.schoolMembership.update({
        where: { userId_schoolId: { userId, schoolId } },
        data: { role },
      });
      return tx.user.update({ where: { id: userId }, data: { role } });
    });
  }
}

export const schoolMembershipRepository = new SchoolMembershipRepository();
