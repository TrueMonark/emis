# Phase 1 — new layout + API on its own server: what changed and how to test it

## What changed

- The project is now a monorepo: `apps/server` (the API), `apps/school` (the screens),
  `packages/shared` (code both use). See the root `README.md`.
- The API runs on **Express** instead of inside Next.js. All 181 routes, the business logic and
  the database code moved over unchanged. Only the Next.js-specific types were swapped for
  standard ones.
- The school logo is now stored in the server's `uploads/` folder and served at
  `/uploads/school-logo.png` (it used to be written into the Next.js `public/` folder).
- `server.js` at the root still starts everything as one program on one port, as before.
- Dropped: 46 one-off `check-*`, `seed-teacher2-*`, `diagnose-*` scripts, `login-404-test.mjs`, and
  their `package.json` entries. (Still in git history if ever needed.)
- **No database changes.**

## Verified before handover

- All 49 original test files (288 tests) pass on the new server, plus a new test file (8 tests)
  covering the Express layer over real HTTP: 50 files, 296 tests.
- Type check passes for all three packages. Lint: no new problems (342 existing errors, down from
  359 because the dropped scripts are gone).
- Browser walk-through as admin, HOD and teacher (62 pages) in both modes (all-in-one and
  two-program development): same pages, same headings, same API responses as the original code
  against the same database.

## Your checklist

Set-up (once): `npm install` at the root, copy your old root `.env` to `apps/server/.env`,
copy `apps/server/.env.test.example` → `apps/server/.env.test` (test database), then
`npm run db:migrate:deploy`.

- [ ] `npm test` → 50 files, 296 tests pass.
- [ ] `npm run typecheck` → no errors.
- [ ] `npm run dev` → both `[server]` and `[school]` start; http://localhost:3000 opens the login page.
- [ ] Log in as admin, HOD and teacher; each lands on their usual dashboard.
- [ ] Admin: students list, teachers list, classes, report cards, timetable, settings all load as before.
- [ ] Admin → Settings → School info: the logo shows. (First copy your old `public/school-logo.png`
      to `apps/server/uploads/`.) Upload a new logo → it appears; delete it → it goes.
- [ ] Teacher: download a class list as PDF and as CSV; download a report-card PDF.
- [ ] Teacher: take attendance for one class and save; enter some marks and save.
- [ ] `npm run build` then `npm start` → http://localhost:3000 works the same as in dev mode
      (this is the mode the host uses).
- [ ] When happy: commit and push (see `docs/phases/applying-phases-1-2.md`).

## Existing bugs found (not caused by this phase; for Phase 2)

- Several screens call the API with plain `fetch` without the login token, so they get "401
  Unauthorized": admin **Academic Years**, **Terms** and **Assignments** pages (the lists stay empty).
- Admin **New Department** asks the API for users with role `HOD`, which no longer exists as a
  role → "422" error when loading the HOD picker.
- `public/` contains what look like real school documents (`Kambombo Day Opening update.pdf`,
  an ICT Grade 8 analysis PDF, generated timetable PDFs in `public/TimeTable/`). Anything in
  `public/` can be downloaded by anyone who knows the address — they should be removed.
- Unused leftovers in `public/` (Next.js sample SVGs, PWA icons, fonts) and duplicate folders in
  `components/` (`parent` + `parents`, `teacher` + `teachers`).
