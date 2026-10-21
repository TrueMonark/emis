# Phase 3c: offline-ready data — what changed and how to test it

Built 16 October 2026. **One database migration**, `20261016150000_phase3c_change_log`. It adds a
column and two triggers to 16 tables and a new `change_log` table. Existing data isn't changed,
so there's no need to back up first, though it never hurts. Don't run the seed.

There are **no new screens**: this is the groundwork the phone sync (Phase 5) and the teacher's
phone app (Phase 6) are built on. Everything works as before.

## What changed, in plain words
- **Every record a phone may hold now has a version number.** It's raised by one each time the
  record really changes. When a phone sends a change later, it says which version it last saw,
  so the server can tell whether someone else changed the record in the meantime.
  - The 16 tables are: academic years, terms, year levels, classes, subjects, class subjects,
    learners, enrolments, class-teacher and subject-teacher assignments, timetable slots,
    assessments, marks, attendance, lesson logs and register covers.
- **A change log.** Every new, changed or deleted record in those tables gets one line in the log:
  - what it was and which record;
  - new, changed or deleted;
  - when, and by whom.

  The database writes these lines itself, so no screen or import can forget to. The app can read
  its own school's lines but can't write, change or delete them.
- **Deletions reach phones that were offline.** A deleted record leaves a "deleted" line in the
  log, so a phone that comes back online after a week still learns it's gone. The record itself is
  still really deleted. (The design said to keep deleted records with a "deleted" mark; the log
  line does the same job without every screen having to hide deleted records.)
- **A safe "what's new since last time" marker for phones.**
  - A phone remembers a marker and asks "what changed since?".
  - The marker is built on database transactions, not on line numbers. A long job, such as
    generating a whole class's report cards, can never be skipped just because it finished after
    a quicker change.
  - Nothing is ever sent twice.
- **A teacher's phone gets their own data only:**
  - their classes: class teacher, subject teacher, timetabled or covering the register;
  - those classes' learners and enrolments;
  - their timetable and lesson logs;
  - for their own class, all assessments and marks; elsewhere, only their subjects';
  - this term's attendance for their classes.

  Nothing about other classes or other teachers. For a deleted record, only the fact that it was
  deleted is passed on, never its details.

## Verified on my side
Type checks pass. As agreed, I didn't run the tests or the migration here.

New test file `change-log.test.ts`:
- inserts, updates and deletes are logged with the user, and the version goes up only on real
  changes;
- the app can't write, change or delete log lines;
- each school reads only its own changes;
- **a transaction that commits late isn't skipped, and nothing is repeated**: a real slow
  transaction runs alongside a quick one, plus paging;
- a teacher's scope holds their own classes, learners and assessments only;
- the changes for a teacher hold only in-scope records, plus deletion lines.

## Your checklist
1. Unzip `emis-phase-3c.zip` over the project folder and let it replace files.
2. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   npm test
   ```
   - [ ] The migration ends with "All migrations have been successfully applied".
   - [ ] All tests pass, including `change-log.test.ts`.
3. `npm run dev`, then click around as before: take a register, enter some marks, edit a learner.
   - [ ] Everything works as before. There's nothing new to see on screen.
4. Optional, to see the log yourself: in a second terminal, run `npm run db:studio` and open the
   **ChangeLog** table.
   - [ ] There's one line per thing you just did (e.g. `attendance_records` · INSERT), with your
     user id in *changedBy*.
   - [ ] Open the record you edited (e.g. in **Student**). Its *version* is 2 or more.
5. Commit in GitHub Desktop: "Phase 3c: offline-ready data (versions, change log, teacher scope)",
   then push.

Tell me what passes, and what fails with what you see.

## Not yet (planned)
- **Phase 5, the sync API:** the actual pull and push endpoints a phone calls, built on this. That
  includes conflict rules (e.g. late marks after the entry window are refused) and safe re-sending
  after a dropped connection.
- **Phase 6, the teacher app (Expo):** offline registers and marks.
- **Keeping the log small:** old log lines will be cleared after a set time (e.g. 90 days). A
  phone that has been away longer downloads its data afresh. This comes with Phase 5.
- **Phase 4** (account chain, first-login setup for a new school, password-reset requests,
  transfers) can come before or after Phase 5. Tell me which you'd like next.
