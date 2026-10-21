import prisma from "@/lib/db/prisma";
import type { EducationOfficeType, OfficeRole, Prisma, SchoolCategory } from "@prisma/client";

const accountSelect = {
  id: true,
  role: true,
  title: true,
  status: true,
  startDate: true,
  officeId: true,
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
      hasDefaultPassword: true,
      lastLogin: true,
    },
  },
} as const;

/**
 * Education offices (HQ → provincial → district), office accounts and the schools offices see.
 * All national tables: nothing here is limited by row-level security, so the service decides
 * what each office may see.
 */
export class OfficeRepository {
  /** The person's ACTIVE office membership, with the office. */
  findActiveMembership(userId: string) {
    return prisma.officeMembership.findFirst({
      where: { userId, status: "ACTIVE", office: { isActive: true } },
      select: {
        id: true,
        role: true,
        title: true,
        officeId: true,
        office: { select: { id: true, type: true, name: true, code: true, parentId: true } },
      },
    });
  }

  findOffice(id: string) {
    return prisma.educationOffice.findUnique({
      where: { id },
      select: { id: true, type: true, name: true, code: true, parentId: true, isActive: true },
    });
  }

  findOffices(where: Prisma.EducationOfficeWhereInput) {
    return prisma.educationOffice.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        parentId: true,
        isActive: true,
        parent: { select: { id: true, name: true } },
        _count: { select: { schools: true, children: true } },
        memberships: {
          where: { status: "ACTIVE" },
          select: accountSelect,
          orderBy: [{ role: "asc" }, { startDate: "asc" }],
        },
      },
    });
  }

  createOffice(data: { type: EducationOfficeType; name: string; code: string | null; parentId: string }) {
    return prisma.educationOffice.create({ data });
  }

  updateOffice(id: string, data: { name?: string; code?: string | null; isActive?: boolean }) {
    return prisma.educationOffice.update({ where: { id }, data });
  }

  findCodeTaken(code: string, exceptId?: string) {
    return prisma.educationOffice.findFirst({
      where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
  }

  findAccounts(officeIds: string[]) {
    return prisma.officeMembership.findMany({
      where: { officeId: { in: officeIds }, status: "ACTIVE" },
      select: { ...accountSelect, office: { select: { id: true, name: true, type: true } } },
      orderBy: [{ officeId: "asc" }, { role: "asc" }],
    });
  }

  findMembershipById(id: string) {
    return prisma.officeMembership.findUnique({
      where: { id },
      select: { ...accountSelect, office: { select: { id: true, name: true, type: true, parentId: true } } },
    });
  }

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        officeMemberships: { where: { status: "ACTIVE" }, select: { id: true } },
        schoolMemberships: { where: { status: { not: "ENDED" } }, select: { id: true } },
      },
    });
  }

  /** A new account with a one-time password, and its office membership. */
  createAccount(input: {
    email: string;
    phone: string | null;
    displayName: string;
    passwordHash: string;
    expiresAt: Date;
    officeId: string;
    role: OfficeRole;
    title: string | null;
  }) {
    return prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        hasDefaultPassword: true,
        temporaryPasswordExpiresAt: input.expiresAt,
        officeMemberships: {
          create: { officeId: input.officeId, role: input.role, title: input.title },
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        officeMemberships: { select: { id: true } },
      },
    });
  }

  endMembership(id: string) {
    return prisma.officeMembership.update({
      where: { id },
      data: { status: "ENDED", endDate: new Date() },
    });
  }

  findSchools(where: Prisma.SchoolWhereInput) {
    return prisma.school.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        emisNumber: true,
        emisStatus: true,
        category: true,
        agency: true,
        status: true,
        feesEnabled: true,
        setupCompletedAt: true,
        createdAt: true,
        districtOffice: { select: { id: true, name: true, parentId: true } },
        memberships: {
          where: { status: "ACTIVE", role: { in: ["HEAD_TEACHER", "DEPUTY_HEAD", "ADMIN"] } },
          select: {
            role: true,
            user: {
              select: {
                email: true,
                displayName: true,
                profile: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    });
  }

  findSchool(id: string) {
    return prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        emisNumber: true,
        emisStatus: true,
        category: true,
        districtOfficeId: true,
        districtOffice: { select: { id: true, parentId: true } },
      },
    });
  }

  findSchoolByEmis(emisNumber: string, exceptId?: string) {
    return prisma.school.findFirst({
      where: { emisNumber, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, name: true },
    });
  }

  createSchool(data: {
    name: string;
    emisNumber: string | null;
    category: SchoolCategory;
    agency: string | null;
    districtOfficeId: string;
  }) {
    return prisma.school.create({
      // School fees are always on for private schools (the DEBS can switch them on for others).
      data: { ...data, emisStatus: "PENDING", setupCompletedAt: null, feesEnabled: data.category === "PRIVATE" },
      select: { id: true, name: true, emisNumber: true },
    });
  }

  deleteSchool(id: string) {
    return prisma.school.delete({ where: { id } });
  }

  updateSchool(
    id: string,
    data: Prisma.SchoolUncheckedUpdateInput
  ) {
    return prisma.school.update({ where: { id }, data, select: { id: true, name: true, emisNumber: true, emisStatus: true, districtOfficeId: true } });
  }
}

export const officeRepository = new OfficeRepository();
