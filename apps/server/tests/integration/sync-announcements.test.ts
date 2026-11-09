import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { systemPrisma } from "@/lib/db/prisma";
import { GET as snapshot } from "@/api/sync/snapshot/route";
import { POST as push } from "@/api/sync/push/route";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import { resetDb, createTestUser } from "../helpers/db";

type Snap = { data: { announcements: { id: string; readAt: string | null; canAcknowledge: boolean; schoolAcknowledged: unknown }[] } };
type Push = { data: { results: { opId: string; status: string; error?: string }[] } };

/**
 * Phase 9c (4 November 2026): announcements reach the phone with every snapshot and pull;
 * opening and acknowledging are sync operations that go through the same service as the web.
 */
describe("announcements on the phone", () => {
  let teacherToken: string;
  let headToken: string;
  let announcementId: string;

  beforeEach(async () => {
    await resetDb();
    const teacher = await createTestUser({ role: Role.TEACHER });
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    teacherToken = await loginAs(teacher.user.email, teacher.password);
    headToken = await loginAs(head.user.email, head.password);
    const hq = await systemPrisma.user.create({ data: { email: `hq-${crypto.randomUUID()}@example.com`, passwordHash: "x" } });
    announcementId = (
      await systemPrisma.announcement.create({
        data: { officeId: "office-hq", title: "National notice", body: "To all staff.", audience: "ALL_STAFF", requiresAck: true, publishedById: hq.id },
      })
    ).id;
  });

  const pushOp = (token: string, type: string) =>
    callRoute<Push>(push, {
      method: "POST",
      url: "/api/sync/push",
      token,
      body: { deviceId: "test-phone", operations: [{ opId: `${type}-${crypto.randomUUID()}`, type, payload: { announcementId } }] },
    });

  it("the snapshot carries the announcement; opening it on the phone marks it read", async () => {
    const before = await callRoute<Snap>(snapshot, { url: "/api/sync/snapshot", token: teacherToken });
    expect(before.status).toBe(200);
    expect(before.json.data.announcements.map((a) => a.id)).toEqual([announcementId]);
    expect(before.json.data.announcements[0]).toMatchObject({ readAt: null, canAcknowledge: false });

    expect((await pushOp(teacherToken, "announcement.read")).json.data.results[0].status).toBe("applied");
    const after = await callRoute<Snap>(snapshot, { url: "/api/sync/snapshot", token: teacherToken });
    expect(after.json.data.announcements[0].readAt).not.toBeNull();
  });

  it("only the head or deputy acknowledges from the phone", async () => {
    const byTeacher = await pushOp(teacherToken, "announcement.acknowledge");
    expect(byTeacher.json.data.results[0].status).toBe("rejected");

    const head = await callRoute<Snap>(snapshot, { url: "/api/sync/snapshot", token: headToken });
    expect(head.json.data.announcements[0].canAcknowledge).toBe(true);
    expect((await pushOp(headToken, "announcement.acknowledge")).json.data.results[0].status).toBe("applied");
    const after = await callRoute<Snap>(snapshot, { url: "/api/sync/snapshot", token: headToken });
    expect(after.json.data.announcements[0]).toMatchObject({ canAcknowledge: false });
    expect(after.json.data.announcements[0].schoolAcknowledged).not.toBeNull();
  });
});
