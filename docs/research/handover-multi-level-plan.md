# Handover: School Management System, multi-level (PEO → DEBS → School)

> **For the next chat:** this file is the brief. The owner (Caleb) will attach the project zip
> (`schoolmanagement-main`). Read this file, then the project's own `CLAUDE.md`, before writing
> any code. The owner prefers plain-language explanations, phased delivery, a checklist to test
> each phase, and zips of only the changed files.

---

## 1. What the owner wants

1. **Tidy the codebase** so it has a clear Next.js structure: shared components, consistent folders,
   no clutter. He compared it to another project he built (a multi-agency law-enforcement system),
   which has a strict shared-components layout.
2. **Turn the single-school system into a multi-level one** that mirrors how Zambia's education
   system is managed:

   ```
   Ministry of Education      (not in the system for now)
     └─ PEO office (Provincial Education Officer), one per province
          └─ DEBS office (District Education Board Secretary), one per district
               └─ Schools, which use the system exactly as it works today
   ```

   - **Schools** do everything the current system does, and nothing new.
   - **DEBS offices** see information from all the schools in their district.
   - **PEO offices** see all the DEBS offices in their province and how each district's schools are performing.
   - **Accounts are created top-down:**
     - the **super admin** (the owner) creates PEO offices;
     - a **PEO office** creates DEBS offices in its province;
     - a **DEBS office** creates school accounts in its district and hands each school its login.
   - The Ministry is left out for now, but the design should allow adding it later as a national level.

> The owner said "PO"; the correct Zambian title is **PEO (Provincial Education Officer)**. Use
> PEO in the UI, and confirm with him.

---

## 2. What the existing system is (checked, not assumed)

- **Stack:** Next.js 16 (App Router) + React 19, PostgreSQL via Prisma 6, JWT auth (`jsonwebtoken`),
  Tailwind v4 + Radix UI (shadcn), Zod, Sonner, Vitest.
- **Size:** about 130,000 lines across `app/`, `features/`, `lib/`, `components/` and `hooks/`. There are 181 API
  routes, 77 pages, and 34 integration tests.
- **The architecture is already good,** and is written down as binding rules in the project's `CLAUDE.md`:
  `route.ts → withAuth() → features/*/x.service.ts → features/*/x.repository.ts → ApiResponse`.
  It has typed errors, Zod validation, a logger, and integration tests that call routes directly against a test DB.
- **Roles** (one school): `ADMIN > HEAD_TEACHER > DEPUTY_HEAD > {TEACHER, CLERK}`. HOD is a
  *position* derived from `Department.hodTeacherId`, not a role. There are also per-user permission
  overrides. Dashboards are split into `app/(dashboard)/admin`, `teacher` and `hod`, with separate mobile layouts.
- **⚠ It is single-tenant.** There is **no `School` model**, and no table has a `schoolId`. School details
  live in `SystemSettings` as one global set. This is the main obstacle to the multi-level plan.
- **Clutter worth cleaning:**
  - `docs/` has 76 files, many of them session notes or outdated plans.
  - `components/` has both `parent/` and `parents/`, and both `teacher/` and `teachers/`.
  - There's a stray `login-404-test.mjs` at the root.
  - There are many one-off `seed:teacher2…` and `fix:…` scripts in `package.json`.
  - `CLAUDE.md` notes that **12 models have no migration**.

---

## 3. Advice given (agreed direction, to confirm with the owner)

### 3.1 Restructure, don't rewrite
The code is large and its core pattern is sound. A from-scratch "remake" would take months and
reintroduce bugs the tests already catch. Instead:
- **Keep** the route → service → repository chain and the `features/` folders.
- **Restructure the UI side** into a clear layout, for example:
  ```
  app/(auth)/…                    login, change password
  app/(school)/…                  today's admin / teacher / hod areas, unchanged in behaviour
  app/(oversight)/debs/…          new: district dashboards
  app/(oversight)/peo/…           new: provincial dashboards
  app/(platform)/…                new: super-admin (create PEO offices)
  components/ui/                  shadcn primitives only
  components/shared/              tables, stat cards, page headers, dialogs used everywhere
  components/<domain>/            one folder per domain (merge parent+parents, teacher+teachers)
  features/<domain>/              unchanged pattern
  ```
- Move `docs/` notes into `docs/archive/`, keeping only a few living documents (architecture, setup, `CLAUDE.md`).
- Remove the stray scripts.
- **Do the clean-up as its own phase, before the multi-level work,** with the existing tests passing after each step.

### 3.2 Make it multi-tenant: one system, many schools
- **One deployment and one database for all schools**, not a copy per school. That's the only way DEBS
  and PEO can see across schools.
- Add the hierarchy:
  - `Province` (10), `District` (≈116, seeded from the official list).
  - `EducationOffice` (`type: PEO | DEBS`, `provinceId`, `districtId?`).
  - `School` (`districtId`, EMIS number, name, level, contacts).
- Add **`schoolId` to every school-owned table** (students, classes, teachers, assessments,
  attendance, report cards, settings, SMS logs…). Move `SystemSettings`' school details onto `School`.
- **Enforce the separation in the database with PostgreSQL Row-Level Security**, as the owner's
  law-enforcement system does: each request sets the current school (or office scope), and the database
  refuses rows outside it. Application `where` clauses alone are too easy to forget across 181 routes.
  - Lesson learned there: Prisma queries are lazy, so the RLS context must be set *in the same
    transaction* as the query, and any "run as" helper must `await` inside the context.
- **Migrating existing data:** create one `School` for the current data, backfill its `id` into every
  table, then make `schoolId` required.

### 3.3 Accounts and access
- **Users get a scope:**
  - **platform** (super admin);
  - **an office** (PEO or DEBS): roles `OFFICE_ADMIN`, `OFFICE_OFFICER`;
  - **a school:** the current roles, unchanged.
- **Who creates whom** is enforced on the server, not just hidden in the UI:
  - super admin → PEO offices and their first admin;
  - PEO → DEBS offices in **its own province only**;
  - DEBS → schools in **its own district only**.
  - The school's first account is its **ADMIN** (typically the head teacher). It's created with a
    one-time temporary password and must be changed at first login. The current `hasDefaultPassword` flag already supports this.
- **DEBS and PEO are read-only over schools.** They see and report; they don't edit a school's marks or registers.
- Deactivating an office or school disables its logins without deleting its data.
- Every account creation and deactivation is recorded in an audit log.

### 3.4 What flows upward: aggregates, not learners' personal files
- DEBS and PEO dashboards show **figures**: enrolment by grade and sex, attendance rates, pass rates and
  grade distributions per subject, teacher numbers and staffing gaps, report-card completion, and
  schools that are behind on submitting.
- **Children's personal data stays with the school by default.** DEBS and PEO see counts and
  percentages, not named learner records. Zambia's **Data Protection Act, 2021** applies to children's
  data. If named access is ever needed (for example a transfer or a welfare case), make it a specific,
  logged permission.
- Compute aggregates from the school data with SQL `GROUP BY` queries scoped by district or province.
  Add cached summary tables later only if speed demands it.

---

## 4. Proposed phases

| Phase | Content | Done when |
|---|---|---|
| **S1: Clean-up** | Folder restructure per 3.1, merge duplicate component folders, archive docs, remove stray scripts, give the 12 un-migrated models proper migrations | App behaves identically; all integration tests pass |
| **S2: Tenancy foundation** | `Province`, `District`, `School` models; `schoolId` on all school tables; backfill the existing data as one school; RLS policies; request context sets the school | Two seeded schools cannot see each other's data, through the UI or direct API calls |
| **S3: Offices and account chain** | `EducationOffice`, user scopes, platform super-admin area, PEO → DEBS → school creation, first-login password change, deactivation, audit log | The full chain works, and a DEBS can't create a school outside its district |
| **S4: DEBS dashboard** | District overview, per-school comparison, "behind on submissions" list, drill-down to one school's figures | Figures match the schools' own reports |
| **S5: PEO dashboard** | Province overview, per-district comparison, drill-down to a district | Same |
| **Later** | Ministry (national) level, data exports, school-to-school learner transfer | — |

---

## 5. Open questions for the owner

1. **"Facebook thing":** in his first message he mentioned wanting "a facebook thing", then switched to
   voice and described the account hierarchy instead. Confirm whether that *was* the account idea, or
   whether he also wants something social (school pages, posts or announcements to parents, a feed).
2. **What DEBS and PEO must see:** which figures, exactly? Ideally get a sample of the returns schools
   currently send to DEBS, since the dashboards should reproduce those.
3. **Named learner data:** may DEBS ever see individual learners, and in which cases?
4. **School identity:** use the official **EMIS number** as the school's unique ID?
5. **Who is super admin** in real deployment: the owner, or the Ministry?
6. **Hosting:** where will the single shared deployment run, and who pays for it? (The current
   `server.js` and the `Deployment Options.md` doc may already cover this.)
7. **Schools already using the current system**, if any: do they need their data migrated into the new setup?

---

## 6. How to work in this repo

- **Follow the project's `CLAUDE.md` exactly.** It's binding:
  - no Prisma in routes;
  - no manual JWT parsing;
  - `ApiResponse` only;
  - no second implementation of anything;
  - `prisma migrate dev`, never `db push`.
- **Run the integration tests** (`npm test`, against `.env.test`) after every change. Add tests for tenant isolation in S2.
- **Deliver per phase:** a zip of changed files, the migration steps, and a checklist for the owner to test.
  He commits and pushes himself after testing.
