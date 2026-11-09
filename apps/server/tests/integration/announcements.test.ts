import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Role } from "@prisma/client";
import { systemPrisma } from "@/lib/db/prisma";
import { GET as officeList, POST as postAnnouncement } from "@/api/office/announcements/route";
import { GET as officeDetail } from "@/api/office/announcements/[id]/route";
import { POST as withdrawAnnouncement } from "@/api/office/announcements/[id]/withdraw/route";
import { GET as officeAttachment } from "@/api/office/announcements/[id]/attachments/[attachmentId]/route";
import { GET as inbox } from "@/api/announcements/route";
import { GET as counts } from "@/api/announcements/counts/route";
import { POST as markRead } from "@/api/announcements/[id]/read/route";
import { POST as acknowledge } from "@/api/announcements/[id]/acknowledge/route";
import { GET as schoolAttachment } from "@/api/announcements/[id]/attachments/[attachmentId]/route";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import { TEST_SCHOOL_ID, resetDb, createTestUser, createTestOfficeUser, createTestDistrict, createTestSchool } from "../helpers/db";

const PDF = Buffer.from("%PDF-1.4\n% test circular\n");

/** POST a multipart form like the office page does (callRoute only sends JSON). */
async function post(token: string, fields: Record<string, string>, files: { name: string; bytes: Buffer }[] = []) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files) form.append("files", new Blob([new Uint8Array(f.bytes)]), f.name);
  const res = await postAnnouncement(
    new Request("http://localhost/api/office/announcements", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }),
    {}
  );
  return { status: res.status, json: (await res.json()) as { data: { id: string; attachments: { id: string }[] } } };
}

type InboxJson = { data: { announcements: { id: string; readAt: string | null; canAcknowledge: boolean; withdrawnAt: string | null }[]; unread: number; attention: number } };
type DetailJson = { data: { schools: number; opened: number; acknowledged: number; canWithdraw: boolean; rows: { schoolId: string; readers: number }[] } };

/**
 * Phase 8 (2 November 2026): announcements from the offices to their schools, to the leaders
 * or all staff, with private attachments, read receipts and acknowledgements.
 */
describe("announcements", () => {
  let filesDir: string;
  let districtId: string;
  let otherSchoolId: string;
  let headToken: string;
  let teacherToken: string;
  let otherHeadToken: string;
  let otherTeacherToken: string;
  let debsToken: string;
  let debsOfficerToken: string;
  let peoToken: string;
  let hqToken: string;

  beforeAll(() => {
    filesDir = fs.mkdtempSync(path.join(os.tmpdir(), "emis-private-"));
    process.env.PRIVATE_FILES_DIR = filesDir;
  });
  afterAll(() => {
    delete process.env.PRIVATE_FILES_DIR;
    fs.rmSync(filesDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDb();
    districtId = (await createTestDistrict("office-prov-lusaka", "District A")).id;
    const otherDistrictId = (await createTestDistrict("office-prov-lusaka", "District B")).id;
    await systemPrisma.school.update({ where: { id: TEST_SCHOOL_ID }, data: { districtOfficeId: districtId } });
    otherSchoolId = (await createTestSchool({ name: "School in District B", districtOfficeId: otherDistrictId })).id;

    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const teacher = await createTestUser({ role: Role.TEACHER });
    const otherHead = await createTestUser({ role: Role.HEAD_TEACHER, schoolId: otherSchoolId });
    const otherTeacher = await createTestUser({ role: Role.TEACHER, schoolId: otherSchoolId });
    const debs = await createTestOfficeUser(districtId);
    const officer = await createTestOfficeUser(districtId, { role: "OFFICER" });
    const peo = await createTestOfficeUser("office-prov-lusaka");
    const hq = await createTestOfficeUser("office-hq");
    [headToken, teacherToken, otherHeadToken, otherTeacherToken, debsToken, debsOfficerToken, peoToken, hqToken] = await Promise.all(
      [head, teacher, otherHead, otherTeacher, debs, officer, peo, hq].map((u) => loginAs(u.user.email, u.password))
    );
  });

  const leadersWithAck = { title: "Circular 1/2026", body: "Please read the attached.", audience: "LEADERS", requiresAck: "true" };

  it("the DEBS posts to its leaders with a PDF; the head reads, opens the file and acknowledges; the office sees it", async () => {
    const posted = await post(debsToken, leadersWithAck, [{ name: "circular.pdf", bytes: PDF }]);
    expect(posted.status).toBe(201);
    const id = posted.json.data.id;
    const attachmentId = posted.json.data.attachments[0].id;

    // The head sees it; the teacher (leaders only) doesn't; the other district's head doesn't.
    const headInbox = await callRoute<InboxJson>(inbox, { url: "/api/announcements", token: headToken });
    expect(headInbox.json.data.announcements.map((a) => a.id)).toEqual([id]);
    expect(headInbox.json.data.attention).toBe(1);
    expect((await callRoute<InboxJson>(inbox, { url: "/api/announcements", token: teacherToken })).json.data.announcements).toEqual([]);
    expect((await callRoute<InboxJson>(inbox, { url: "/api/announcements", token: otherHeadToken })).json.data.announcements).toEqual([]);

    // The file: the head gets the bytes; the teacher and the other school don't.
    const file = await callRoute(schoolAttachment, {
      url: `/api/announcements/${id}/attachments/${attachmentId}`,
      token: headToken,
      params: { id, attachmentId },
    });
    expect(file.status).toBe(200);
    expect(file.contentType).toBe("application/pdf");
    expect(file.byteLength).toBe(PDF.length);
    for (const token of [teacherToken, otherHeadToken]) {
      const denied = await callRoute(schoolAttachment, { url: `/api/announcements/${id}/attachments/${attachmentId}`, token, params: { id, attachmentId } });
      expect(denied.status).toBe(404);
    }
    // The office above can open it too.
    expect((await callRoute(officeAttachment, { url: `/api/office/announcements/${id}/attachments/${attachmentId}`, token: peoToken, params: { id, attachmentId } })).status).toBe(200);

    expect((await callRoute(markRead, { method: "POST", url: `/api/announcements/${id}/read`, token: headToken, params: { id } })).status).toBe(200);
    const before = await callRoute<DetailJson>(officeDetail, { url: `/api/office/announcements/${id}`, token: debsToken, params: { id } });
    expect(before.json.data).toMatchObject({ schools: 1, opened: 1, acknowledged: 0 });

    expect((await callRoute(acknowledge, { method: "POST", url: `/api/announcements/${id}/acknowledge`, token: headToken, params: { id } })).status).toBe(200);
    // Pressing it again changes nothing.
    expect((await callRoute(acknowledge, { method: "POST", url: `/api/announcements/${id}/acknowledge`, token: headToken, params: { id } })).status).toBe(200);
    const after = await callRoute<DetailJson>(officeDetail, { url: `/api/office/announcements/${id}`, token: debsToken, params: { id } });
    expect(after.json.data).toMatchObject({ opened: 1, acknowledged: 1 });
    expect((await callRoute<InboxJson>(counts, { url: "/api/announcements/counts", token: headToken })).json.data.attention).toBe(0);
  });

  it("an HQ announcement to all staff reaches teachers in every district; teachers can't acknowledge", async () => {
    const posted = await post(hqToken, { title: "National notice", body: "To all staff.", audience: "ALL_STAFF", requiresAck: "true" });
    const id = posted.json.data.id;
    for (const token of [teacherToken, otherTeacherToken, headToken, otherHeadToken]) {
      const r = await callRoute<InboxJson>(inbox, { url: "/api/announcements", token });
      expect(r.json.data.announcements.map((a) => a.id)).toContain(id);
    }
    const t = await callRoute<InboxJson>(inbox, { url: "/api/announcements", token: teacherToken });
    expect(t.json.data.announcements[0].canAcknowledge).toBe(false);
    expect((await callRoute(acknowledge, { method: "POST", url: `/api/announcements/${id}/acknowledge`, token: teacherToken, params: { id } })).status).toBe(403);

    // A DEBS sees HQ's announcement, counted over its own schools only.
    await callRoute(markRead, { method: "POST", url: `/api/announcements/${id}/read`, token: otherTeacherToken, params: { id } });
    const debsView = await callRoute<DetailJson>(officeDetail, { url: `/api/office/announcements/${id}`, token: debsToken, params: { id } });
    expect(debsView.json.data).toMatchObject({ schools: 1, opened: 0, canWithdraw: false });
    const hqView = await callRoute<DetailJson>(officeDetail, { url: `/api/office/announcements/${id}`, token: hqToken, params: { id } });
    expect(hqView.json.data).toMatchObject({ schools: 2, opened: 1, canWithdraw: true });
  });

  it("only office heads post; files must really be PDF, PNG or JPEG", async () => {
    // The files folder is shared by the tests in this file; count what's there now.
    const filesBefore = fs.readdirSync(filesDir).length;
    expect((await post(debsOfficerToken, leadersWithAck)).status).toBe(403);
    const fake = await post(debsToken, leadersWithAck, [{ name: "circular.pdf", bytes: Buffer.from("not really a pdf") }]);
    expect(fake.status).toBe(422);
    expect((await post(debsToken, { ...leadersWithAck, audience: "EVERYONE" })).status).toBe(422);
    // Nothing was saved for the refused one.
    expect(await systemPrisma.announcement.count()).toBe(0);
    expect(fs.readdirSync(filesDir).length).toBe(filesBefore);
  });

  it("only the posting office withdraws it; then it can't be acknowledged", async () => {
    const id = (await post(debsToken, leadersWithAck)).json.data.id;
    const withdraw = (token: string, reason: string) =>
      callRoute(withdrawAnnouncement, { method: "POST", url: `/api/office/announcements/${id}/withdraw`, token, params: { id }, body: { reason } });
    expect((await withdraw(peoToken, "Not ours")).status).toBe(403);
    expect((await withdraw(debsToken, "")).status).toBe(422);
    expect((await withdraw(debsToken, "Replaced by circular 2")).status).toBe(200);
    expect((await withdraw(debsToken, "Again")).status).toBe(409);

    const r = await callRoute<InboxJson>(inbox, { url: "/api/announcements", token: headToken });
    expect(r.json.data.announcements[0]).toMatchObject({ canAcknowledge: false });
    expect(r.json.data.announcements[0].withdrawnAt).not.toBeNull();
    expect((await callRoute(acknowledge, { method: "POST", url: `/api/announcements/${id}/acknowledge`, token: headToken, params: { id } })).status).toBe(422);
  });

  it("an office lists its own and the offices above's announcements, not other districts'", async () => {
    await post(hqToken, { title: "From HQ", body: "Everyone.", audience: "LEADERS", requiresAck: "false" });
    await post(debsToken, { title: "From District A", body: "Ours.", audience: "LEADERS", requiresAck: "false" });
    const otherDebs = await createTestOfficeUser((await systemPrisma.school.findUniqueOrThrow({ where: { id: otherSchoolId } })).districtOfficeId);
    const otherDebsToken = await loginAs(otherDebs.user.email, otherDebs.password);
    const list = await callRoute<{ data: { announcements: { title: string }[] } }>(officeList, { url: "/api/office/announcements", token: otherDebsToken });
    expect(list.json.data.announcements.map((a) => a.title)).toEqual(["From HQ"]);
  });
});
