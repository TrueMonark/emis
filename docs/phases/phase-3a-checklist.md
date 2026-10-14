# Phase 3a: many schools in one database — what changed and how to test it

Built 15 October 2026. **One database migration**, `20261012180000_phase3a_schools_and_isolation`.
It moves your existing data into one school by itself, so **don't run the seed**, and your
passwords stay as they are.

## What changed, in plain words
- **Schools, offices and memberships.** The database now knows about:
  - education offices: Ministry HQ, the 10 provincial offices, and a "District not yet
    assigned" office until the official district list is loaded;
  - schools, each with an EMIS number (optional for now), category and district office;
  - **memberships**: who works at which school, with which role.
- **Your existing data became one school.** It's named after Settings → School Info (or "School
  name not set"), and every existing account became a member of it.
- **Each school only sees its own data**, and the database enforces this itself (row-level
  security). Even a query without a school filter can't see or change another school's rows.
- **Per-school numbering.** Subject codes, department codes, student numbers, years and so on
  are now unique **within** a school. Two schools can both have subject code "MATH" or student
  number "STU-2026-0001".
- **Signing in** finds the school you work in from your membership. One login page serves the
  whole country.
  - Someone without an active membership (left, or transferred out) gets: "Your account isn't
    linked to a school at the moment. Contact your head teacher or district office."
  - A transfer waits as "pending" while the teacher keeps working at the old school. When it's
    confirmed, the same account moves over. The database refuses two active schools at once.
- **Head teacher and deputy head have the same rights**, and the old "Administrator" role
  became Head Teacher. The deputy now gets the full head's screens. Before, deputies were sent
  to a page that didn't exist. "Administrator" is gone from the role choices.
- **A new teacher joins the school of the person who created them.**
- **Sidebar name:** comes from the school's own record. Saving a name in Settings → School Info
  updates it. Clearing the name there no longer blanks the sidebar, because the school keeps its
  registered name.
- **School-specific caches** (school info, logo for PDFs) are kept per school, so one school's
  logo or name can never appear on another school's report cards.

## Verified before handover (on my side)
- **Tests:** 53 test files, 312 tests passed, including 5 new tests for keeping schools apart:
  - another school's learner can't be listed, opened, changed or deleted;
  - the same codes and numbers work in two schools;
  - teacher and user lists only show the school's own staff;
  - raw database queries see nothing of another school, and writing into another school is
    refused;
  - signing in, pending transfers, confirmed transfers and ended memberships behave as
    described above.

  Twelve older tests expected the deputy to be refused things only the head could do; they now
  check that a **teacher** is refused instead.
- **Migration:** applied to a copy of a database in use before this phase:
  - one school was created with the right name;
  - 7 accounts got memberships;
  - Admin became Head Teacher;
  - every row got its school;
  - the database lock shows nothing without a school and nothing of another school.
- **Seed:** works on an empty database ("Demo School") and on a migrated one, and running it
  twice is fine.
- **Browser walk-through:**
  - Kabompo head, the deputy and a second school's head ("Ndola School K") each see their own
    school's name and data;
  - School K's teacher list is empty while Kabompo's shows its 7;
  - all 31 admin pages and 8 teacher pages open. The only errors were "No active academic
    year found" on the timetable pages, because that database has no academic year. That's
    expected, and exactly what the planned first-login setup will prevent.
- **Checks:** type check passes; lint has no new errors (331).

## Your checklist
Unzip, then in PowerShell, from the `emis` folder:
```powershell
npm run db:migrate:deploy
npm run dev
```
The migration output should end with "All migrations have been successfully applied".

- [ ] Log in as your head teacher (admin@school.gov.zm) with **your own** password. It still
      works.
- [ ] The sidebar shows your school's name and "Monark Devs". Your students, teachers, classes
      and subjects are all there, as before.
- [ ] Profile (bottom left): your role shows **Head Teacher**, not Admin.
- [ ] Permissions page → the role filter and the role choices no longer offer "Administrator".
- [ ] Change one teacher's role to **Deputy Head** (Permissions → user → Role). Log in as that
      person: you land on the same dashboard as the head, with the same menu. Change the role
      back if you like.
- [ ] As head: Teachers → Add Teacher. Log in as the new teacher (one-time password, then
      choose your own). They see your school's name in the sidebar.
- [ ] Settings → School Info: change the school name and save, then reload. The sidebar
      follows.
- [ ] Log in as teacher1 and the HOD account. Their pages work as before.

Tell me what passes, and what fails with what you see.

## Not yet (planned)
- **No screens yet** for creating schools, offices or transfers. Those are the district/provincial
  office app and the account chain in **Phase 4**, together with the first-login setup for a new
  school's head teacher.
- **District offices:** only "District not yet assigned" exists until the official list is
  loaded (still wanted: the official list of education district offices).
- **Staff numbers are still unique nationally**, because they live on the person's teacher
  profile. Two schools can't both use the same staff number yet. They move to the school
  membership in a later phase.
- **Former staff:** a teacher who has moved to another school still appears in the old school's
  teacher list. A "former staff" filter comes with transfers in Phase 4.
- **Grades** (Grade 1–12) are still one national list. Phase 3b replaces them with per-school
  year levels (Grade and Form side by side).
