# CLAUDE.md — School Management System

This file is binding, not advisory. It exists because this codebase has drifted from its own
established patterns before — see `docs/ARCHITECTURAL_ANALYSIS.md` for the full account. Every
session (mine or a future one) must read this before touching `apps/server/`, `apps/school/hooks/`
or `packages/shared/`.

## Repository layout (monorepo, npm workspaces — since 2026-10-10)

```
apps/server/      @school/server — the ONE API server + database for every app
  src/api/**/route.ts   one file per URL (folder path = URL, [id] = :id)
  src/features/<domain>/ services, repositories, validation
  src/lib/              server-only helpers (auth, db, http, logger, pdf, sms…)
  src/app.ts            Express app: mounts every route; src/index.ts starts it
  src/routes.generated.ts  route list, generated from src/api/ (never edit by hand)
  prisma/               schema, migrations, seed
  tests/                integration tests (Vitest)
apps/school/      @school/school — Next.js screens: admin, teacher, HOD
  app/                  pages (App Router)
  components/<domain>/  one folder per domain: students, teachers, classes, parents,
                        assessments, attendance, report-cards, reports, layout, …
  hooks/                data hooks (use apiRequest from lib/api-client.ts)
  lib/                  client-only helpers (api-client, PDF generation)
packages/shared/  @school/shared — code BOTH server and screens use (role hierarchy, grading,
                  formatting, enum types, report-card PDF templates). No DB, no env.
packages/ui/      @school/ui — building blocks for EVERY app's screens: shadcn/Radix
                  primitives (button, dialog, table, sidebar…), stats card, use-toast,
                  use-mobile, cn(). No API calls, no domain knowledge.
server.js         all-in-one production entry: API + school app on one port
docs/             background docs; docs/README.md says what's current vs archive
```

Education office pages (HQ, PEO, DEBS) live in `apps/school` under `app/(office)/office/`
(decided when building Phase 4a: one sign-in page and one set of building blocks for everyone,
instead of a separate `apps/office`). The school's first-time setup wizard is `app/(setup)/setup/`.

- The screens never import server code. They talk to the API over HTTP through
  `apps/school/lib/api-client.ts`; in development the school app passes `/api/*` and `/uploads/*`
  through to the server (`apps/school/next.config.ts` rewrites). ESLint enforces this.
- Anything needed by both sides goes in `packages/shared` — never copy it into both apps.
- **Components:** a generic building block with no domain knowledge (looks the same in any app)
  goes in `packages/ui` and is imported as `@school/ui/components/<name>`. Anything that knows
  about students, classes, marks… goes in `apps/school/components/<domain>/`. Name folders by
  domain, never by role (`admin/`, `hod/`, `teacher/`) — a role-specific variant lives inside its
  domain folder (e.g. `components/assessments/hod-review/`). No loose files at the top of
  `components/`. Add shadcn components from `packages/ui` (`components.json` lives there).
- **API calls from screens:** `api.get/post/…` or `apiRequest` from `lib/api-client.ts` for JSON;
  `authFetch` (same file) when you need the raw `Response` (downloads, custom status handling).
  Both attach the login token. Never call `fetch("/api/…")` bare and never hand-roll an
  `Authorization` header (none left in the screens as of 2026-10-11; the login call is the one
  intentional bare `fetch`).
- **Dates and times** display as DD/MM/YYYY: always pass `"en-GB"` to `toLocaleDateString` /
  `toLocaleString`, never the browser default or `"en-US"`. On the **server** (PDFs, CSVs, SMS,
  error messages) also pass `timeZone: "Africa/Lusaka"` — the host clock may be UTC, which shifts
  times by two hours and late-evening dates by a day.
- **Branding:** the sidebar header is `components/layout/sidebar-brand.tsx`. It shows the Monark Devs
  mark, the signed-in person's school name (`GET /api/school/identity`, `hooks/useSchoolIdentity.ts`)
  and "Monark Devs" underneath. Sign-in pages end with `MonarkDevsCredit`
  (`components/layout/monark-devs-credit.tsx`). Brand images are in
  `apps/school/public/brand/`. The brand is spelled **Monark Devs** (with a k).
- **No school's details in code.** Never hard-code a school name, logo, motto or contact as a
  default; use `SCHOOL_NAME_NOT_SET` (`@school/shared/format`) when the name is missing.
- Inside `apps/server`, `@/…` means `apps/server/src/…`. Inside `apps/school`, `@/…` means
  `apps/school/…`. Shared code is always imported as `@school/shared/<path>`.

## Many schools, one database (Phase 3a, since 2026-10-15) — read before any data change

- **Every school-owned table has `schoolId`**, and PostgreSQL **row-level security** shows a
  query only the current school's rows (`src/lib/db/tenant.ts`). `withAuth` finds the person's
  ACTIVE `SchoolMembership` and runs the request inside that school; the default `prisma` client
  wraps every query in a transaction that sets the school (`SET LOCAL ROLE emis_app`,
  `app.school_id`). New rows get the school's id from the column default, so code never sets it.
- **National (global) tables:** users, school_memberships, schools, education_offices,
  catalogue_subjects and pathways (read-only for the app), role_permissions, ECZ grading
  schemes. `teacher_profiles` belongs to the
  person: a school sees the profiles of its current and former members. Phase 7 adds
  school_facilities, return_rounds, school_returns and school_return_events (figures only).
- **A new school-owned model** needs: `schoolId String @default(dbgenerated("current_setting('app.school_id'::text, true)"))`
  plus the `school` relation and `@@index([schoolId])`; uniques made per school
  (`@@unique([schoolId, code])`); and, in its migration, `ENABLE ROW LEVEL SECURITY` with the
  same `school_isolation` policy as the others (copy from
  `migrations/20261012180000_phase3a_schools_and_isolation`). Without the policy the table is
  shared across schools.
- **Users are national:** any list or lookup of users must be limited to the school's members
  (see `inCurrentSchool()` in `features/permissions/user.repository.ts`). Email is unique
  nationally (one login per person).
- **A person's role is per school** (`SchoolMembership.role`; `User.role` mirrors the ACTIVE one).
  At most one ACTIVE membership per person (database trigger); a transfer waits as PENDING.
- **`systemPrisma`** (from `lib/db/prisma.ts`) is not restricted: only for the seed, test resets
  and maintenance scripts — never in `src/features` or `src/api`.
- **Code outside a request has no school**: school-owned tables look empty and inserts fail.
  Background work must run inside `runWithTenant({ schoolId, userId }, …)` for one school.
- **No module-level caches of school data** unless keyed by school (see
  `lib/settings/school-info-helper.ts`).
- Head teacher and deputy head have **the same rights**: check with `isSchoolLeader(role)`
  (`@school/shared/auth/role-hierarchy`), never one specific leadership role. `ADMIN` is the
  old name for the head's account and is no longer given to anyone.

## Education offices and the account chain (Phase 4a, since 2026-10-17)

- **Office accounts** are a user with an ACTIVE `OfficeMembership` (`OFFICE_HEAD` or `OFFICER`)
  at an `EducationOffice` (HQ → PROVINCIAL → DISTRICT), at most one active per person. They have
  no school: `/api/office/*` routes run with `schoolId` null and `user.office` set by `withAuth`
  (use `officeContextOf(user)`); every other route refuses an office-only account, and office
  routes refuse school accounts.
- **What each office may see and do** is decided in one place, `features/offices/office.service.ts`
  (scope helpers + `canManageAccountsAt`). Never re-implement scope checks in a route or screen —
  the screens only mirror them to hide buttons.
- **A DEBS registers a school with its first head teacher** (one-time password). A new school
  has `School.setupCompletedAt` null, and `withAuth` answers school routes outside
  `SETUP_ALLOWED_PREFIXES` (`@school/shared/auth/school-setup`) with 403 `SCHOOL_SETUP_REQUIRED`
  until the head finishes `/setup`. A new route a setup step needs must be added to that list.
- **Audit log** (`audit_log`, `auditService.record`) for account, office and school-level
  actions. The app can add and read lines, never change or delete them.
- The first HQ account comes from `npm run office:create-account -- --email … --name "…"`
  (`--reset` re-issues an office account's one-time password: the last resort for HQ heads).

## Reset requests, phone sign-in and transfers (Phase 4b, since 2026-10-17)

- **Sign-in takes an email or a mobile number** (`parseSignInId` / `normalizeZambianPhone` in
  `@school/shared/auth/sign-in-id`). `User.phone` (+260XXXXXXXXX, unique) is set when an account
  is created or a profile's phone changes, only if no other account uses that number
  (`features/auth/sign-in-phone.ts`). Never make phone required or reassign a number in code.
- **Nobody resets a password without a request.** "Forgot password?" (`POST /api/auth/forgot-password`,
  public like login, rate-limited, same reply whether or not the account exists) creates a
  `PasswordResetRequest` routed by `passwordReset.service.ts`: school staff → head/deputy;
  head ↔ deputy; no other leader → DEBS; office staff → the office above (up the tree if it has
  no head). Only the handler sees a "Reset password" button, and only while the request is open.
  The Teachers page reset route works only for an open request or a never-used account. Don't
  add any other reset path.
- **Transfers** (`features/transfers/`): the new school asks (`PENDING` membership, at most one
  per person), the old school's head/deputy or the office over the old school confirms; then the
  old membership ends and the new one becomes ACTIVE in one transaction run in the **old**
  school's context, releasing its class-teacher/subject assignments, HOD post, department and
  subject links, and future register covers. Teacher profiles stay readable by former schools.
- **Every list of a school's staff must say which staff.** Use `staffWhere()` /
  `currentStaffWhere()` (`features/schools/schoolMembership.repository.ts`) on teacher-profile
  queries; RLS alone also shows former staff (kept for history). Former staff are read-only
  (`assertCurrentStaff` in `teacher.service.ts`).

## Weekend classes and the phone sync API (Phase 5, since 2026-10-18)

- **No attendance on a Saturday or Sunday** (`isWeekend` in `@school/shared/calendar/weekend`,
  checked in `attendanceRecord.service.ts` for marking and correcting). The only weekend register
  is a **special class** (`features/special-classes/`): the teacher asks, the HOD of the
  subject's department approves (head/deputy as fallback; their own need no approval), and only
  that teacher (or the head/deputy) takes its register, on or after the day. Its attendance is
  `SpecialClassAttendance`, kept apart from `AttendanceRecord`, so it never affects the daily
  register or report cards. Don't store weekend marks in `attendance_records`.
- **Phone sync** (`features/sync/sync.service.ts` `PhoneSyncService`, routes `/api/sync/*`,
  reference `docs/design/sync-api.md`): snapshot, changes (rows + tombstones, resync when the
  scope fingerprint changes), push (operations, applied once per `opId` via `sync_operations`).
  Operations call the **same services** as the web; add a new kind in `sync.operations.ts`, never
  by writing tables from the sync code. What fields a phone gets is `syncRecords.repository.ts`
  (minimum needed: no learner birth dates, addresses, medical or vulnerability details).

## Teacher phone app (Phase 6, since 2026-10-22)

- `apps/mobile` is an **Expo (SDK 57, the version the Play Store Expo Go runs as of 23 October 2026) / React Native** app, and **its own npm project, not a
  workspace** (root `workspaces` lists `apps/server`, `apps/school`, `packages/*` explicitly) so its
  React/React Native never clash with the website's. Install/run/check with the root scripts
  `mobile:install`, `mobile`, `mobile:typecheck`. Root ESLint ignores it.
- It imports **only pure TypeScript** from `packages/shared` (`@school/shared/<path>`, mapped in
  `metro.config.js` and `tsconfig.json`). Never import server code or Node/DOM-only modules there.
- It talks to the server only through `/api/auth/*` and `/api/sync/*`. Every write is a sync
  operation (`apps/mobile/src/ops.ts` → outbox → `POST /api/sync/push`); a new kind of phone write
  = a new operation in `sync.operations.ts` first, then `ops.ts`. Never add phone-only REST routes.
- Local data: SQLite (`src/db.ts`); secrets (token, PIN hash, device id) in secure storage
  (`src/storage.ts`). Learner fields on the phone are whatever `syncRecords.repository.ts` sends.

## Public holidays, school closures and marks history (Phase 5b, since 2026-10-21)

- **No registers on a non-school day**: weekend, public holiday or school closure —
  `calendarService.nonSchoolDay(date)` (`features/calendar/`), called by `attendanceRecord.service.ts`
  for every mark and correction. Special classes are the only register on those days. Don't add
  a second holiday check anywhere; call the calendar service.
- **Public holidays** = `zambianPublicHolidays(year)` (`@school/shared/calendar/zambia-holidays`:
  fixed days, Easter, first-Monday rules, Sunday → Monday) plus HQ's `PublicHolidayChange` rows
  (ADD / CANCEL, national table, HQ office only). When the law changes, update the TS rules for
  future years; HQ's changes cover the gap. **Closures** = `SchoolClosure` (school-owned, head/deputy).
  Phones get them in the sync snapshot/changes `calendar` field.
- **Marks history** (`mark_changes`) is written by the database trigger
  `emis_record_mark_change` on `student_assessment_results` (who = `app.user_id`, source =
  `app.source`: set `source: "PHONE"` in `runWithTenant` for phone work, else WEB/SYSTEM). Never
  write history lines from code, except the phone "not applied" lines in `sync.operations.ts`.
  The app can't update or delete them. The phone marks conflict rule mirrors attendance
  (`baseVersion` + `madeAt`).
## School profiles and returns (Phase 7, since 2026-10-31)

- **Offices get counts, never learner records.** The only cross-school reads are the SQL
  functions `emis_school_indicators` and `emis_school_enrolment_by_level` (SECURITY DEFINER,
  migration `20261031090000_phase7_profiles_and_returns`), called from
  `features/indicators/indicators.repository.ts`. They return counts per school and nothing else.
  Callers decide which schools may be asked for: offices through `officeService.schoolWhere` /
  `isSchoolInScope`, a school only itself. Never add a cross-school query that returns rows about
  learners or staff, and never use `systemPrisma` for this.
- **What the figures are** (enrolment by year level and sex, admissions, leavers, repeaters,
  orphans / vulnerable / special needs, teachers by sex and qualification, classes, attendance,
  registers taken out of classes × school days) is `ReturnFigures` in
  `@school/shared/returns/indicators`, with the derived indicators (`deriveIndicators`) and the
  adding up (`sumFigures`, `sumFacilities`). Change the SQL and that type together.
- **School days** for the register figures exclude weekends, the national public holidays
  (passed in from `calendarService.publicHolidays`) and the school's closures, in SQL.
- **Facilities** (`school_facilities`, national, one row per school): kept by the head/deputy
  on the School profile page; every new return copies them, and the head can correct the copy.
- **Returns** (`features/returns/`): an office head (HQ, PEO or DEBS) opens a `ReturnRound` for
  every active school in its area. The head/deputy starts a draft (figures from
  `indicatorsService.figuresFor`), saves, refreshes and submits. The **DEBS of the school's
  district** (head or officer) approves it or sends it back with a comment. The DEBS head can
  reopen an approved one. The PEO and HQ see progress and the approved figures added up.
  Status changes go through `returnsRepository.transition` (a conditional update plus a history
  line in one transaction), so two people pressing at once can't both win. The history
  (`school_return_events`) is insert-only for the app, and returns and rounds are never deleted.
  `school_returns` and `return_rounds` are national tables (figures only), like `schools`.

## School fees (since 2026-10-19)

- **On per school**: `School.feesEnabled` — always true for `PRIVATE` (set when the DEBS registers
  or recategorises a school); the office can switch it on for others. Every `/api/finance/*`
  service call starts with `financeAccess()` / `requireFinanceEditor()` (`features/fees/financeAccess.ts`):
  role `FINANCE` edits, the head/deputy (`isSchoolLeader`) only view and print, everyone else 403.
- **`FINANCE` is a non-teaching role** (no teacher profile). `withAuth` refuses a FINANCE account
  every route outside `FINANCE_ALLOWED_PREFIXES` (`@school/shared/auth/finance-access`). A new
  route finance staff need goes in that list. Finance staff accounts are made by the head/deputy
  (`financeStaff.service.ts`, one-time password like every account).
- **Money is whole ngwee (`Int`)**, never floats; format/parse with `@school/shared/fees/money`.
- **Charges are rows (`FeeCharge`, one per learner per fee, amount = fee − discounts); payments
  are not linked to charges.** How payments pay charges is computed every time by
  `features/fees/ledger.ts` (earmarked fee first, then oldest due date, the rest is credit;
  instalments decide what is overdue). Never store an allocation or a balance column.
  A discount or fee amount change recalculates `FeeCharge` rows (`fee.service.ts`).
- **Payments are never deleted or edited**: a wrong one is VOIDED with a reason (the app's DB role
  has no DELETE on `fee_payments`). Receipt numbers (`RCT-YYYY-000001`) come from the row-locked
  `fee_receipt_counters` upsert in `feesRepository.recordPayment` — don't number them in code.
- `FeePayment.source` is `MANUAL`; a future bank/mobile-money gateway records payments through
  the same service with its own source and provider reference (webhook route to be designed then).
- Printouts are HTML print views under `app/(finance-print)/finance/print/*` plus client-side CSV
  (`components/finance/csv.ts`); no server PDFs for fees.

## Year levels, curriculum and learner numbers (Phase 3b, since 2026-10-16)

- **`Grade` is a school's own year level** ("Grade 8", "Form 1", "Reception", "16+"), with
  `stage`, `curriculum` and `exam`. `level` (GRADE_1…12) is only a leftover for 2013-curriculum
  grades and is **empty for Forms** — never base a rule on it. Use the helpers in
  `@school/shared/curriculum/year-levels`: `gradingScaleFor`, `reportCardTypeFor`,
  `mergesPhysicsAndChemistry`, `schoolLevelForStage`; or pass `grade.stage` as the last
  argument of `resolveECZLevel` / `resolveReportCardLevel` / `getCurriculumType`. "Secondary" is
  `grade.schoolLevel === "SECONDARY"`. Order is `sequence` (per school); progression is
  `nextGradeId` (Grade 12 → Form 5), never `sequence + 1`.
- **National subject catalogue and pathways** live in `packages/shared/src/curriculum`
  (`catalogue.ts`, `pathways.ts`) and in the tables the Phase 3b migration filled. After
  changing the TS lists, run `npm run db:sync-catalogue`. A school subject links to its entry
  with `catalogueSubjectId` (empty = the school's own local subject). Pathway checks only warn.
- **Learner number** (`Student.learnerNumber`, `ZM26-4K7Q2PB-H`) is made by the database
  (`emis_new_learner_number()`, column default). Never set or change it in code; validate typed
  numbers with `normalizeLearnerNumber`. The SQL and TS check-character rules must stay identical.

## Offline-ready data (Phase 3c, since 2026-10-16)

- 18 syncable tables (list: `SYNC_ENTITIES` in `features/sync/teacherScope.service.ts`) have a
  `version` column raised by a database trigger on every real update, and every insert, update
  and delete is written to `change_log` by a trigger (migration `20261016150000_phase3c_change_log`).
  Code never writes either. A new syncable table needs the same two triggers, a `version`
  column, and an entry in `SYNC_ENTITIES` and the teacher scope.
- **Deletes stay hard deletes.** The change log's DELETE line is the tombstone; don't add
  `deletedAt` to a table just for sync.
- **The sync cursor is a transaction id + seq** (`changeLog.repository.ts`), served only below
  the oldest running transaction. Never page the change log by `seq` alone: a long transaction
  that commits late would be skipped.
- What a teacher's phone may hold is `teacherScopeService` — extend it there, not per endpoint.
  Anything that changes *which* rows are in scope (new class, cover, term) must be part of its
  `fingerprint`, or phones won't know to download again.

## Stack

API: Node.js + Express 5 hosting web-standard route handlers (`Request` → `Response`), PostgreSQL
via Prisma, JWT auth, Zod validation, `bcryptjs` for hashing. Screens: Next.js 16 (App Router) +
React 19, Tailwind + Radix UI, Sonner for toasts.

## The architecture (non-negotiable)

Every API route MUST follow this chain, in this order:

```
route.ts  →  withAuth()  →  Service (business logic + authorization)  →  Repository (Prisma)  →  ApiResponse
```

- **`apps/server/src/api/**/route.ts`** — thin. Extract params, call one service method, return the result. No
  business logic, no direct Prisma calls, no manual JWT parsing. Target: under ~50 lines.
- **`src/lib/http/with-auth.ts`** — the ONLY way a route authenticates. Never parse
  `authorization` headers or call `verifyToken`/`jwt.verify` directly inside a route handler.
- **`src/features/*/[domain].service.ts`** — owns business logic, authorization checks
  (`canCreate`/`canUpdate`/`requireAnyRole`), and validation orchestration. This is where
  permission checks belong — always call them, even on read paths (`getAll`, `getById`), not just
  writes.
- **`src/features/*/[domain].repository.ts`** — thin Prisma access only. No conditionals beyond
  filtering, no calculations, no orchestration across other repositories. Wrap any multi-step write
  (more than one `prisma.*` call that must succeed or fail together) in `prisma.$transaction(...)`.
  See `assessment.service.ts`'s `bulkEnterResults` as the reference implementation for batched
  transactional writes — copy that shape, not a sequential loop.
- **`src/lib/http/api-response.ts` / `error-handler.ts`** — the ONLY way a route returns JSON. Never
  hand-roll `Response.json({...})` for success or error paths. Throw typed errors from
  `lib/http/errors.ts` (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ConflictError`,
  etc.) and let `handleApiError` translate them.
- **`src/lib/logger/logger.ts`** — the only logging call. Never `console.log`/`console.error` in a
  route or service.
- **`src/features/*/[domain].validation.ts`** — real Zod schemas, checked at the API boundary before
  the service is called. Never leave one of these empty.

- **Route handlers are web-standard.** A handler takes a `Request` and returns a `Response` —
  never Express's `req`/`res`, never `next/server`. `src/lib/http/express-adapter.ts` is the only
  place that converts between Express and web types. Read query strings with
  `new URL(request.url).searchParams`; route params arrive as `context.params` (a Promise), as before.
- **Adding a route** = adding a `src/api/<path>/route.ts` folder. `npm run routes` (run automatically
  by `dev`, `build` and `test`) regenerates `src/routes.generated.ts`, and a test fails if it's stale.
  Fixed segments always win over `[param]` segments at the same depth, as they did under Next.js.

## Authorization — how it actually works

There is no separate "RBAC engine" — `features/permissions/` used to contain empty stub files
(`permission.service.ts`, `.guard.ts`, `.repository.ts`, `.types.ts`) that looked like one but were
never implemented; they were deleted (2026-07-06) rather than built out, because real enforcement
already works, split across three genuinely-used mechanisms. Know all three before touching auth
code:

1. **Role hierarchy** (`packages/shared/src/auth/role-hierarchy.ts`) — `HEAD_TEACHER = DEPUTY_HEAD`
   (= the retired `ADMIN`) `> {TEACHER, CLERK}`; the role is the person's role at their school. Checked via `requireAnyRole`/`requireMinimumRole`/`hasRoleAuthority`
   (`apps/server/src/lib/auth/authorization.ts`). This is what most service-layer checks use.
2. **HOD position** (`apps/server/src/lib/auth/position-helpers.ts`) — HOD is NOT a role (removed from the `Role`
   enum in migration `remove_hod_from_role_enum`). It's derived live from
   `Department.hodTeacherId`. Use `isHOD(userId)`/`getHODDepartment(userId)`, never a
   `Role.HOD`-style check — that constant doesn't exist and a role-only check will silently exclude
   HODs from things they should access (they're `Role.TEACHER` underneath).
3. **Per-user permission overrides** — time-boxed grants/revocations on top of the role, checked via
   `withPermission()` in `src/lib/http/with-auth.ts`. The actual read path is
   `features/auth/auth.repository.ts`'s `getUserPermissions()`, which queries the `RolePermission`
   and `UserPermission` Prisma models directly — not via `features/permissions/rolePermission.repository.ts`
   (deleted 2026-07-12: dead code, never called; verified with `knip` plus a manual trace of the
   actual call path before removing it). `features/permissions/userPermission.repository.ts` is
   still real and in active use, but only for the admin UI that *manages* overrides
   (`userManagement.service.ts`), not for the request-time permission check itself.
   `withAuth` recomputes both `role` and this permission list from the database on every request
   (not from the JWT payload) so deactivation, role changes, and permission overrides/expiry take
   effect on the next request rather than waiting out the 7-day token lifetime.

If you're about to add a new kind of access check, use one of these three — don't create a fourth.

## Hard rules — MUST NOT

- MUST NOT import `@/lib/db/prisma` inside `apps/server/src/api/**/route.ts`. Prisma is only ever called from
  a repository.
- MUST NOT define a local `JWT_SECRET` fallback string anywhere (`|| "..."`.) There is exactly one
  place JWT secrets are read: `features/auth/auth.service.ts`, from `process.env.JWT_SECRET` with
  no fallback. If it's missing, fail loudly, don't substitute a guessable string.
- MUST NOT ship an unauthenticated route, including "temporary" debug/test endpoints. If you need
  a scratch endpoint while developing, delete it before ending the session — don't leave a
  `// TEMPORARY` comment as a substitute for actually removing it.
- MUST NOT create a second implementation of something that already exists (a second `withAuth`, a
  second `AuthService`, a second table component per domain). Before writing a new hook, service,
  or wrapper, grep for an existing one first.
- MUST NOT leave dead/superseded files in place "just in case" (e.g. `*-old.tsx`,
  `*-simplified.tsx`, unwired components). If a replacement is written, delete the file it
  replaces in the same change.
- MUST NOT use `db push` to add a new Prisma model or field. Always `prisma migrate dev` so
  `apps/server/prisma/migrations/` stays the source of truth. (All 40 models have a migration —
  re-checked 2026-10-10 against every `migration.sql`; the old "12 models have no migration" note is
  out of date. Keep it that way.)
- MUST NOT import `next/server` (or anything from Next.js) in `apps/server`. The server doesn't run
  on Next.js any more.
- MUST NOT import server code (`@school/server`, Prisma, repositories) from `apps/school`.

## When writing a new API route, model it on these (known-good)

**Good reference files** — read one of these before writing a new route:
`apps/server/src/api/hod/teachers/route.ts`, `apps/server/src/api/sms/send/route.ts`,
`apps/server/src/api/teacher/students/route.ts`.

As of 2026-07-09, every route in the API has been migrated onto the chain above (verified by
grepping for `verifyToken`/`jwt.verify` and `@/lib/db/prisma` inside `src/api/**/route.ts` — zero
matches) — there is no longer a "known-bad, don't copy" list. A few routes (documented inline with
a comment where it applies, e.g. `src/api/admin/timetable/{configuration,generate,swap,view,export-pdf}/route.ts`,
`src/api/admin/settings/{school-info,security,system}/route.ts`) intentionally return a bare
top-level shape instead of the standard `ApiResponse` envelope because existing frontend pages read
that shape directly and non-defensively — that's a deliberate, called-out exception, not something
to flag as a violation.

## Integration testing

Real, automated tests live in `apps/server/tests/integration/**/*.test.ts`, run via `npm test` from
the repo root or `apps/server` (Vitest — `vitest run`; `npm run test:watch` for the watch mode). There is no other test framework in this
project — never add a new one-off `scripts/*.ts` "test" script; that pattern (60+ ad-hoc
`npx tsx scripts/test-*.ts` files, none using a real framework, 45+ already broken by schema/API
drift) was deleted 2026-07-09 for exactly this reason.

- **No running server, no Supertest.** Import the route's exported `GET`/`POST`/etc. directly from
  `route.ts` and invoke it with `callRoute()` (`tests/helpers/callRoute.ts`) — it builds a real
  `Request` and reads the real `Response`, exercising the full
  `withAuth`/`withRole` → service → repository → `ApiResponse` chain with no HTTP round trip.
- **The one exception** is `tests/integration/express-server.test.ts`, which starts the real Express
  app on a random port and checks the HTTP layer itself (routing, params, bodies, binary downloads,
  404/405, uploads, route list up to date). Extend that file for anything about the server layer;
  test business logic with `callRoute()`.
- **Auth**: mint tokens with `loginAs(email, password)` (`tests/helpers/auth.ts`) — it calls the
  real `authService.login`, so it's a genuinely signed JWT (password hash check included), not a
  forged token.
- **Fixtures**: `tests/helpers/db.ts` has `createTestUser`/`createTestAcademicYear`/`createTestTerm`/
  `createTestGrade`/`createTestClass`/`createTestStudent`. Extend this file with new factories
  rather than inlining ad-hoc Prisma calls per test.
- **Isolation**: call `resetDb()` (same file) in `beforeEach` — it truncates every app table.
  Repositories share one module-level `prisma` singleton rather than accepting an injectable
  per-call client, so transaction-rollback isolation isn't available; don't try to work around this
  per-test, extend `resetDb()`/the fixtures instead if something new is needed.
- **Schools in tests**: `resetDb()` creates "Test School A" and makes it the context for fixtures
  and direct calls; `createTestUser` makes the user an ACTIVE member of it (or of `schoolId`).
  For a second school use `createTestSchool()` and `inSchool(id, fn)`. Isolation is covered by
  `tests/integration/school-isolation.test.ts` — extend it when adding school-owned data.
- **Test database tables**: `tests/global-setup.ts` runs `prisma migrate deploy` against the
  `.env.test` database once per run (refusing any name not ending in `_test`), so a fresh test DB
  needs no manual step and new migrations are picked up.
- **Test database only**: `tests/setup.ts` loads `apps/server/.env.test` (a separate local Postgres DB, name
  ending in `_test`) before anything else and refuses to run if `DATABASE_URL` doesn't look like a
  test DB. Never point `.env.test` at the dev/prod database — `resetDb()` will wipe it.
- **Concurrency bugs need a real concurrent test, not a mock.** The enrollment-capacity race fixed
  this session (`features/enrollments/enrollment.service.ts`) was originally "fixed" with a bare
  `prisma.$transaction` wrap, verified only by code review — the integration test built to prove it
  (`tests/integration/enrollment.test.ts`, firing two real concurrent requests) caught that the wrap
  alone doesn't close the race under Postgres's default `READ COMMITTED` isolation, which needed an
  explicit `SELECT ... FOR UPDATE` row lock (see `enrollmentRepository.lockClassForUpdate`). If
  you're fixing a race condition, the test must actually run concurrent requests against a real DB —
  a single-threaded test proves nothing here.

## Security baseline

- Every route authenticates via `withAuth`, no exceptions, including internal/admin/debug tooling.
- Every service method that reads or writes data the user shouldn't universally see calls a
  permission/role check — including list/read endpoints, not just create/update/delete.
- **One-time passwords, never shared defaults.** Every new account and every reset gets its own
  random password from `features/auth/one-time-password.ts` (`issueOneTimePassword`), returned
  once in the API response for the person who created/reset it, optionally sent by SMS, and
  expiring after `OTP_TTL_HOURS` (default 24; `User.temporaryPasswordExpiresAt`). Never add a
  fixed password (`teacher123` was removed 2026-10-12).
- **Forced change is enforced by the server.** While `User.hasDefaultPassword` is true, `withAuth`
  answers every route except `/api/auth/me` and `/api/auth/change-password` with 403
  `PASSWORD_CHANGE_REQUIRED` (header `X-Password-Change-Required`, constants in
  `@school/shared/auth/password-change`); `authFetch` sends the person to `/change-password`.
  Any new account-creating path (office accounts in Phase 4) must use the same mechanism.
- No secrets, tokens, or real credentials in code, comments, or scripts, even for local dev — use
  `.env` (already gitignored) and clearly-fake placeholder values in seed scripts.
- The seed (`prisma/seed.ts`) has no fixed passwords: it uses `SEED_DEMO_PASSWORD` or prints a
  random one, marks demo accounts `hasDefaultPassword`, and refuses non-local databases unless
  `SEED_ALLOW_REMOTE=true`. Keep it that way.
- **Forgotten passwords** go through reset requests (Phase 4b, section above): the head/deputy
  or the office above resets them from the request. The only public routes are
  `/api/auth/login` and `/api/auth/forgot-password`.

## Server-side PDF generation

`@react-pdf/renderer`'s `renderToStream` is CPU-bound and blocks Node's single event loop for
several hundred milliseconds per document — while it's running, the whole server can't process
*any* other request, not just other PDF requests. Every server-side route that calls
`renderToStream` (currently `report-cards/[id]/pdf`, `admin/timetable/export-pdf`,
`teacher/classes/export-class-list`) MUST wrap that call in `pdfLimiter.run(...)`
(`apps/server/src/lib/pdf/pdf-limiter.ts`) — a semaphore that caps concurrent renders (`PDF_CONCURRENCY` env,
default 3) and queues the rest instead of letting them pile up and saturate the CPU. If you add a
new PDF-exporting route, wrap it too — don't call `renderToStream` directly.

Any loop that renders multiple PDFs in a single request (e.g. `export-pdf`'s `exportAll` case,
one render per class) must also `await` a yield back to the event loop between iterations
(`setImmediate`-based, see `yieldToEventLoop` in that route) — otherwise a single request can
monopolize the event loop for the loop's entire duration before anyone else gets served, even with
the limiter in place.

**Known limitation, by design, not yet fixed**: this bounds and queues the blocking, it doesn't
eliminate it — each individual render still blocks the event loop while it runs. A proper fix
(true non-blocking PDF generation) would move rendering into a `worker_threads` pool, but that
turned out to need a separate pre-compilation build step (Node can't execute the `.tsx` PDF
templates directly, and the server bundler (tsup) doesn't process files only ever reached via a
runtime `new Worker(path)` string) — real added complexity, not implemented, and not worth doing before
this is proven necessary at actual scale. Don't reach for `worker_threads` here without first
building and testing that separate build step end-to-end against a real production build.

## Uploaded files

Uploads (the school logo today) are written by the server to `UPLOADS_DIR` (default `uploads/` in
the folder the server starts from; `/server.js` sets `apps/server/uploads`) and served publicly at
`/uploads/<file>` — see `src/lib/files/uploads.ts`. Never write into a Next.js `public/` folder from
the server, and never put anything private in the uploads folder.

## Offline support (removed, 2026-08-10)

A Phase 1 read-only offline cache for the teacher module (service worker via `@serwist/next`,
`app/sw.ts` → `public/sw.js`, `NetworkFirst` caching for `/api/teacher/**` and `/api/terms`, plus
an install manifest and an offline banner) was built and shipped, but did not work reliably in
practice and has been fully removed — `@serwist/next`/`serwist` are no longer dependencies,
`next.config.ts` no longer wraps the config with Serwist, and `npm run build` runs plain
`next build` again (the earlier `--webpack` flag existed solely to satisfy Serwist).
**If offline support is revisited, don't just re-add the same service-worker approach without
first diagnosing why Phase 1 didn't work** — re-shipping the same broken mechanism helps no one.

## Before marking any task done

**How changes are verified (developer's instruction, 2026-10-15):** don't run the test suite,
builds or scripts in the assistant's workspace. Every delivery comes with a click-through
checklist in `docs/phases/`, which the developer works through and reports back. Keep writing
and updating integration tests for changed behaviour, but the developer runs them. A type check
(`tsc --noEmit`) to catch compile errors before handing over is fine.


1. Run `npm run lint` and `npm run typecheck` (repo root).
2. If you touched `apps/server/src/api/**`, re-check the route against the chain above — does it use
   `withAuth`, a service, and `ApiResponse`/`handleApiError`? No direct Prisma, no manual JWT
   parsing, no hand-rolled `Response.json`.
3. If you touched a hook or screen, confirm it calls the API through `api`/`apiRequest`/`authFetch`
   from `apps/school/lib/api-client.ts` rather than a bare `fetch` or its own token handling.
4. Don't claim something is fixed without having read the resulting file back.
5. `tsc`/`eslint` passing proves the code compiles, not that it behaves correctly. If you changed
   business logic in a service — anything involving a `$transaction`, concurrency, or a bug fix —
   that change isn't done until a test in `tests/integration/` (see "Integration testing" below)
   exercises the specific behavior or failure mode, not just a green typecheck. Run `npm test`.

## Where to look for more context

`docs/ARCHITECTURAL_ANALYSIS.md` has the full audit this file is derived from: a route-by-route
classification of the entire API surface, the data-layer transaction/migration issues, the frontend
dead-code inventory, and a phased remediation plan. If you're unsure whether something is an
established pattern or a past mistake, check there before assuming the existing code is right.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know (applies to `apps/school` / the screens only)

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
