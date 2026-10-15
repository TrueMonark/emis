# Teacher screen fixes + handing over the class register — what changed and how to test it

Built 15 October 2026. **One database migration**, `20261015120000_register_covers`, which adds
one new table. It doesn't touch existing data, so **don't run the seed**. Your passwords stay as
they are.

## What changed, in plain words

### The five issues you found (as `teacher@kaliweheights.example`)
1. **Classes page.**
   - The details panel on the right now scrolls.
   - The **Take Register** and **View Attendance** buttons stay at the bottom of the panel.
     A long class list used to push them out of sight, which is why it looked as if a class
     teacher couldn't take the register.
   - Several other side panels had the same scrolling problem and were fixed the same way:
     students, parents, teachers, subjects, departments, classes, notifications and "notify
     parents".
2. **Performance page (subject teacher).** A **Grid / List** switch above the learners.
   - The list shows one row per learner: CAT, mid-term and end-of-term scores, each with its
     trend and class position, plus the average.
   - The page remembers your choice. It shows 25 learners per page in list view and 10 in grid
     view.
3. **Attendance page (period register).** The register now fills the screen and scrolls, so
   you can see the whole class instead of only the first four learners.
4. **Assessments.** A published, closed assessment no longer puts a pop-up over the screen. You
   can open it and read the marks. A yellow note says "Entry window closed — view only", and the
   mark boxes stay locked.
5. **Class reports.**
   - **A class teacher can download all report cards for their class as one ZIP**, using the
     "Download all (ZIP)" button with progress. It only appears for your own class, once report
     cards exist.
   - **Click any learner to open their report card.**
   - The "Pending" status was the promotion decision, which is only made at the end of the
     school year. The column is now called **Promotion** and shows "—" until then. Hover over
     it for the explanation.

### New: the morning register belongs to the class teacher, who can hand it over
- **Period attendance** (in a lesson) stays with the subject teacher whose period it is, as
  before.
- **The daily class register can now only be taken by:**
  - the class teacher;
  - the head or deputy;
  - a teacher the class teacher has handed it to.

  Before, any teacher could technically submit any class's morning register. The server now
  refuses this with "Only the class teacher (or a teacher covering for them) can take this
  class's register".
- **Hand over register.** On My Classes, a class teacher picks:
  - another teacher;
  - the first and last day;
  - optionally a reason (e.g. a workshop).

  For those days, that teacher sees the class under **Class Teacher → Covering the register**,
  with a "Covering until 18 Oct" badge, and can take and view the register.
- **A cover is limited:**
  - it gives the register and the class list only: no report cards, no exports, nothing else;
  - only one cover at a time per class;
  - at most 90 days. For longer, assign a new class teacher.
- **The head or deputy can arrange a cover too**: Classes → open a class → Class Teacher →
  **Hand over register**. Use this when the class teacher couldn't arrange it themselves.
- **Cancel** a cover in the same window (for example, when the class teacher is back). Registers
  the covering teacher already took are kept.

## Verified on my side
Type checks pass for the server and the school app. As agreed, I didn't run the tests or a build
here. The tests below are for you to run.

New and updated tests:
- New `register-covers.test.ts` checks:
  - only the class teacher or head/deputy can take the morning register;
  - handing it over works, and the covering teacher sees the class;
  - cancelling takes the register back;
  - who can arrange a cover, and the date rules;
  - the teacher picker;
  - another school can't see or touch the covers.
- Three older attendance tests now make their teacher the class teacher first, because the
  morning register now requires it.

## Steps

### 1. Get the files in place
1. Unzip `emis-teacher-fixes.zip` over the project folder (`C:\Users\truem\Documents\projects\emis`)
   and let it replace files.
2. In a terminal in `apps\server`:
   ```
   npm run db:migrate:deploy
   ```
   You should see `20261015120000_register_covers` applied.
3. Run the tests (they use your `_test` database, as always):
   ```
   npm test
   ```
   [ ] All pass, including `register-covers.test.ts`.
4. Start the app as usual (`npm run dev` at the project root).

### 2. Click through the fixes, signed in as `teacher@kaliweheights.example`
- [ ] **My Classes:** select your class.
  - [ ] The student list on the right scrolls.
  - [ ] **Take Register** and **View Attendance** are visible at the bottom.
  - [ ] Take the register and save. You see "Attendance saved successfully!".
- [ ] **My Classes on a phone-width window:** tap the class.
  - [ ] The sheet scrolls.
  - [ ] Take Register is at the bottom.
- [ ] **Performance:** switch to **List**.
  - [ ] There's one row per learner with CAT / Mid-term / End of term / Average.
  - [ ] Reload the page. It stays on List.
  - [ ] Switch back to **Grid**.
- [ ] **Attendance:** open a period register. You can scroll through the whole class.
- [ ] **Assessments:** open a published assessment whose entry window has closed.
  - [ ] There's no pop-up.
  - [ ] There's a yellow "view only" note.
  - [ ] The marks are readable but locked.
- [ ] **Reports:** choose your own class and a term.
  - [ ] Click a learner. Their report card opens.
  - [ ] **Download all (ZIP)** shows progress, then downloads a ZIP of PDFs.
  - [ ] The Promotion column shows "—". Hovering explains why.
  - [ ] Choose a class where you're only a subject teacher. There's no "Download all" button.

### 3. Hand the register over
- [ ] As `teacher@kaliweheights.example`, go to My Classes, select your class and click
  **Hand over register**.
  - [ ] Pick **Brian Chanda**, from today to three days from now, with the reason "Workshop".
    Click **Hand over**.
  - [ ] The cover appears under "Current and upcoming covers".
  - [ ] Try handing over the same days to someone else. It's refused: "… is already covering
    this register …".
- [ ] Sign in as `brian.chanda@kaliweheights.example`. On My Classes → Class Teacher, under
  **Covering the register**:
  - [ ] The class is there with "Covering until …".
  - [ ] Select it. "Covering for Esther Banda" shows, with **Take Register** and View Attendance.
  - [ ] There's no export button.
  - [ ] Take the register and save. It succeeds.
- [ ] Sign in as another teacher, e.g. `agness.phiri@kaliweheights.example`. The class isn't
  under "Covering the register".
- [ ] Back as `teacher@kaliweheights.example`, open Hand over register and click **Cancel** on
  the cover.
  - [ ] Signed in as Brian again (refresh), the class is gone from "Covering the register".
- [ ] As `head@kaliweheights.example`: Classes → open the class → Class Teacher → **Hand over
  register**.
  - [ ] The same window opens and works.
  - [ ] Signed in as the clerk (`admin@kaliweheights.example`), that button isn't there.

> The register can only be taken for a day inside the active term. If the demo term has
> already ended, Take Register will say the date is outside the term. That's expected, not a
> bug.

### 4. Commit
In GitHub Desktop, commit with a message like "Teacher screen fixes and register hand-over" and
push.
