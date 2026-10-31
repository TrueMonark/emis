import prisma from "@/lib/db/prisma";
import type { HolidayChangeKind } from "@prisma/client";

/** Holiday changes (national) and school closures (school-owned). Thin data access. */
export class CalendarRepository {
  findHolidayChanges(from: Date, to: Date) {
    return prisma.publicHolidayChange.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
  }
  findHolidayChange(id: string) {
    return prisma.publicHolidayChange.findUnique({ where: { id } });
  }
  findHolidayChangeOn(date: Date) {
    return prisma.publicHolidayChange.findUnique({ where: { date } });
  }
  createHolidayChange(data: { date: Date; kind: HolidayChangeKind; name: string; reason: string | null; createdById: string }) {
    return prisma.publicHolidayChange.create({ data });
  }
  deleteHolidayChange(id: string) {
    return prisma.publicHolidayChange.delete({ where: { id } });
  }

  /** The school's closures overlapping [from, to]. */
  findClosures(from: Date, to: Date) {
    return prisma.schoolClosure.findMany({
      where: { startDate: { lte: to }, endDate: { gte: from } },
      orderBy: { startDate: "asc" },
    });
  }
  findClosure(id: string) {
    return prisma.schoolClosure.findUnique({ where: { id } });
  }
  createClosure(data: { name: string; startDate: Date; endDate: Date; reason: string | null; createdById: string }) {
    return prisma.schoolClosure.create({ data });
  }
  deleteClosure(id: string) {
    return prisma.schoolClosure.delete({ where: { id } });
  }

  /** How many days in [from, to] already have registers (daily or period). */
  async countRegisterDays(from: Date, to: Date): Promise<number> {
    const rows = await prisma.attendanceRecord.findMany({
      where: { date: { gte: from, lte: to } },
      distinct: ["date"],
      select: { date: true },
    });
    return rows.length;
  }
}

export const calendarRepository = new CalendarRepository();
