import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { requireSchoolId } from "@/lib/db/tenant";
import { deletePrivateFile, readPrivateFile, savePrivateFile } from "@/lib/files/private-files";
import { auditService } from "@/features/audit/audit.service";
import { officeService, type OfficeContext } from "@/features/offices/office.service";
import { announcementRepository, type AnnouncementRow } from "./announcement.repository";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_TOTAL_ATTACHMENT_BYTES,
  type IncomingFile,
  type PostAnnouncementInput,
} from "./announcement.validation";

interface SchoolCtx {
  userId: string;
  role: string;
}

/** What a file really is, from its first bytes (not what the browser said). */
function detectType(bytes: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/** A safe file name to show and download under (no folders, no odd characters). */
function cleanFileName(name: string, type: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  const ext = type === "application/pdf" ? ".pdf" : type === "image/png" ? ".png" : ".jpg";
  const stem = base.replace(/\.[^.]*$/, "") || "attachment";
  return `${stem}${ext}`;
}

function presentAttachments(a: AnnouncementRow) {
  return a.attachments.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes }));
}

function presentBase(a: AnnouncementRow) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    requiresAck: a.requiresAck,
    office: { id: a.office.id, name: a.office.name, type: a.office.type },
    publishedAt: a.publishedAt,
    withdrawnAt: a.withdrawnAt,
    withdrawReason: a.withdrawReason,
    attachments: presentAttachments(a),
  };
}

/**
 * Announcements (Phase 8, decided 2 November 2026): circulars from an education office to every
 * active school in its area (HQ: all schools; a PEO: its province; a DEBS: its district).
 *  - The office **head** posts one, choosing the audience: head teachers and deputies only, or
 *    all staff. PDFs and images can go with it; they are private files, sent only to people
 *    who received the announcement and to the offices that can see it.
 *  - The office always sees which schools have opened it; when it asks for an
 *    acknowledgement, the school's head or deputy presses "Acknowledge" and the office sees who
 *    hasn't yet.
 *  - Never edited once posted; the office that posted it can withdraw it, with a reason.
 */
export class AnnouncementService {
  // ── Offices ───────────────────────────────────────────────────────────────────────────

  async post(ctx: OfficeContext, input: PostAnnouncementInput, files: IncomingFile[]) {
    if (ctx.office.role !== "OFFICE_HEAD") throw new ForbiddenError("Only the head of the office posts announcements");
    if (files.length > MAX_ATTACHMENTS) throw new ValidationError(`Attach at most ${MAX_ATTACHMENTS} files`);
    const total = files.reduce((s, f) => s + f.bytes.length, 0);
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) throw new ValidationError("The attachments are too big together (9 MB at most)");
    const checked = files.map((f) => {
      if (f.bytes.length === 0) throw new ValidationError(`"${f.name}" is empty`);
      if (f.bytes.length > MAX_ATTACHMENT_BYTES) throw new ValidationError(`"${f.name}" is too big (8 MB at most per file)`);
      const type = detectType(f.bytes);
      if (!type) throw new ValidationError(`"${f.name}" isn't a PDF, PNG or JPEG file`);
      return { ...f, type, fileName: cleanFileName(f.name, type) };
    });

    const stored: string[] = [];
    try {
      const attachments = [];
      for (const f of checked) {
        const storageKey = await savePrivateFile(f.bytes);
        stored.push(storageKey);
        attachments.push({ fileName: f.fileName, mimeType: f.type, sizeBytes: f.bytes.length, storageKey });
      }
      const created = await announcementRepository.create({
        officeId: ctx.office.officeId,
        title: input.title,
        body: input.body,
        audience: input.audience,
        requiresAck: input.requiresAck,
        publishedById: ctx.userId,
        attachments,
      });
      await auditService.record({
        action: "ANNOUNCEMENT_POSTED",
        targetType: "OFFICE",
        targetId: created.id,
        officeId: ctx.office.officeId,
        summary: `Posted "${created.title}" to ${input.audience === "LEADERS" ? "head teachers and deputies" : "all staff"}${input.requiresAck ? " (acknowledgement asked)" : ""}${attachments.length ? `, ${attachments.length} attachment(s)` : ""}`,
      });
      return this.officeDetail(ctx, created.id);
    } catch (error) {
      // Nothing half-saved: remove the files if the announcement wasn't recorded.
      await Promise.all(stored.map((k) => deletePrivateFile(k)));
      throw error;
    }
  }

  private async requireVisible(ctx: OfficeContext, id: string) {
    const a = await announcementRepository.findById(id);
    const visible = await officeService.messageOfficeIdsFor(ctx);
    if (!a || (visible !== "ALL" && !visible.includes(a.officeId))) throw new NotFoundError("Announcement not found");
    return a;
  }

  /** Schools an announcement reaches that the caller may see. */
  private schoolsFor(ctx: OfficeContext, a: AnnouncementRow) {
    return announcementRepository.findSchools({
      AND: [officeService.schoolsUnderOfficeWhere(a.office), officeService.schoolWhere(ctx)],
    });
  }

  async officeList(ctx: OfficeContext) {
    const visible = await officeService.messageOfficeIdsFor(ctx);
    const list = await announcementRepository.findMany(visible === "ALL" ? {} : { officeId: { in: visible } }, 100);
    const out = [];
    for (const a of list) {
      const schools = await this.schoolsFor(ctx, a);
      const reads = await announcementRepository.findReadsAt(a.id, schools.map((s) => s.id));
      out.push({
        ...presentBase(a),
        sentByMyOffice: a.officeId === ctx.office.officeId,
        schools: schools.length,
        opened: new Set(reads.map((r) => r.schoolId)).size,
        acknowledged: new Set(reads.filter((r) => r.acknowledgedAt).map((r) => r.schoolId)).size,
      });
    }
    return { announcements: out, canPost: ctx.office.role === "OFFICE_HEAD" };
  }

  /** One announcement with every school's progress (opened, acknowledged). */
  async officeDetail(ctx: OfficeContext, id: string) {
    const a = await this.requireVisible(ctx, id);
    const schools = await this.schoolsFor(ctx, a);
    const reads = await announcementRepository.findReadsAt(a.id, schools.map((s) => s.id));
    const names = new Map(
      (await announcementRepository.findUserNames([...new Set([a.publishedById, ...reads.filter((r) => r.acknowledgedAt).map((r) => r.userId)])])).map(
        (u) => [u.id, u.displayName || u.email]
      )
    );
    const bySchool = new Map<string, typeof reads>();
    for (const r of reads) bySchool.set(r.schoolId, [...(bySchool.get(r.schoolId) ?? []), r]);
    const rows = schools.map((s) => {
      const list = bySchool.get(s.id) ?? [];
      const firstRead = list.reduce<Date | null>((m, r) => (!m || r.readAt < m ? r.readAt : m), null);
      const ack = list.filter((r) => r.acknowledgedAt).sort((x, y) => x.acknowledgedAt!.getTime() - y.acknowledgedAt!.getTime())[0];
      return {
        schoolId: s.id,
        name: s.name,
        emisNumber: s.emisNumber,
        district: s.districtOffice.name,
        readers: list.length,
        firstReadAt: firstRead,
        acknowledgedAt: ack?.acknowledgedAt ?? null,
        acknowledgedBy: ack ? names.get(ack.userId) ?? null : null,
      };
    });
    return {
      ...presentBase(a),
      publishedBy: names.get(a.publishedById) ?? null,
      sentByMyOffice: a.officeId === ctx.office.officeId,
      canWithdraw: a.officeId === ctx.office.officeId && ctx.office.role === "OFFICE_HEAD" && !a.withdrawnAt,
      schools: rows.length,
      opened: rows.filter((r) => r.readers > 0).length,
      acknowledged: rows.filter((r) => r.acknowledgedAt).length,
      rows,
    };
  }

  async withdraw(ctx: OfficeContext, id: string, reason: string) {
    const a = await this.requireVisible(ctx, id);
    if (a.officeId !== ctx.office.officeId || ctx.office.role !== "OFFICE_HEAD") {
      throw new ForbiddenError("Only the head of the office that posted it can withdraw it");
    }
    const { count } = await announcementRepository.withdraw(id, ctx.userId, reason);
    if (count === 0) throw new ConflictError("It has already been withdrawn");
    await auditService.record({
      action: "ANNOUNCEMENT_WITHDRAWN",
      targetType: "OFFICE",
      targetId: id,
      officeId: ctx.office.officeId,
      summary: `Withdrew "${a.title}": ${reason}`,
    });
    return this.officeDetail(ctx, id);
  }

  async officeAttachment(ctx: OfficeContext, id: string, attachmentId: string) {
    await this.requireVisible(ctx, id);
    return this.attachment(id, attachmentId);
  }

  // ── The school ────────────────────────────────────────────────────────────────────────

  /** What reaches this person: from their school's district, province or HQ, for their role. */
  private async inboxWhere(ctx: SchoolCtx) {
    const offices = await officeService.messageOfficeIdsForSchool(requireSchoolId());
    return {
      officeId: { in: offices },
      ...(isSchoolLeader(ctx.role) ? {} : { audience: "ALL_STAFF" as const }),
    };
  }

  private async requireRecipient(ctx: SchoolCtx, id: string) {
    const a = await announcementRepository.findById(id);
    const where = await this.inboxWhere(ctx);
    if (!a || !where.officeId.in.includes(a.officeId) || (where.audience && a.audience !== where.audience)) {
      throw new NotFoundError("Announcement not found");
    }
    return a;
  }

  async inbox(ctx: SchoolCtx) {
    const schoolId = requireSchoolId();
    const list = await announcementRepository.findMany(await this.inboxWhere(ctx));
    const ids = list.map((a) => a.id);
    const [mine, acks] = await Promise.all([announcementRepository.findMyReads(ctx.userId, ids), announcementRepository.findSchoolAcks(schoolId, ids)]);
    const myRead = new Map(mine.map((r) => [r.announcementId, r]));
    const ackUsers = [...new Set(acks.map((a) => a.userId))];
    const names = new Map((await announcementRepository.findUserNames(ackUsers)).map((u) => [u.id, u.displayName || u.email]));
    const schoolAck = new Map<string, { at: Date; by: string | null }>();
    for (const a of acks) {
      const prev = schoolAck.get(a.announcementId);
      if (!prev || a.acknowledgedAt! < prev.at) schoolAck.set(a.announcementId, { at: a.acknowledgedAt!, by: names.get(a.userId) ?? null });
    }
    const leader = isSchoolLeader(ctx.role);
    const items = list.map((a) => {
      const ack = schoolAck.get(a.id) ?? null;
      return {
        ...presentBase(a),
        readAt: myRead.get(a.id)?.readAt ?? null,
        schoolAcknowledged: ack,
        /** The head or deputy still has to acknowledge it */
        needsAcknowledgement: leader && a.requiresAck && !a.withdrawnAt && !ack,
        canAcknowledge: leader && a.requiresAck && !a.withdrawnAt && !ack,
      };
    });
    return {
      announcements: items,
      unread: items.filter((i) => !i.readAt && !i.withdrawnAt).length,
      toAcknowledge: items.filter((i) => i.needsAcknowledgement).length,
      /** Unread or still to acknowledge (each counted once): the menu badge */
      attention: items.filter((i) => (!i.readAt && !i.withdrawnAt) || i.needsAcknowledgement).length,
    };
  }

  /** For the menu badge. */
  async counts(ctx: SchoolCtx) {
    const { unread, toAcknowledge, attention } = await this.inbox(ctx);
    return { unread, toAcknowledge, attention };
  }

  async markRead(ctx: SchoolCtx, id: string) {
    await this.requireRecipient(ctx, id);
    await announcementRepository.markRead(id, ctx.userId, requireSchoolId());
    return { read: true };
  }

  async acknowledge(ctx: SchoolCtx, id: string) {
    const a = await this.requireRecipient(ctx, id);
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("The head teacher or deputy acknowledges announcements for the school");
    if (!a.requiresAck) throw new ValidationError("This announcement doesn't ask for an acknowledgement");
    if (a.withdrawnAt) throw new ValidationError("This announcement has been withdrawn");
    await announcementRepository.acknowledge(id, ctx.userId, requireSchoolId());
    return { acknowledged: true };
  }

  async schoolAttachment(ctx: SchoolCtx, id: string, attachmentId: string) {
    await this.requireRecipient(ctx, id);
    return this.attachment(id, attachmentId);
  }

  private async attachment(id: string, attachmentId: string) {
    const f = await announcementRepository.findAttachment(id, attachmentId);
    if (!f) throw new NotFoundError("File not found");
    let bytes: Buffer;
    try {
      bytes = await readPrivateFile(f.storageKey);
    } catch {
      throw new NotFoundError("The file is missing on the server");
    }
    return { bytes, fileName: f.fileName, mimeType: f.mimeType };
  }
}

export const announcementService = new AnnouncementService();
