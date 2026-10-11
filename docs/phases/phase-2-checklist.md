# Phase 2 — clean-up and shared UI package: what changed and how to test it

Builds on Phase 1. **No database changes. No API changes.**

## What changed

### Bugs fixed (all existed before; none caused by Phase 1)
- **Screens that never loaded their data.** Admin *Academic Years*, *Terms*, *Assignments*, a
  student's *Attendance* and *Enrollments* pages, and a teacher's *Assignments* page called the API
  without the login token (21 calls), so the server refused them ("401"). They now go through a
  new `authFetch()` in `lib/api-client.ts`, the one place the token is attached.
- **Terms page stuck on "Loading…"** when no academic year was active (normal for a new school).
  It now selects the most recent year.
- **New Department: HOD list failed** (asked for a "HOD" role that no longer exists). It now lists
  all active teachers, like the edit dialog.
- **Edit Department: HOD list showed only the first 10 teachers.** Now shows all active teachers.
- **Developer "TODO" cards shown to users** on 7 admin screens removed. Their ideas are kept in
  `docs/backlog.md`.

### Clean-up
- **`public/`**: removed the pilot school's documents (`Kambombo Day Opening update.pdf`, the ICT
  Grade 8 analysis PDF, 7 timetable PDFs), the pilot school's logo, Next.js sample images, unused
  app icons and fonts. Only `templates/student_import_template.csv` remains.
- **Unused code**: 6 files nothing used (found with `knip`, double-checked by search), and 3 unused
  development packages.
- **Components reorganised by domain** (18 folders, no loose files): `parent` + `parents` merged;
  role-named folders (`admin`, `hod`, `teacher`, `dashboard`) replaced by domain folders
  (`reports`, `attendance`, `assessments/hod-review`, `notifications`, `performance`, `layout`);
  the "shared" tables moved into their domains.
- **New `packages/ui`**: the 32 shadcn/Radix building blocks, the stats card, `use-toast`,
  `use-mobile` and `cn()`, so the office app can use the same ones. Imported as
  `@school/ui/components/button` etc.
- **Docs**: 62 old session notes/plans moved to `docs/archive/`; current docs sorted into
  `docs/domain/`, `docs/timetable/`, `docs/integrations/`; `docs/README.md` explains what's what.

## Verified before handover
- 50 test files / 297 tests pass; type check passes for all 4 packages; lint 333 errors (342 after
  Phase 1, 359 originally — no new ones).
- Browser walk-through, 62 pages as admin/HOD/teacher, compared with the original code on the same
  database: 7 failing calls fixed, no new failures, same pages and headings (Terms now shows its
  heading instead of "Loading…").
- Screenshots of 12 pages compared pixel by pixel with the original: identical, except Academic
  Years (now shows the year list instead of an error, and no TODO card). Styling is unaffected by
  the move to `packages/ui`.

## Your checklist

After unzipping: `npm install` at the root (new package `@school/ui`).

- [ ] `npm run typecheck` and `npm test` → no errors, 297 tests pass.
- [ ] `npm run dev` → log in as admin. Pages look exactly as before (buttons, dialogs, sidebar).
- [ ] Admin → **Academic Years**: your years are listed (before: empty + error).
- [ ] Admin → **Terms**: terms for the year are listed; switch year works.
- [ ] Admin → **Assignments**: the filters fill with teachers, subjects, classes.
- [ ] Admin → Students → a student → **Attendance** and **Enrollments**: data shows.
- [ ] Admin → Teachers → a teacher → **Assignments**: data shows.
- [ ] Admin → Departments → **New Department**: the HOD list shows teachers. Create one with an HOD.
- [ ] Admin → Departments → edit a department: the HOD list shows **all** teachers (not just 10).
- [ ] No "TODO" cards on any admin screen.
- [ ] `npm run build` then `npm start` → same as dev.

## Security note
- The demo accounts from the old seed script (`admin@school.gov.zm` / `Admin@123`, …) are written
  in the old docs (now `docs/archive/`). Any database that was ever seeded with them should have
  those passwords changed or the accounts deactivated.

## Follow-up fixes (11 October 2026, same delivery)
- **Dates now DD/MM/YYYY everywhere.** 39 date displays on screens used the browser default or
  US style ("1/12/2026" for 12 January); they now use "en-GB". Server-made dates and times (PDFs,
  CSVs, SMS, marks-entry window messages) now use Zambian time, so a UTC host clock no longer
  shifts them. New test: the entry-window message shows "15:00" for 15:00 Zambian time even on a
  UTC clock.
- **The pilot school's name is no longer built into the code.** Report cards, class lists and the
  PDF header showed "Kambombo Day Secondary School" when a school hadn't entered its name; they
  now show "School name not set" so the gap is obvious. The settings screen examples are generic.
- **All 174 remaining API calls that added the login token by hand now use `authFetch`.** One
  place attaches the token; about 85 now-unused token lookups were removed. Same walk-through result.
- **Seed script made safe.** No fixed demo passwords any more (`SEED_DEMO_PASSWORD` or a random
  one printed once); demo accounts are marked "must change password"; it refuses to seed a
  database that isn't on your own computer unless `SEED_ALLOW_REMOTE=true`.

Extra checks for these:
- [ ] Dates on Academic Years, Terms, student attendance and the admin dashboard show day first.
- [ ] Settings → School Info → clear the school name (or use a fresh database): a report-card PDF
      shows "SCHOOL NAME NOT SET", not another school's name. Put the name back.
- [ ] `npm run db:seed` on a fresh local database prints a password; logging in with it works.

## Still open (planned)
- The server doesn't yet *enforce* "must change password" (only the screens prompt). Planned for
  Phase 4 with the account chain, where new school admins get temporary passwords.
