# Phase 3 design — national foundation: many schools, year levels, learner numbers, offline-ready data

**Status:** approved with changes (decisions in §9 answered 12 October 2026). §4 is updated from
the 2023 Curriculum Framework; §3b covers sign-in and password resets; §7 covers offline
attendance. Nothing here is built yet.
**Why now:** the decisions below shape every table. Getting them right once is far cheaper than
retrofitting multi-school support, the Grade→Form change or offline sync later.
Evidence behind the choices: `docs/research/reporting-research-2026-10.md` (sources S1–S24).

---

## 1. What Phase 3 delivers

1. **One database for every school**, with each school's data kept apart. The database itself
   enforces the separation, not just the code.
2. **The education office tree** (HQ → provincial office → district office) and **schools** with
   their EMIS number, category and offices.
3. **People who belong to schools**, instead of one account per installation. A teacher belongs to
   one school at a time and can move to another (a transfer waits as "pending" until confirmed). This is what lets a teacher's phone app
   "link to the school they're registered to".
4. **Per-school year levels and pathways**, so Grade 8 and Form 1 can coexist during the
   changeover.
5. **A system-wide learner number** that follows a learner between schools.
6. **Offline-ready data**: every record a phone might create or change can sync safely later.
   The sync API itself and the mobile app come in later phases (§8), on top of this foundation.

Not in Phase 3: office screens, account creation chain, dashboards, the sync API endpoints, the
mobile app.

---

## 2. Education offices and schools

**EducationOffice** — `id`, `type` (`HQ` | `PROVINCIAL` | `DISTRICT`), `name`, `code`, `parentId`,
`isActive`. One HQ; provincial offices under it; district offices under those.
- The office tree is **its own list, not the administrative map**: the Education Act lets education
  districts differ from administrative districts (ss.6–7). It's seeded from the 10 provinces and
  their districts, and HQ/PEO staff can correct it.
- The Act calls the provincial level "regional"; the screens say "Provincial Education Office" (PEO).

**School** — `id`, `emisNumber` (unique when set), `emisStatus` (`CONFIRMED` | `PENDING` |
`DISPUTED`), `name`, `districtOfficeId`, `category` (`PUBLIC` | `AIDED` | `COMMUNITY` |
`PRIVATE`, per the Act s.13), `agency` (e.g. the church running an aided school; optional),
`stagesOffered` (ECE / PRIMARY / O_LEVEL / A_LEVEL), `boarding` (DAY / BOARDING / BOTH),
contacts, `latitude`/`longitude`, `status` (`ACTIVE` | `INACTIVE`).
- The EMIS number is the official ID, but the Ministry's own lists contain duplicates and errors
  (S9, S20). So a school can exist with `PENDING`, and only the district office can change a
  confirmed number. Every change is logged.
- Today's single-school settings (name, motto, logo, address…) move from `SystemSettings` onto the
  `School`.

---

## 3. People, accounts and membership

Today a `User` has one `role` and implicitly belongs to the one school. In a national system:

- **User** = one person's login, nationally unique (email or phone). No role on the user itself.
- **SchoolMembership** = (`userId`, `schoolId`, `role`, `staffNumber`, `status`
  (`PENDING` | `ACTIVE` | `ENDED`), `startDate`, `endDate`). At most one `ACTIVE` school
  membership per person; the database enforces this. A person's role is per school: ADMIN, HEAD_TEACHER, DEPUTY_HEAD, TEACHER, CLERK, as
  today. HOD stays a position (unchanged rule in `CLAUDE.md`).
- **School roles (decided 12 October 2026):** `HEAD_TEACHER` and `DEPUTY_HEAD` are separate roles
  with **the same rights** to everything in the school. They stay separate so notifications,
  report-card signatures and the reset chain (§3b) know who is who. The old `ADMIN` role was
  meant for the head, so it is retired at school level: existing `ADMIN` accounts become
  `HEAD_TEACHER` in the 3a migration, and the deputy gets the same screens as the head (today
  the deputy has its own, smaller set of pages). `TEACHER` and `CLERK` are unchanged; HOD stays
  a position.
- **OfficeMembership** = (`userId`, `officeId`, `role`). Used in Phase 4 for DEBS/PEO/HQ staff.
- **TeacherProfile** belongs to the **person**: qualification, TCZ registration number, years of
  experience. It moves with them between schools. Their teaching assignments stay per school.
- **Every request says which school it is for.** The screens send the chosen school; `withAuth`
  checks the person holds an active membership there and loads that role (rechecked from the
  database on every request, as today). Someone with one school never sees a choice.
- Deactivating a membership (a transfer, or leaving) removes access to that school's data at once,
  without deleting anything.

---

## 3b. Signing in: how a teacher in Kabompo and a teacher in Ndola reach their own school

**One website, one sign-in page, for everyone.** Nobody picks a school, district or province
before signing in. A person signs in with *their own* account, and the system already knows
where they belong from their memberships (§3).

1. **Sign in** with email **or** mobile number, plus password. Many teachers, especially rural
   ones, have a phone number but no email address they check. A forgotten password goes through
   the school (see "Forgotten passwords" below).
2. **The system looks up their memberships:**
   - **One school** (most teachers): straight into that school. The Kabompo teacher sees
     Kabompo school A; the Ndola teacher sees Ndola school K. Same page, different result.
   - **A transfer waiting for confirmation:** the person keeps working at their current school
     and sees the new school as "pending". On confirmation they move over completely (§3, decision
     1). A school picker only appears for someone who also holds an office role, e.g. a head
     teacher who also sits on a DEBS committee.
   - **Office staff** (DEBS, PEO, HQ): the office app, scoped to their office: the Ndola DEBS sees
     only Ndola's schools, and the Copperbelt PEO sees all Copperbelt districts.
   - **No active membership** (transferred out, or left): "Your account isn't linked to a school
     at the moment. Contact your head teacher or DEBS." They see no data.
3. **Every request carries the chosen school.** The server checks the person still holds an
   active membership there, on every request (as `withAuth` does for roles today). The
   database's Row-Level Security (§6) is the second lock. Changing the address bar or editing
   a request can't reach another school.

**Forgotten passwords: reset by the school, not by the person themselves** (decided 12 October
2026):
1. On the sign-in page, **"Forgot password?"** asks for the email or phone number and sends a
   **reset request**. The page always answers "If this account exists, your school has been
   notified". It never confirms whether an account exists, and requests are rate-limited.
2. **Who receives the request:**

   | Person who forgot | Notified | If that isn't possible |
   |---|---|---|
   | Teacher, clerk, other staff | Head teacher **and** deputy head of their school | — |
   | Head teacher | Deputy head | DEBS of the school's district |
   | Deputy head | Head teacher | DEBS |
   | School with no other active head/deputy | — | DEBS |
   | DEBS staff | Their PEO | HQ |
   | PEO staff | HQ | — |

   A school's ADMIN account is treated like the head teacher here (to be confirmed).
3. The notification carries a **"Reset password" button for that one account**. The button exists
   only while a request is open. Otherwise nobody sees a reset button: no blanket "reset anyone"
   control. The person resetting should confirm who is asking (in person or by phone) before
   pressing it.
4. Pressing it generates a **random one-time password**. It's shown once to the person who reset
   it, to hand over in person or by phone (and sent by SMS when the school has SMS set up). It
   expires after 24 hours.
5. On the next sign-in the **server** allows nothing except setting a new password. Then the
   request closes, and the reset is recorded in the audit log: who asked, who reset, when.
- **Already built (12 October 2026, `docs/phases/one-time-passwords-checklist.md`):** random
  one-time passwords for every new account and every reset (replacing the shared `teacher123`),
  24-hour expiry, and the server-enforced change on first sign-in with its own page. Phase 4 adds
  the request button and notifications on top.

**How accounts come to exist (built in Phase 4, the account chain):**
- HQ creates PEO accounts; a PEO creates DEBS accounts for districts in its province.
- A DEBS creates a **school** (name, EMIS number, category) **and its first head-teacher
  account**, with a one-time password. The head must change it before doing anything else, and
  the server enforces this.
- The head teacher (or the school admin they appoint) adds teachers and staff. If the person
  **already has an account** (they taught elsewhere before), the head finds them by phone or
  email and adds a membership. **No second account** is created.
- ECZ's own registration system works the same way: accounts are "given by the district system
  administrator" (S26 §7.5). That confirms the chain matches how schools already work. Unlike
  ECZ, there are no shared first-time passwords such as `123456`.

**Transfers:** a teacher moving from Ndola to Kitwe keeps the same account and history. The Kitwe
head adds a membership, and the Ndola head (or the DEBS) ends the old one. Their teacher profile
(qualifications, TCZ number) moves with them; their class assignments stay with the old school.

**The phone app (Phase 6)** uses the same sign-in. After signing in, the app downloads only that
teacher's school(s), classes and learners. That's what "links a teacher to the school they're
registered to".

**Not chosen, and why:**
- **A school code on the sign-in page** (like ECZ's "choose the level"): extra typing and
  support calls, and it's only needed when usernames aren't unique nationally. Ours are.
- **A separate web address per school** (13,000+ addresses): hard to run, and it breaks for
  people in two schools.
- A public "find a school" page for parents can come later. It doesn't affect sign-in.

## 4. Year levels and pathways (the Grade → Form changeover)

Source for this section: the 2023 Curriculum Framework (S25; summary in the research doc's
third pass).

The global `Grade` table, with its fixed unique `GRADE_1 … GRADE_12`, is replaced with
**YearLevel per school**. Each year level has:
- `schoolId`;
- `stage`: `ECE` | `LOWER_PRIMARY` | `UPPER_PRIMARY` | `JUNIOR_SECONDARY` | `O_LEVEL` |
  `A_LEVEL` | `LSEND` | `YALE` (`JUNIOR_SECONDARY` was added when building: the 2013 Grades 8–9,
  which keep the junior grading scale and report card until they run out);
- `name` ("Grade 8", "Form 1", "Reception", "Level 2", "16+") and `shortName` ("G8", "F1");
- `sequence` and `nextLevelId`;
- `curriculum`: `LEGACY_2013` | `CBC_2023`;
- `exam`, the national exam taken at the end of that level, if any: `PSLE_LEGACY` (Grade 7) |
  `PSLE_2023` (Grade 6) | `JSSL` (Grade 9, last sat 2025) | `SC_O_LEGACY` (Grade 12) |
  `SC_O_2023` (Form 4) | `SC_A` (Form 6) | `NONE`.

How it behaves:
- **Old and new side by side:** in 2026 one secondary school can have Grade 11, Grade 12,
  Forms 1–2 and Form 5, and sit three different exams. Templates make setup one click
  ("Primary Grades 1–6", "Secondary Forms 1–6", "Changeover 2026"), and schools adjust from
  there.
- **Progression follows the official changeover map** (Framework Table 12), not sequence + 1:
  - Grade 7 goes to Form 1;
  - Grade 12 goes to Form 5;
  - a learner who doesn't qualify after Grade 6 repeats.

  The promotion screen lets a school choose a different destination per cohort, because the
  official table contradicts itself in one row.
- **Pathways:**
  - `Pathway` is a national list: the 8 O-level and 5 A-level pathways.
  - Each pathway has its **subject rules** as data: compulsory subjects, "choose N from group
    X", the 6–7 subject limit, and the ICT / Computer Science exception.
  - `SchoolPathway` records which pathways a school offers. The framework says schools offer
    "specialised" pathways depending on staff and equipment.
  - A class may be tied to a pathway, and a learner's enrolment records their pathway. Their
    subject choice is checked against the rules, with a warning rather than a block.
- **National subject catalogue:** the framework's subject list, grouped (Language and
  Literature, Mathematics, Social Sciences…), with default periods per week per level (e.g.
  English 6, Geography 5, Computer Science 12 at O-level). Schools choose their offerings from
  it, and the timetable uses the default periods.
- **Period length per stage:** lower primary periods are 30 minutes, and Grade 4 upward is 40.
  Today's timetable configuration has one period length per school year; it gets one per stage.
- **What changes in code:** everything that reads `GradeLevel` today switches to `exam`/`stage`:
  - the ECZ grading rules;
  - report-card templates;
  - promotions;
  - the "Grade 12 merges Physics and Chemistry into Science" rule (legacy SC only).

  That's the biggest code change in this phase, and the tests around grading and report cards
  guard it. Grading for the *new* exams isn't in the framework; until ECZ publishes it, the new
  levels use the matching legacy scale, marked as provisional.
- **Later, built on this:**
  - primary SBA (10% from each of Grades 4, 5 and 6, sent to ECZ);
  - National Competence Assessments at Grades 1 and 3;
  - TEVETA trade-test entries.

## 5. Learners: one learner, many schools over time

- **Learner** = the person: names, date of birth, sex, plus a **system learner number**. The format
  is still to be agreed (§9). It must be unique nationally, carry a check digit against typos,
  and never be reused.
- `nationalId` (optional, empty for now) is kept separately, so a future national learner ID can
  be linked without renumbering.
- **Enrolment** stays per school and per year, as today. The school's own admission number is
  kept.
- **Transfer:** the receiving school finds the learner by learner number. The sending school's
  records stay with the sending school. Sharing history (report cards, attendance summary) happens
  only through a transfer the sending school approves, which is logged. Until transfers are
  built, a transferred learner keeps their number, and the new school starts a new enrolment.
- **Privacy (unchanged rule):** learner records stay with the school. Offices see figures, not
  names.

---

## 6. Keeping schools apart (tenancy)

- `schoolId` goes on every school-owned table. That's nearly all of them: learners, enrolments,
  classes, year levels, subjects, departments, timetables, assessments, results, attendance,
  report cards, SMS, notifications and settings.
- **National tables stay global:** education offices, pathways, ECZ grading schemes, permission
  definitions, the system learner-number register.
- **The database enforces it with PostgreSQL Row-Level Security.** Each request runs inside a
  transaction that sets the current school. A query that asks for another school's rows gets
  nothing, even if the code forgot a filter. This is the lesson from the police system: set the
  context **inside the same transaction** as the queries, and await everything inside it.
- Unique rules become per school, e.g. subject code, department code and academic year number
  are each unique *within* a school.
- **Existing data:** a migration creates one school (plus a placeholder district and province) and
  assigns every existing row to it. Then `schoolId` becomes required. It works for any existing
  database, including your development one.

---

## 7. Offline-ready data (the foundation for the mobile app)

The rules each syncable table follows (attendance, assessment results, lesson logs, learners,
enrolments, classes, timetable, year levels…):

1. **IDs can be created on the device.** IDs are random and collision-free (as today's `cuid`), so a
   phone can create an attendance record offline and keep the same ID when it syncs.
2. **Every row has `version`** (goes up on each change) and `updatedAt`. A phone sends the version it
   last saw, and the server can tell whether someone else changed it meanwhile.
3. **Deletes leave a tombstone**, so a deletion reaches phones that were offline. As built (3c):
   the change log's DELETE line is the tombstone and the row itself is deleted, so no query has
   to learn to skip "deleted" rows.
4. **A change log in the database**: a table `ChangeLog(seq, schoolId, entity, entityId, op,
   changedAt, changedBy)`, filled by **database triggers** so no code path can forget it. A phone
   asks "what changed since #seq?". That's reliable even when phone clocks are wrong.
5. **Writes from phones arrive as operations, not raw rows** (Phase 5): e.g. "mark attendance",
   "enter mark". Each runs through the **same services** as the web screens, so permissions,
   validation and locks still apply (e.g. a closed marks-entry window rejects late marks). Each
   operation has an ID, so resending after a dropped connection can't double-apply.
6. **Conflict rules, decided per kind of data:**
   - attendance: one record per learner per session; the later edit wins unless the register is
     locked;
   - marks: rejected after the window closes or the assessment is completed; otherwise the later
     edit wins, with a history line;
   - learner and staff details: online-only at first, to avoid clashes on important records.

   Every rejected operation is reported back to the phone with the reason.
7. **What a phone receives is scoped:** a teacher's phone gets only their classes, their learners'
   names, their timetable and their assessments. That keeps the download small, and it's the
   minimum the teacher needs (Data Protection Act).
8. **Attendance works fully offline** (decided 12 October 2026). With no signal, a teacher can:
   - take the daily register for their class;
   - take period attendance for any lesson on their timetable;
   - correct a mark they made earlier.

   How it works:
   - **Storage:** each mark is saved on the phone at once, with its own ID and time, and queued.
   - **Counter:** the app shows a counter, "12 registers waiting to sync".
   - **Syncing:** it syncs by itself when signal returns.
   - **Rejections:** anything the server rejects comes back with the reason (e.g. "register
     locked by the head on 14/03/2026") for the teacher to see.
   - **How long offline:** a teacher must have signed in online at least once on that phone.
     After that the app keeps working offline for a set number of days (a national setting,
     e.g. 14), locked with a PIN or fingerprint. After that it asks to go online once.
   - **Lost phones:** an account deactivated by the school is signed out on the phone the next
     time it connects.

Phase 3 builds rules 1–4 and the scoping queries, with tests. Attendance is the first data type built offline-first in Phase 6. The sync endpoints (5–6) and the app
come next (§8).

---

## 8. Phase plan from here

| Phase | What | Done when |
|---|---|---|
| **3a** ✅ built 15 October 2026 (`docs/phases/phase-3a-checklist.md`) | Offices, schools, memberships, `schoolId` everywhere, Row-Level Security, migration of existing data | Two test schools can't see each other's data through any route, and RLS blocks a raw query |
| **3b** ✅ built 16 October 2026 (`docs/phases/phase-3b-checklist.md`) | Per-school year levels and pathways; learner number; grading switched to `exam`; national subject catalogue and pathway rules | A school can run Grade 9 and Form 1 side by side; all grading/report-card tests pass |
| **3c** ✅ built 16 October 2026 (`docs/phases/phase-3c-checklist.md`) | Offline-ready data: versions, tombstones, change-log triggers, teacher-scope queries | Every change to a syncable table appears in the change log; scope queries return only a teacher's data |
| **4** ✅ (4a built 17 October 2026: offices, account chain, setup wizard, audit log — `docs/phases/phase-4a-checklist.md`; 4b built 17 October 2026: reset requests, phone sign-in, transfers, former staff — `docs/phases/phase-4b-checklist.md`) | Account chain (HQ → PEO → DEBS → school), **first-login setup for a new school's head teacher** (academic year, terms, school info and the other required settings before anything else unlocks; requested 12 October 2026), password-reset requests through head/deputy → DEBS (§3b) using the one-time passwords already built, the same one-time passwords for office accounts, audit log, office app shell | The full chain works; a DEBS can't create a school outside its district |
| **5** ✅ built 18 October 2026 (`docs/phases/phase-5-checklist.md`, reference `docs/design/sync-api.md`; with weekend classes) | Sync API: pull changes, push operations, conflict and idempotency handling | Tests: offline edits sync; conflicts and resends behave as specified |
| **6** | Teacher mobile app (React Native / Expo, shares `packages/shared`): sign in, pick school, timetable, attendance, marks, all offline | A teacher marks attendance with no signal, and it syncs later |
| **7+** | DEBS/PEO dashboards (School Profile indicators first), returns with Draft→Approved workflow, announcements, offline for the web app | — |

Each phase: a zip, its migrations, a checklist, and all tests passing.

---

## 9. Decisions (answered 12 October 2026)

1. **Teachers in two schools at once: no.** What happens in practice is a **transfer or
   promotion awaiting confirmation**: the teacher keeps all duties at the current school until
   confirmed, then drops them all and takes up all duties at the new school. So:
   - a person has **at most one active school membership**;
   - a transfer creates a **pending** membership at the new school, which can't act;
   - **confirmation** activates the new membership and ends the old one at the same moment;
   - their class assignments at the old school are released for the head to reassign.

   Office roles (DEBS, PEO) are separate memberships.
2. **Academic calendar: per school**, with a way for the Ministry to **publish a national
   calendar and enforce it**. When it's enforced, schools' term dates follow it and can't be
   edited, and schools are notified of it (with an attached letter/circular).
3. **Subjects:** national catalogue (from the Curriculum Framework) plus per-school offerings,
   plus local subjects.
4. **Learner number:** `ZM` + year of first registration + 7 characters + a check character, e.g.
   `ZM26-4K7Q2PB-X`.
5. **Mobile app:** React Native with Expo.
6. **Hosting:** built and run **locally on the developer's machine** during the build phases.
   Cloud hosting comes later, kept portable to government infrastructure. Data Protection Act
   registration is confirmed before any real learner data goes in.
