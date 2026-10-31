import { describe, it, expect, beforeEach } from "vitest";
import { Gender, Role } from "@prisma/client";
import { systemPrisma } from "@/lib/db/prisma";
import { GET as officeIndicators } from "@/api/office/indicators/route";
import { GET as officeSchoolProfile } from "@/api/office/schools/[id]/profile/route";
import { GET as listRounds, POST as openRound } from "@/api/office/returns/route";
import { GET as roundDetail, PATCH as setRoundStatus } from "@/api/office/returns/[id]/route";
import { GET as officeReturn } from "@/api/office/school-returns/[id]/route";
import { POST as reviewReturn } from "@/api/office/school-returns/[id]/review/route";
import { POST as reopenReturn } from "@/api/office/school-returns/[id]/reopen/route";
import { GET as myProfile } from "@/api/school/profile/route";
import { PUT as saveFacilities } from "@/api/school/profile/facilities/route";
import { GET as myRounds } from "@/api/school/returns/route";
import { GET as myReturn, POST as startReturn, PATCH as saveDraft } from "@/api/school/returns/[roundId]/route";
import { POST as refreshReturn } from "@/api/school/returns/[roundId]/refresh/route";
import { POST as submitReturn } from "@/api/school/returns/[roundId]/submit/route";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  TEST_SCHOOL_ID,
  resetDb,
  createTestUser,
  createTestOfficeUser,
  createTestDistrict,
  createTestSchool,
  createTestAcademicYear,
  createTestGrade,
  createTestClass,
  createTestStudent,
  enrollTestStudent,
  inSchool,
} from "../helpers/db";

const DAY = 86_400_000;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lusaka" }).format(new Date());
const daysAgo = (n: number) => new Date(new Date(`${today()}T00:00:00Z`).getTime() - n * DAY).toISOString().slice(0, 10);
const daysAhead = (n: number) => daysAgo(-n);

const FACILITIES = {
  classrooms: 4,
  desks: 60,
  toiletsBoys: 2,
  toiletsGirls: 3,
  toiletsStaff: 1,
  waterSource: "BOREHOLE",
  power: "SOLAR",
  internet: false,
};

/**
 * Phase 7 (31 October 2026): School profile figures for the offices, and returns
 * (office opens a round → head drafts and submits → the school's DEBS approves or sends back).
 */
describe("school profiles and returns", () => {
  let districtId: string;
  let otherDistrictId: string;
  let otherSchoolId: string;
  let headToken: string;
  let teacherToken: string;
  let debsToken: string;
  let debsOfficerToken: string;
  let otherDebsToken: string;
  let peoToken: string;
  let hqToken: string;

  beforeEach(async () => {
    await resetDb();
    // School A in a Lusaka test district with 3 learners in a class; another school in another district.
    districtId = (await createTestDistrict("office-prov-lusaka", "Test District A")).id;
    otherDistrictId = (await createTestDistrict("office-prov-lusaka", "Test District B")).id;
    await systemPrisma.school.update({ where: { id: TEST_SCHOOL_ID }, data: { districtOfficeId: districtId } });
    otherSchoolId = (await createTestSchool({ name: "Other District School", districtOfficeId: otherDistrictId })).id;

    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const teacher = await createTestUser({ role: Role.TEACHER });
    headToken = await loginAs(head.user.email, head.password);
    teacherToken = await loginAs(teacher.user.email, teacher.password);

    const year = await createTestAcademicYear({ year: Number(today().slice(0, 4)) });
    const grade = await createTestGrade({ name: "Form 1", level: null, stage: "O_LEVEL", sequence: 1 });
    const cls = await createTestClass(grade.id);
    for (const gender of [Gender.MALE, Gender.MALE, Gender.FEMALE]) {
      const s = await createTestStudent({ gender });
      await enrollTestStudent(s.id, cls.id, year.id);
    }
    // A learner in the other school, who must never be counted for school A or its district.
    await inSchool(otherSchoolId, () => createTestStudent({ gender: Gender.FEMALE }));

    const debs = await createTestOfficeUser(districtId);
    const officer = await createTestOfficeUser(districtId, { role: "OFFICER" });
    const otherDebs = await createTestOfficeUser(otherDistrictId);
    const peo = await createTestOfficeUser("office-prov-lusaka");
    const hq = await createTestOfficeUser("office-hq");
    debsToken = await loginAs(debs.user.email, debs.password);
    debsOfficerToken = await loginAs(officer.user.email, officer.password);
    otherDebsToken = await loginAs(otherDebs.user.email, otherDebs.password);
    peoToken = await loginAs(peo.user.email, peo.password);
    hqToken = await loginAs(hq.user.email, hq.password);
  });

  describe("office dashboards", () => {
    it("a DEBS sees its own schools' counts, school by school", async () => {
      const res = await callRoute<{ data: { scope: { type: string }; rows: { id: string; kind: string; summary: { figures: { learners: { male: number; female: number }; byLevel: { grade: string; male: number; female: number }[] } } }[] } }>(
        officeIndicators,
        { url: "/api/office/indicators", token: debsToken }
      );
      expect(res.status).toBe(200);
      expect(res.json.data.scope.type).toBe("DISTRICT");
      expect(res.json.data.rows.map((r) => r.id)).toEqual([TEST_SCHOOL_ID]);
      const row = res.json.data.rows[0];
      expect(row.kind).toBe("SCHOOL");
      expect(row.summary.figures.learners).toEqual({ male: 2, female: 1 });
      expect(row.summary.figures.byLevel).toEqual([{ grade: "Form 1", stage: "O_LEVEL", male: 2, female: 1 }]);
    });

    it("a PEO sees its districts, and can open one", async () => {
      const res = await callRoute<{ data: { rows: { id: string; kind: string; schools: number; summary: { derived: { learners: number } } }[] } }>(
        officeIndicators,
        { url: "/api/office/indicators", token: peoToken }
      );
      expect(res.status).toBe(200);
      const a = res.json.data.rows.find((r) => r.id === districtId)!;
      const b = res.json.data.rows.find((r) => r.id === otherDistrictId)!;
      expect(a.kind).toBe("DISTRICT");
      expect(a.summary.derived.learners).toBe(3);
      expect(b.summary.derived.learners).toBe(1);

      const inside = await callRoute<{ data: { rows: { id: string }[] } }>(officeIndicators, {
        url: `/api/office/indicators?officeId=${districtId}`,
        token: peoToken,
      });
      expect(inside.json.data.rows.map((r) => r.id)).toEqual([TEST_SCHOOL_ID]);
    });

    it("a DEBS can't open another district or its schools", async () => {
      const district = await callRoute(officeIndicators, { url: `/api/office/indicators?officeId=${districtId}`, token: otherDebsToken });
      expect(district.status).toBe(404);
      const school = await callRoute(officeSchoolProfile, {
        url: `/api/office/schools/${TEST_SCHOOL_ID}/profile`,
        token: otherDebsToken,
        params: { id: TEST_SCHOOL_ID },
      });
      expect(school.status).toBe(404);
    });

    it("school accounts can't use the office dashboard", async () => {
      const res = await callRoute(officeIndicators, { url: "/api/office/indicators", token: headToken });
      expect(res.status).toBeGreaterThanOrEqual(401);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("school profile and facilities", () => {
    it("the head saves facilities; the DEBS sees them beside the district", async () => {
      const saved = await callRoute(saveFacilities, { method: "PUT", url: "/api/school/profile/facilities", token: headToken, body: FACILITIES });
      expect(saved.status).toBe(200);

      const mine = await callRoute<{ data: { facilities: typeof FACILITIES; derived: { learnersPerClassroom: number } } }>(myProfile, {
        url: "/api/school/profile",
        token: headToken,
      });
      expect(mine.status).toBe(200);
      expect(mine.json.data.facilities.classrooms).toBe(4);
      expect(mine.json.data.derived.learnersPerClassroom).toBe(0.8);

      const office = await callRoute<{ data: { facilities: { waterSource: string }; district: { schools: number } } }>(officeSchoolProfile, {
        url: `/api/office/schools/${TEST_SCHOOL_ID}/profile`,
        token: debsToken,
        params: { id: TEST_SCHOOL_ID },
      });
      expect(office.status).toBe(200);
      expect(office.json.data.facilities.waterSource).toBe("BOREHOLE");
      expect(office.json.data.district.schools).toBe(1);
    });

    it("teachers can't see or change the school profile", async () => {
      expect((await callRoute(myProfile, { url: "/api/school/profile", token: teacherToken })).status).toBe(403);
      expect(
        (await callRoute(saveFacilities, { method: "PUT", url: "/api/school/profile/facilities", token: teacherToken, body: FACILITIES })).status
      ).toBe(403);
    });

    it("rejects negative counts", async () => {
      const res = await callRoute(saveFacilities, {
        method: "PUT",
        url: "/api/school/profile/facilities",
        token: headToken,
        body: { ...FACILITIES, classrooms: -1 },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("returns", () => {
    async function open(token = debsToken) {
      const res = await callRoute<{ data: { id: string } }>(openRound, {
        method: "POST",
        url: "/api/office/returns",
        token,
        body: { title: "Term return", periodStart: daysAgo(30), periodEnd: daysAhead(30), dueDate: daysAhead(14) },
      });
      expect(res.status).toBe(201);
      return res.json.data.id;
    }
    const school = (handler: Parameters<typeof callRoute>[0], roundId: string, method = "POST", body?: unknown, token = headToken) =>
      callRoute<{ data: { return: { id: string; status: string; submissionCount: number; figures: { learners: { male: number; female: number } }; events: { action: string }[] } | null } }>(
        handler,
        { method, url: `/api/school/returns/${roundId}`, token, params: { roundId }, body }
      );

    it("goes draft → submitted → sent back → submitted again → approved, with every step in the history", async () => {
      const roundId = await open();

      const listed = await callRoute<{ data: { id: string; myStatus: string }[] }>(myRounds, { url: "/api/school/returns", token: headToken });
      expect(listed.json.data.find((r) => r.id === roundId)?.myStatus).toBe("NOT_STARTED");

      const started = await school(startReturn, roundId);
      expect(started.status).toBe(201);
      expect(started.json.data.return?.status).toBe("DRAFT");
      expect(started.json.data.return?.figures.learners).toEqual({ male: 2, female: 1 });

      // No facilities on the profile yet, so the draft can't go.
      expect((await school(submitReturn, roundId)).status).toBe(400);

      expect((await school(saveDraft, roundId, "PATCH", { facilities: FACILITIES, remarks: "All well" })).status).toBe(200);
      const submitted = await school(submitReturn, roundId);
      expect(submitted.status).toBe(200);
      expect(submitted.json.data.return?.status).toBe("SUBMITTED");
      const returnId = submitted.json.data.return!.id;

      // With the DEBS now: the school can't change it.
      expect((await school(saveDraft, roundId, "PATCH", { facilities: FACILITIES })).status).toBe(400);

      // Sending back needs a comment.
      const noComment = await callRoute(reviewReturn, {
        method: "POST",
        url: `/api/office/school-returns/${returnId}/review`,
        token: debsOfficerToken,
        params: { id: returnId },
        body: { decision: "RETURN" },
      });
      expect(noComment.status).toBe(400);
      const sentBack = await callRoute<{ data: { status: string } }>(reviewReturn, {
        method: "POST",
        url: `/api/office/school-returns/${returnId}/review`,
        token: debsOfficerToken,
        params: { id: returnId },
        body: { decision: "RETURN", comment: "Check the desks count" },
      });
      expect(sentBack.status).toBe(200);
      expect(sentBack.json.data.status).toBe("RETURNED");

      expect((await school(saveDraft, roundId, "PATCH", { facilities: { ...FACILITIES, desks: 70 } })).status).toBe(200);
      expect((await school(refreshReturn, roundId)).status).toBe(200);
      const again = await school(submitReturn, roundId);
      expect(again.json.data.return?.submissionCount).toBe(2);

      const approved = await callRoute<{ data: { status: string; events: { action: string }[] } }>(reviewReturn, {
        method: "POST",
        url: `/api/office/school-returns/${returnId}/review`,
        token: debsToken,
        params: { id: returnId },
        body: { decision: "APPROVE" },
      });
      expect(approved.json.data.status).toBe("APPROVED");
      expect(approved.json.data.events.map((e) => e.action)).toEqual([
        "STARTED",
        "SAVED",
        "SUBMITTED",
        "RETURNED",
        "SAVED",
        "REFRESHED",
        "SUBMITTED",
        "APPROVED",
      ]);

      // The PEO sees the approved figures added up.
      const peoView = await callRoute<{ data: { approved: { returns: number; figures: { learners: { male: number; female: number } }; facilities: { desks: number } } } }>(
        roundDetail,
        { url: `/api/office/returns/${roundId}`, token: peoToken, params: { id: roundId } }
      );
      expect(peoView.status).toBe(200);
      expect(peoView.json.data.approved.returns).toBe(1);
      expect(peoView.json.data.approved.figures.learners).toEqual({ male: 2, female: 1 });
      expect(peoView.json.data.approved.facilities.desks).toBe(70);
    });

    it("only the school's own DEBS decides; the PEO and other districts can't", async () => {
      const roundId = await open();
      await callRoute(saveFacilities, { method: "PUT", url: "/api/school/profile/facilities", token: headToken, body: FACILITIES });
      await school(startReturn, roundId);
      const returnId = (await school(submitReturn, roundId)).json.data.return!.id;
      const decide = (token: string) =>
        callRoute(reviewReturn, {
          method: "POST",
          url: `/api/office/school-returns/${returnId}/review`,
          token,
          params: { id: returnId },
          body: { decision: "APPROVE" },
        });
      expect((await decide(peoToken)).status).toBe(403);
      expect((await decide(otherDebsToken)).status).toBe(404);
      expect((await callRoute(officeReturn, { url: `/api/office/school-returns/${returnId}`, token: otherDebsToken, params: { id: returnId } })).status).toBe(404);
      expect((await decide(debsToken)).status).toBe(200);

      // Only the DEBS head reopens an approved return, with a reason.
      const reopen = (token: string, comment: string) =>
        callRoute(reopenReturn, { method: "POST", url: `/api/office/school-returns/${returnId}/reopen`, token, params: { id: returnId }, body: { comment } });
      expect((await reopen(debsOfficerToken, "Wrong figures")).status).toBe(403);
      expect((await reopen(debsToken, "")).status).toBe(400);
      expect((await reopen(debsToken, "Wrong figures")).status).toBe(200);
    });

    it("two submits at once: one goes through, the other is refused", async () => {
      const roundId = await open();
      await callRoute(saveFacilities, { method: "PUT", url: "/api/school/profile/facilities", token: headToken, body: FACILITIES });
      await school(startReturn, roundId);
      const [a, b] = await Promise.all([school(submitReturn, roundId), school(submitReturn, roundId)]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const events = await systemPrisma.schoolReturnEvent.count({ where: { action: "SUBMITTED" } });
      expect(events).toBe(1);
    });

    it("a closed round can't be started; only the office that opened it closes it", async () => {
      const roundId = await open();
      const patch = (token: string, status: string) =>
        callRoute(setRoundStatus, { method: "PATCH", url: `/api/office/returns/${roundId}`, token, params: { id: roundId }, body: { status } });
      expect((await patch(peoToken, "CLOSED")).status).toBe(403);
      expect((await patch(debsToken, "CLOSED")).status).toBe(200);
      expect((await school(startReturn, roundId)).status).toBe(400);
    });

    it("an HQ round reaches every school; a district's round doesn't reach other districts", async () => {
      const hqRound = await open(hqToken);
      const debsRound = await open();
      const otherHead = await createTestUser({ role: Role.HEAD_TEACHER, schoolId: otherSchoolId });
      const otherHeadToken = await loginAs(otherHead.user.email, otherHead.password);
      const theirs = await callRoute<{ data: { id: string }[] }>(myRounds, { url: "/api/school/returns", token: otherHeadToken });
      const ids = theirs.json.data.map((r) => r.id);
      expect(ids).toContain(hqRound);
      expect(ids).not.toContain(debsRound);
      expect((await school(myReturn, debsRound, "GET", undefined, otherHeadToken)).status).toBe(404);

      // The other district's DEBS sees HQ's round (for its own schools), not district A's.
      const rounds = await callRoute<{ data: { rounds: { id: string; schools: number }[] } }>(listRounds, { url: "/api/office/returns", token: otherDebsToken });
      expect(rounds.json.data.rounds.map((r) => r.id)).toEqual([hqRound]);
      expect(rounds.json.data.rounds[0].schools).toBe(1);
    });

    it("teachers and officers can't open or answer returns", async () => {
      const roundId = await open();
      expect((await callRoute(myRounds, { url: "/api/school/returns", token: teacherToken })).status).toBe(403);
      expect((await school(startReturn, roundId, "POST", undefined, teacherToken)).status).toBe(403);
      const byOfficer = await callRoute(openRound, {
        method: "POST",
        url: "/api/office/returns",
        token: debsOfficerToken,
        body: { title: "Not allowed", periodStart: daysAgo(10), periodEnd: daysAgo(1), dueDate: daysAhead(1) },
      });
      expect(byOfficer.status).toBe(403);
    });
  });
});
