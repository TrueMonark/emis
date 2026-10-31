import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { isWeekend } from "@school/shared/calendar/weekend";
import { applyHolidayChanges, zambianPublicHolidays, type PublicHoliday } from "@school/shared/calendar/zambia-holidays";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { auditService } from "@/features/audit/audit.service";
import type { OfficeContext } from "@/features/offices/office.service";
import { calendarRepository } from "./calendar.repository";
import type { CreateClosureInput, CreateHolidayChangeInput } from "./calendar.validation";

export type NonSchoolDayKind = "WEEKEND" | "PUBLIC_HOLIDAY" | "SCHOOL_CLOSURE";
export interface NonSchoolDay {
  /** YYYY-MM-DD */
  date: string;
  kind: NonSchoolDayKind;
  name: string;
}

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const midnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const label = (iso: string) =>
  asDate(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

interface SchoolCtx {
  userId: string;
  role: string;
}

/**
 * School days (Phase 5b, 21 October 2026). No registers are taken on a weekend, a public
 * holiday, or a day the school is closed. Public holidays are the built-in national list
 * (`@school/shared/calendar/zambia-holidays`) with HQ's changes; closures are each school's own.
 */
export class CalendarService {
  /** Public holidays between two dates (inclusive), after HQ's changes. */
  async publicHolidays(from: Date, to: Date): Promise<PublicHoliday[]> {
    const years: number[] = [];
    for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) years.push(y);
    const builtIn = years.flatMap((y) => zambianPublicHolidays(y));
    const changes = await calendarRepository.findHolidayChanges(from, to);
    const all = applyHolidayChanges(
      builtIn,
      changes.map((c) => ({ date: ymd(c.date), kind: c.kind, name: c.name }))
    );
    const f = ymd(from);
    const t = ymd(to);
    return all.filter((h) => h.date >= f && h.date <= t);
  }

  /**
   * Holidays and closure days between two dates (in the current school), one entry per day.
   * Weekends aren't listed; callers check them with isWeekend.
   */
  async nonSchoolDays(from: Date, to: Date): Promise<NonSchoolDay[]> {
    const start = midnight(from);
    const end = midnight(to);
    if (end.getTime() - start.getTime() > 400 * DAY) throw new ValidationError("Ask for at most a year at a time");
    const [holidays, closures] = await Promise.all([this.publicHolidays(start, end), calendarRepository.findClosures(start, end)]);
    const byDay = new Map<string, NonSchoolDay>();
    for (const h of holidays) byDay.set(h.date, { date: h.date, kind: "PUBLIC_HOLIDAY", name: h.name });
    for (const c of closures) {
      for (let d = Math.max(c.startDate.getTime(), start.getTime()); d <= Math.min(c.endDate.getTime(), end.getTime()); d += DAY) {
        const key = ymd(new Date(d));
        if (!byDay.has(key)) byDay.set(key, { date: key, kind: "SCHOOL_CLOSURE", name: c.name });
      }
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Why there's no school on this day (weekend, public holiday, closure), or null. */
  async nonSchoolDay(date: Date): Promise<NonSchoolDay | null> {
    const d = midnight(date);
    if (isWeekend(d)) return { date: ymd(d), kind: "WEEKEND", name: d.getUTCDay() === 6 ? "Saturday" : "Sunday" };
    const [hit] = await this.nonSchoolDays(d, d);
    return hit ?? null;
  }

  /** "Independence Day (public holiday), Saturday 24 October 2026" — for messages. */
  describe(day: NonSchoolDay): string {
    const what = day.kind === "PUBLIC_HOLIDAY" ? `${day.name} (a public holiday)` : day.kind === "SCHOOL_CLOSURE" ? `a day the school is closed (${day.name})` : day.name;
    return `${what}, ${label(day.date)}`;
  }

  // ── The school's calendar page ───────────────────────────────────────────

  async schoolYear(ctx: SchoolCtx, year: number) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31));
    const [holidays, closures] = await Promise.all([this.publicHolidays(from, to), calendarRepository.findClosures(from, to)]);
    return {
      year,
      canEdit: isSchoolLeader(ctx.role),
      publicHolidays: holidays,
      closures: closures.map((c) => ({
        id: c.id,
        name: c.name,
        startDate: ymd(c.startDate),
        endDate: ymd(c.endDate),
        reason: c.reason,
        createdAt: c.createdAt,
      })),
    };
  }

  async addClosure(ctx: SchoolCtx, input: CreateClosureInput) {
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("Only the head teacher or deputy changes the school calendar");
    const startDate = asDate(input.startDate);
    const endDate = asDate(input.endDate);
    if (endDate.getTime() - startDate.getTime() > 120 * DAY) throw new ValidationError("A closure can be at most 120 days");
    const closure = await calendarRepository.createClosure({
      name: input.name,
      startDate,
      endDate,
      reason: input.reason || null,
      createdById: ctx.userId,
    });
    // Registers already taken on those days stay as they are (they're simply no longer expected).
    const registerDays = await calendarRepository.countRegisterDays(startDate, endDate);
    await auditService.record({
      action: "SCHOOL_CLOSURE_ADDED",
      targetType: "SCHOOL",
      targetId: closure.id,
      schoolId: closure.schoolId,
      summary: `School closed ${input.startDate === input.endDate ? input.startDate : `${input.startDate} to ${input.endDate}`}: ${input.name}`,
    });
    return { id: closure.id, registerDaysAlreadyTaken: registerDays };
  }

  async removeClosure(ctx: SchoolCtx, id: string) {
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("Only the head teacher or deputy changes the school calendar");
    const closure = await calendarRepository.findClosure(id);
    if (!closure) throw new NotFoundError("Closure not found");
    await calendarRepository.deleteClosure(id);
    await auditService.record({
      action: "SCHOOL_CLOSURE_REMOVED",
      targetType: "SCHOOL",
      targetId: id,
      schoolId: closure.schoolId,
      summary: `Removed the closure "${closure.name}" (${ymd(closure.startDate)} to ${ymd(closure.endDate)})`,
    });
    return { removed: true };
  }

  // ── National public holidays (education offices; HQ changes them) ─────────

  async nationalYear(ctx: OfficeContext, year: number) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31));
    const [changes, holidays] = await Promise.all([calendarRepository.findHolidayChanges(from, to), this.publicHolidays(from, to)]);
    return {
      year,
      canEdit: ctx.office.officeType === "HQ",
      builtIn: zambianPublicHolidays(year),
      changes: changes.map((c) => ({ id: c.id, date: ymd(c.date), kind: c.kind, name: c.name, reason: c.reason, createdAt: c.createdAt })),
      holidays,
    };
  }

  async addHolidayChange(ctx: OfficeContext, input: CreateHolidayChangeInput) {
    if (ctx.office.officeType !== "HQ") throw new ForbiddenError("Only Ministry HQ changes the national public holidays");
    const date = asDate(input.date);
    if (await calendarRepository.findHolidayChangeOn(date)) {
      throw new ConflictError("There's already a change for that day; remove it first");
    }
    const builtIn = zambianPublicHolidays(date.getUTCFullYear()).find((h) => h.date === input.date);
    if (input.kind === "CANCEL" && !builtIn) throw new ValidationError("That day isn't a public holiday in the built-in list");
    if (input.kind === "ADD" && builtIn) throw new ValidationError(`That day is already a public holiday (${builtIn.name})`);
    const change = await calendarRepository.createHolidayChange({
      date,
      kind: input.kind,
      name: input.kind === "CANCEL" ? builtIn!.name : input.name,
      reason: input.reason || null,
      createdById: ctx.userId,
    });
    await auditService.record({
      action: input.kind === "ADD" ? "PUBLIC_HOLIDAY_ADDED" : "PUBLIC_HOLIDAY_CANCELLED",
      targetType: "OFFICE",
      targetId: change.id,
      officeId: ctx.office.officeId,
      summary: `${input.kind === "ADD" ? "Declared a public holiday" : "Cancelled the public holiday"} on ${input.date}: ${change.name}${input.reason ? ` (${input.reason})` : ""}`,
    });
    return { id: change.id };
  }

  async removeHolidayChange(ctx: OfficeContext, id: string) {
    if (ctx.office.officeType !== "HQ") throw new ForbiddenError("Only Ministry HQ changes the national public holidays");
    const change = await calendarRepository.findHolidayChange(id);
    if (!change) throw new NotFoundError("Change not found");
    await calendarRepository.deleteHolidayChange(id);
    await auditService.record({
      action: "PUBLIC_HOLIDAY_CHANGE_REMOVED",
      targetType: "OFFICE",
      targetId: id,
      officeId: ctx.office.officeId,
      summary: `Undid the ${change.kind === "ADD" ? "added holiday" : "cancelled holiday"} on ${ymd(change.date)} (${change.name})`,
    });
    return { removed: true };
  }
}

export const calendarService = new CalendarService();
