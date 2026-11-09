import type { AnnouncementAudience, Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

const include = {
  office: { select: { id: true, name: true, type: true } },
  attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.AnnouncementInclude;

export type AnnouncementRow = Prisma.AnnouncementGetPayload<{ include: typeof include }>;

/** Announcements, their attachments and read receipts (national tables; access in the service). */
export class AnnouncementRepository {
  findMany(where: Prisma.AnnouncementWhereInput, take = 200) {
    return prisma.announcement.findMany({ where, include, orderBy: { publishedAt: "desc" }, take });
  }

  findById(id: string) {
    return prisma.announcement.findUnique({ where: { id }, include });
  }

  findAttachment(announcementId: string, attachmentId: string) {
    return prisma.announcementAttachment.findFirst({ where: { id: attachmentId, announcementId } });
  }

  /** The announcement and its attachments, together. */
  create(data: {
    officeId: string;
    title: string;
    body: string;
    audience: AnnouncementAudience;
    requiresAck: boolean;
    publishedById: string;
    attachments: { fileName: string; mimeType: string; sizeBytes: number; storageKey: string }[];
  }) {
    const { attachments, ...rest } = data;
    return prisma.announcement.create({ data: { ...rest, attachments: { create: attachments } }, include });
  }

  withdraw(id: string, byUserId: string, reason: string) {
    return prisma.announcement.updateMany({
      where: { id, withdrawnAt: null },
      data: { withdrawnAt: new Date(), withdrawnById: byUserId, withdrawReason: reason },
    });
  }

  /** Record that someone opened it (once; the first time is kept). */
  markRead(announcementId: string, userId: string, schoolId: string) {
    return prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId, schoolId },
      update: {},
    });
  }

  acknowledge(announcementId: string, userId: string, schoolId: string) {
    return prisma.$transaction(async (tx) => {
      const row = await tx.announcementRead.upsert({
        where: { announcementId_userId: { announcementId, userId } },
        create: { announcementId, userId, schoolId, acknowledgedAt: new Date() },
        update: {},
      });
      if (!row.acknowledgedAt) {
        await tx.announcementRead.update({
          where: { announcementId_userId: { announcementId, userId } },
          data: { acknowledgedAt: new Date() },
        });
      }
    });
  }

  /** This person's receipts for these announcements. */
  findMyReads(userId: string, announcementIds: string[]) {
    return prisma.announcementRead.findMany({ where: { userId, announcementId: { in: announcementIds } } });
  }

  /** Acknowledgements given at a school (by its head or deputy) for these announcements. */
  findSchoolAcks(schoolId: string, announcementIds: string[]) {
    return prisma.announcementRead.findMany({
      where: { schoolId, announcementId: { in: announcementIds }, acknowledgedAt: { not: null } },
      select: { announcementId: true, acknowledgedAt: true, userId: true },
    });
  }

  /** Every receipt for an announcement at these schools (for the office's progress view). */
  findReadsAt(announcementId: string, schoolIds: string[]) {
    return prisma.announcementRead.findMany({ where: { announcementId, schoolId: { in: schoolIds } } });
  }

  findSchools(where: Prisma.SchoolWhereInput) {
    return prisma.school.findMany({
      where: { ...where, status: "ACTIVE" },
      select: { id: true, name: true, emisNumber: true, districtOffice: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  findUserNames(ids: string[]) {
    return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, email: true } });
  }
}

export const announcementRepository = new AnnouncementRepository();
