import prisma from "@/lib/db/prisma";

/** Schools (global table). */
export class SchoolRepository {
  async findById(id: string) {
    return prisma.school.findUnique({
      where: { id },
      select: { id: true, name: true, emisNumber: true, category: true, status: true },
    });
  }

  async updateName(id: string, name: string) {
    return prisma.school.update({ where: { id }, data: { name } });
  }
}

export const schoolRepository = new SchoolRepository();
