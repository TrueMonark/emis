import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Role } from "@prisma/client";
import {
  resetDb,
  createTestUser,
  createTestAcademicYear,
  createTestGrade,
  createTestClass,
  createTestStudent,
  enrollTestStudent,
  assignClassTeacher,
} from "../helpers/db";

/**
 * The rest of the suite calls route handlers directly. This file checks the
 * layer in between: the real Express server over real HTTP — routing,
 * [param] segments, bodies, binary responses, 404/405, uploads.
 */

// Point uploads at a temp folder before the app module reads it.
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "school-uploads-"));
process.env.UPLOADS_DIR = uploadsDir;

let server: Server;
let base: string;

beforeAll(async () => {
  const { createApp } = await import("@/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const json = (await res.json()) as { data: { token: string } };
  return json.data.token;
}

describe("Express API server (over HTTP)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("logs in with a JSON body and uses the token on a protected route", async () => {
    const admin = await createTestUser({ role: Role.ADMIN, email: "http-admin@example.com" });
    const token = await login(admin.user.email, admin.password);

    const res = await fetch(`${base}/api/academic-years`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("rejects a protected route without a token (401, JSON)", async () => {
    const res = await fetch(`${base}/api/academic-years`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
  });

  it("passes [param] segments through and prefers fixed segments over [param]", async () => {
    const admin = await createTestUser({ role: Role.ADMIN, email: "http-params@example.com" });
    const token = await login(admin.user.email, admin.password);
    const year = await createTestAcademicYear({ isActive: true });
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // /academic-years/[id]
    const byId = await fetch(`${base}/api/academic-years/${year.id}`, auth);
    expect(byId.status).toBe(200);
    const byIdJson = (await byId.json()) as { data: { id: string } };
    expect(byIdJson.data.id).toBe(year.id);

    // /academic-years/active is its own route, not [id] = "active"
    const active = await fetch(`${base}/api/academic-years/active`, auth);
    expect(active.status).not.toBe(404);
    const activeJson = (await active.json()) as { data?: { id?: string } | null };
    expect(activeJson.data?.id).toBe(year.id);
  });

  it("returns binary and text downloads intact (class list PDF and CSV)", async () => {
    const teacher = await createTestUser({ role: Role.TEACHER, email: "http-teacher@example.com" });
    const token = await login(teacher.user.email, teacher.password);
    const year = await createTestAcademicYear();
    const grade = await createTestGrade();
    const klass = await createTestClass(grade.id);
    await assignClassTeacher(teacher.teacherProfile!.id, klass.id, year.id);
    const student = await createTestStudent();
    await enrollTestStudent(student.id, klass.id, year.id);
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    const pdf = await fetch(`${base}/api/teacher/classes/export-class-list?classId=${klass.id}&mode=class`, auth);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toMatch(/attachment; filename="ClassList_.*\.pdf"/);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    const csv = await fetch(
      `${base}/api/teacher/classes/export-class-list?classId=${klass.id}&mode=class&format=csv`,
      auth
    );
    expect(csv.status).toBe(200);
    expect(await csv.text()).toContain(student.lastName);
  });

  it("answers unknown API paths with a JSON 404", async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
  });

  it("answers a known path with the wrong method with 405 and an Allow header", async () => {
    const res = await fetch(`${base}/api/auth/login`, { method: "GET" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("serves uploaded files under /uploads and 404s missing ones", async () => {
    fs.writeFileSync(path.join(uploadsDir, "school-logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const ok = await fetch(`${base}/uploads/school-logo.png`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");

    const missing = await fetch(`${base}/uploads/nope.png`);
    expect(missing.status).toBe(404);

    const escape = await fetch(`${base}/uploads/..%2f..%2fpackage.json`);
    expect([400, 403, 404]).toContain(escape.status);
  });

  it("route list is up to date with the src/api folders", async () => {
    // @ts-expect-error — plain .mjs build script, no type declarations
    const { buildRoutesSource } = await import("../../scripts/generate-routes.mjs");
    const committed = fs.readFileSync(path.join(__dirname, "../../src/routes.generated.ts"), "utf8");
    expect(committed).toBe(buildRoutesSource());
  });
});
