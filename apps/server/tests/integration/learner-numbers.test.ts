import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { GET as listStudents } from "@/api/students/route";
import {
  LEARNER_NUMBER_ALPHABET,
  generateLearnerNumber,
  isValidLearnerNumber,
  learnerNumberCheckChar,
  normalizeLearnerNumber,
} from "@school/shared/curriculum/learner-number";
import prisma from "@/lib/db/prisma";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import { resetDb, createTestUser, createTestStudent } from "../helpers/db";

const PATTERN = /^ZM\d{2}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]$/;

/**
 * Phase 3b: every learner has a system-wide learner number, ZM + year + 7 characters + a check
 * character, made by the database whenever a learner is created.
 */
describe("learner numbers", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("the check character catches any single typo and any swap of neighbouring characters", () => {
    const number = generateLearnerNumber(2026, () => 0.37);
    expect(isValidLearnerNumber(number)).toBe(true);
    const [, body, check] = number.split("-");

    for (let i = 0; i < body.length; i++) {
      for (const c of LEARNER_NUMBER_ALPHABET) {
        if (c === body[i]) continue;
        const typo = body.slice(0, i) + c + body.slice(i + 1);
        expect(learnerNumberCheckChar("26", typo)).not.toBe(check);
      }
    }
    // Neighbour swaps (where the two differ).
    const sample = "4K7Q2PB";
    const sampleCheck = learnerNumberCheckChar("26", sample);
    for (let i = 0; i < sample.length - 1; i++) {
      const swapped = sample.slice(0, i) + sample[i + 1] + sample[i] + sample.slice(i + 2);
      expect(learnerNumberCheckChar("26", swapped)).not.toBe(sampleCheck);
    }
  });

  it("accepts the number typed loosely, rejects lookalike characters and wrong checks", () => {
    const n = `ZM26-4K7Q2PB-${learnerNumberCheckChar("26", "4K7Q2PB")}`;
    expect(normalizeLearnerNumber(n.toLowerCase().replace(/-/g, " "))).toBe(n);
    expect(normalizeLearnerNumber(n.replace(/-/g, ""))).toBe(n);
    expect(normalizeLearnerNumber("ZM26-4K7Q2P0-A")).toBeNull(); // 0 isn't used
    const wrong = LEARNER_NUMBER_ALPHABET.split("").find((c) => c !== n.slice(-1))!;
    expect(normalizeLearnerNumber(n.slice(0, -1) + wrong)).toBeNull();
  });

  it("the database gives every new learner a valid, unique number (same rules as the app)", async () => {
    const students = await Promise.all(
      Array.from({ length: 25 }, (_, i) => createTestStudent({ firstName: `L${i}` }))
    );
    const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
    for (const s of students) {
      expect(s.learnerNumber).toMatch(PATTERN);
      expect(s.learnerNumber.startsWith(`ZM${yy}-`)).toBe(true);
      // The check character the database computed agrees with the shared code.
      expect(isValidLearnerNumber(s.learnerNumber)).toBe(true);
    }
    expect(new Set(students.map((s) => s.learnerNumber)).size).toBe(students.length);

    // It can't be reused: a second learner with the same number is refused.
    await expect(
      prisma.student.update({
        where: { id: students[1].id },
        data: { learnerNumber: students[0].learnerNumber },
      })
    ).rejects.toThrow();
  });

  it("staff can find a learner by learner number, with or without dashes", async () => {
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const token = await loginAs(head.user.email, head.password);
    const target = await createTestStudent({ firstName: "Chanda" });
    await createTestStudent({ firstName: "Other" });

    for (const q of [target.learnerNumber, target.learnerNumber.replace(/-/g, "").toLowerCase()]) {
      const res = await callRoute<{ data: { id: string; learnerNumber: string }[] }>(listStudents, {
        url: `/api/students?search=${encodeURIComponent(q)}`,
        token,
      });
      expect(res.status).toBe(200);
      expect(res.json.data.map((s) => s.id)).toEqual([target.id]);
      expect(res.json.data[0].learnerNumber).toBe(target.learnerNumber);
    }
  });
});
