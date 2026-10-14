import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { GET as identity } from "@/api/school/identity/route";
import { POST as saveSchoolInfo } from "@/api/admin/settings/school-info/route";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import { resetDb, createTestUser, createTestSchool } from "../helpers/db";

describe("GET /api/school/identity (sidebar school name)", () => {
  let teacherToken: string;
  let headToken: string;

  beforeEach(async () => {
    await resetDb();
    const teacher = await createTestUser({ role: Role.TEACHER });
    teacherToken = await loginAs(teacher.user.email, teacher.password);
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    headToken = await loginAs(head.user.email, head.password);
  });

  it("returns the name of the school the person works in, for any role", async () => {
    const res = await callRoute<{ data: { name: string | null } }>(identity, {
      url: "/api/school/identity",
      token: teacherToken,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.name).toBe("Test School A");
  });

  it("shows each person their own school's name", async () => {
    const other = await createTestSchool({ name: "Ndola School K" });
    const kTeacher = await createTestUser({ role: Role.TEACHER, schoolId: other.id });
    const kToken = await loginAs(kTeacher.user.email, kTeacher.password);
    const res = await callRoute<{ data: { name: string | null } }>(identity, {
      url: "/api/school/identity",
      token: kToken,
    });
    expect(res.json.data.name).toBe("Ndola School K");
  });

  it("follows the name saved in Settings → School Info, trimmed", async () => {
    const saved = await callRoute(saveSchoolInfo, {
      method: "POST",
      url: "/api/admin/settings/school-info",
      token: headToken,
      body: { name: "  Kabompo Secondary School " },
    });
    expect(saved.status).toBe(200);
    const res = await callRoute<{ data: { name: string | null } }>(identity, {
      url: "/api/school/identity",
      token: teacherToken,
    });
    expect(res.json.data.name).toBe("Kabompo Secondary School");
  });

  it("requires sign-in", async () => {
    const res = await callRoute(identity, { url: "/api/school/identity" });
    expect(res.status).toBe(401);
  });
});
