import prisma from "@/lib/db/prisma";
import { requireSchoolId } from "@/lib/db/tenant";
import { schoolMembershipRepository } from "@/features/schools/schoolMembership.repository";
import { Prisma } from "@prisma/client";
import { User, Role } from "@school/shared/types/prisma-enums";

const withProfileAndPermissions = {
  profile: {
    select: { id: true, firstName: true, lastName: true, staffNumber: true },
  },
  userPermissions: {
    include: {
      grantedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.UserInclude;

/** Users are a national table: always limit lists and lookups to members of the current school. */
const inCurrentSchool = (): Prisma.UserWhereInput => ({
  schoolMemberships: { some: { schoolId: requireSchoolId(), status: { not: "ENDED" } } },
});

/**
 * User Repository (permissions-management slice) - Data Access Layer
 *
 * Thin Prisma access for the parts of the User model the permissions
 * management screen needs. Not a general-purpose user repository.
 */
export class UserRepository {
  async findManyWithPermissions(
    where: Prisma.UserWhereInput,
    pagination: { skip: number; take: number }
  ) {
    return prisma.user.findMany({
      where: { AND: [where, inCurrentSchool()] },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { email: "asc" },
      include: withProfileAndPermissions,
    });
  }

  async count(where: Prisma.UserWhereInput): Promise<number> {
    return prisma.user.count({ where: { AND: [where, inCurrentSchool()] } });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, ...inCurrentSchool() } });
  }

  /** Change the person's role at the current school (membership + mirrored User.role). */
  async updateRole(id: string, role: Role) {
    await schoolMembershipRepository.updateRole(id, requireSchoolId(), role);
    return prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        profile: { select: { id: true, firstName: true, lastName: true, staffNumber: true } },
      },
    });
  }

  /** Active heads/deputies/admins at the current school (so the school can't lock itself out). */
  async countActiveAdmins(): Promise<number> {
    return prisma.schoolMembership.count({
      where: {
        schoolId: requireSchoolId(),
        status: "ACTIVE",
        role: { in: ["ADMIN", "HEAD_TEACHER", "DEPUTY_HEAD"] },
        user: { isActive: true },
      },
    });
  }

  async findTeacherProfileId(userId: string): Promise<string | null> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  /**
   * Flat list of active users with just enough profile info for a
   * name/role picker, optionally filtered by role.
   */
  async findActiveWithProfileNames(role?: Role) {
    return prisma.user.findMany({
      where: { isActive: true, ...(role && { role }), ...inCurrentSchool() },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        profile: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const userRepository = new UserRepository();
