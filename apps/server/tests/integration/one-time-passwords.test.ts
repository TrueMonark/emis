import { describe, it, expect, beforeEach } from "vitest";
import { Role, Gender, QualificationLevel } from "@prisma/client";
import { GET as listTeachers, POST as createTeacher } from "@/api/teachers/route";
import { POST as resetPassword } from "@/api/teachers/[id]/reset-password/route";
import { GET as me } from "@/api/auth/me/route";
import { POST as changePassword } from "@/api/auth/change-password/route";
import { authService } from "@/features/auth/auth.service";
import { generateOneTimePassword } from "@/features/auth/one-time-password";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import { resetDb, createTestUser, createTestSubject } from "../helpers/db";
import prisma from "@/lib/db/prisma";

const OTP_PATTERN = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

type Created = { data: { id: string; userId: string; temporaryPassword: string; temporaryPasswordExpiresAt: string } };

describe("one-time passwords and the forced password change", () => {
  let headToken: string;
  let deputyToken: string;
  let deputyUserId: string;
  let deputyTeacherId: string;
  let primarySubjectId: string;

  beforeEach(async () => {
    await resetDb();
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    headToken = await loginAs(head.user.email, head.password);
    const deputy = await createTestUser({ role: Role.DEPUTY_HEAD });
    deputyToken = await loginAs(deputy.user.email, deputy.password);
    deputyUserId = deputy.user.id;
    deputyTeacherId = deputy.teacherProfile!.id;
    primarySubjectId = (await createTestSubject()).id;
  });

  const newTeacherBody = () => ({
    email: `otp-${crypto.randomUUID().slice(0, 8)}@example.com`,
    staffNumber: `STAFF2024${Math.floor(Math.random() * 900 + 100)}`,
    firstName: "New",
    lastName: "Teacher",
    dateOfBirth: "1990-01-01",
    gender: Gender.FEMALE,
    phone: "0977111222",
    qualification: QualificationLevel.DEGREE,
    hireDate: "2024-01-01",
    primarySubjectId,
  });

  async function createNewTeacher() {
    const body = newTeacherBody();
    const res = await callRoute<Created>(createTeacher, {
      method: "POST",
      url: "/api/teachers",
      token: headToken,
      body,
    });
    expect(res.status).toBe(201);
    return { email: body.email, ...res.json.data };
  }

  it("generates readable, different passwords", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateOneTimePassword();
      expect(p).toMatch(OTP_PATTERN);
      expect(p).not.toMatch(/[01IOL]/);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });

  it("gives each new account its own one-time password, expiring in 24 hours, never a shared default", async () => {
    const a = await createNewTeacher();
    const b = await createNewTeacher();

    expect(a.temporaryPassword).toMatch(OTP_PATTERN);
    expect(b.temporaryPassword).toMatch(OTP_PATTERN);
    expect(a.temporaryPassword).not.toBe(b.temporaryPassword);
    await expect(loginAs(a.email, "teacher123")).rejects.toThrow();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: a.email } });
    expect(user.hasDefaultPassword).toBe(true);
    const hoursLeft = (user.temporaryPasswordExpiresAt!.getTime() - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(23.9);
    expect(hoursLeft).toBeLessThanOrEqual(24);
  });

  it("blocks everything except /me and change-password until the password is changed, then works normally", async () => {
    const t = await createNewTeacher();
    // Typed in lower case, as people do when it's read out over the phone.
    const token = await loginAs(t.email, t.temporaryPassword.toLowerCase());

    const blocked = await callRoute<{ code: string }>(listTeachers, { url: "/api/teachers", token });
    expect(blocked.status).toBe(403);
    expect(blocked.json.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(blocked.headers.get("X-Password-Change-Required")).toBe("true");

    const who = await callRoute<{ data: { hasDefaultPassword: boolean } }>(me, { url: "/api/auth/me", token });
    expect(who.status).toBe(200);
    expect(who.json.data.hasDefaultPassword).toBe(true);

    const tooShort = await callRoute(changePassword, {
      method: "POST",
      url: "/api/auth/change-password",
      token,
      body: { currentPassword: t.temporaryPassword, newPassword: "short" },
    });
    expect(tooShort.status).toBe(422);

    const changed = await callRoute(changePassword, {
      method: "POST",
      url: "/api/auth/change-password",
      token,
      body: { currentPassword: t.temporaryPassword, newPassword: "My own password 1" },
    });
    expect(changed.status).toBe(200);

    // Same token now works — the check is live, not baked into the token.
    const allowed = await callRoute(listTeachers, { url: "/api/teachers", token });
    expect(allowed.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: t.email } });
    expect(user.hasDefaultPassword).toBe(false);
    expect(user.temporaryPasswordExpiresAt).toBeNull();
    await expect(loginAs(t.email, t.temporaryPassword)).rejects.toThrow();
    expect(await loginAs(t.email, "My own password 1")).toBeTruthy();
  });

  it("refuses an expired one-time password with a clear message", async () => {
    const t = await createNewTeacher();
    await prisma.user.update({
      where: { email: t.email },
      data: { temporaryPasswordExpiresAt: new Date(Date.now() - 60_000) },
    });

    const result = await authService.login({ email: t.email, password: t.temporaryPassword });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/expired/i);
    expect(result.token).toBeUndefined();
  });

  it("still blocks accounts flagged without an expiry (e.g. seeded demo accounts) until changed", async () => {
    const demo = await createTestUser({ role: Role.ADMIN });
    await prisma.user.update({ where: { id: demo.user.id }, data: { hasDefaultPassword: true } });
    const token = await loginAs(demo.user.email, demo.password);

    const blocked = await callRoute<{ code: string }>(listTeachers, { url: "/api/teachers", token });
    expect(blocked.status).toBe(403);
    expect(blocked.json.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("lets the deputy head reset a teacher, but nobody reset their own account here", async () => {
    const t = await createNewTeacher();

    const reset = await callRoute<{ data: { temporaryPassword: string } }>(resetPassword, {
      method: "POST",
      url: `/api/teachers/${t.id}/reset-password`,
      token: deputyToken,
      params: { id: t.id },
    });
    expect(reset.status).toBe(200);
    expect(reset.json.data.temporaryPassword).toMatch(OTP_PATTERN);
    expect(reset.json.data.temporaryPassword).not.toBe(t.temporaryPassword);

    // The first one-time password stops working once a new one is issued.
    await expect(loginAs(t.email, t.temporaryPassword)).rejects.toThrow();
    expect(await loginAs(t.email, reset.json.data.temporaryPassword)).toBeTruthy();

    const own = await callRoute(resetPassword, {
      method: "POST",
      url: `/api/teachers/${deputyTeacherId}/reset-password`,
      token: deputyToken,
      params: { id: deputyTeacherId },
    });
    expect(own.status).toBe(400);
    const deputy = await prisma.user.findUniqueOrThrow({ where: { id: deputyUserId } });
    expect(deputy.hasDefaultPassword).toBe(false);
  });
});
