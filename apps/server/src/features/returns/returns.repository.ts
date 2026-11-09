import type { Prisma, ReturnEventAction, SchoolReturnStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";

const roundInclude = { office: { select: { id: true, name: true, type: true, parentId: true } } } satisfies Prisma.ReturnRoundInclude;

const returnInclude = {
  round: { include: roundInclude },
  school: {
    select: {
      id: true,
      name: true,
      emisNumber: true,
      districtOfficeId: true,
      districtOffice: { select: { id: true, name: true, parentId: true } },
    },
  },
} satisfies Prisma.SchoolReturnInclude;

export type RoundRow = Prisma.ReturnRoundGetPayload<{ include: typeof roundInclude }>;
export type ReturnRow = Prisma.SchoolReturnGetPayload<{ include: typeof returnInclude }>;

/** Return rounds and school returns (national tables; who may see what is in returns.service.ts). */
export class ReturnsRepository {
  createRound(data: {
    title: string;
    instructions: string | null;
    officeId: string;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    openedById: string;
  }) {
    return prisma.returnRound.create({ data, include: roundInclude });
  }

  findRound(id: string) {
    return prisma.returnRound.findUnique({ where: { id }, include: roundInclude });
  }

  findRounds(officeIds: string[] | "ALL") {
    return prisma.returnRound.findMany({
      where: officeIds === "ALL" ? {} : { officeId: { in: officeIds } },
      include: roundInclude,
      orderBy: [{ status: "asc" }, { dueDate: "desc" }],
    });
  }

  updateRound(id: string, data: Prisma.ReturnRoundUpdateInput) {
    return prisma.returnRound.update({ where: { id }, data, include: roundInclude });
  }

  findOffice(id: string) {
    return prisma.educationOffice.findUnique({ where: { id }, select: { id: true, name: true, type: true, parentId: true } });
  }



  /** Active schools in `where`, with their district (for grouping). */
  findSchools(where: Prisma.SchoolWhereInput) {
    return prisma.school.findMany({
      where: { ...where, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        emisNumber: true,
        districtOfficeId: true,
        districtOffice: { select: { id: true, name: true, parentId: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  findOffices(ids: string[]) {
    return prisma.educationOffice.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  }

  findReturnsForRound(roundId: string, schoolIds: string[]) {
    return prisma.schoolReturn.findMany({
      where: { roundId, schoolId: { in: schoolIds } },
      select: {
        id: true,
        schoolId: true,
        status: true,
        figures: true,
        facilities: true,
        submittedAt: true,
        reviewedAt: true,
        submissionCount: true,
      },
    });
  }

  /** Returns of these rounds for these schools (status counts on the rounds list). */
  findStatuses(roundIds: string[], schoolIds: string[] | "ALL") {
    return prisma.schoolReturn.findMany({
      where: { roundId: { in: roundIds }, ...(schoolIds === "ALL" ? {} : { schoolId: { in: schoolIds } }) },
      select: { roundId: true, schoolId: true, status: true },
    });
  }

  findSchoolReturns(schoolId: string, roundIds: string[]) {
    return prisma.schoolReturn.findMany({
      where: { schoolId, roundId: { in: roundIds } },
      select: { roundId: true, status: true, submittedAt: true, reviewedAt: true },
    });
  }

  findReturn(roundId: string, schoolId: string) {
    return prisma.schoolReturn.findUnique({ where: { roundId_schoolId: { roundId, schoolId } }, include: returnInclude });
  }

  findReturnById(id: string) {
    return prisma.schoolReturn.findUnique({ where: { id }, include: returnInclude });
  }

  findEvents(returnId: string) {
    return prisma.schoolReturnEvent.findMany({ where: { returnId }, orderBy: [{ at: "asc" }, { id: "asc" }] });
  }

  findUserNames(ids: string[]) {
    return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, email: true } });
  }

  /** A new draft and its first history line, together. */
  createReturn(data: {
    roundId: string;
    schoolId: string;
    figures: Prisma.InputJsonValue;
    facilities: Prisma.InputJsonValue;
    byUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.schoolReturn.create({
        data: {
          roundId: data.roundId,
          schoolId: data.schoolId,
          figures: data.figures,
          facilities: data.facilities,
          figuresAt: new Date(),
        },
      });
      await tx.schoolReturnEvent.create({ data: { returnId: created.id, action: "STARTED", byUserId: data.byUserId } });
      return created;
    });
  }

  /**
   * Change a return only if it is still in one of `from` (two people pressing at once can't both
   * win), and add the history line in the same transaction. Returns false if it had moved on.
   */
  transition(
    id: string,
    from: SchoolReturnStatus[],
    data: Prisma.SchoolReturnUpdateManyMutationInput,
    event: {
      action: ReturnEventAction;
      byUserId: string;
      comment?: string | null;
      figures?: Prisma.InputJsonValue;
      facilities?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.schoolReturn.updateMany({ where: { id, status: { in: from } }, data });
      if (count === 0) return false;
      await tx.schoolReturnEvent.create({ data: { returnId: id, ...event } });
      return true;
    });
  }
}

export const returnsRepository = new ReturnsRepository();
