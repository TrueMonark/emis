# Phase 9b: SBA score sheets — what changed and how to test it

Built 4 November 2026. **One database migration**: `20261104090000_sba_score_sheets`.

## What changed, in plain words

### Every teacher keeps their own SBA sheets
- **Teacher → SBA score sheets** (new menu item, also for HODs and in the phone-width menu):
  - "My sheets" lists every subject you teach in each **Form 1–4 class on the 2023
    curriculum** this school year.
  - **Start** creates the sheet: six tasks, two per term (Tasks 1–2 Term 1, 3–4 Term 2, 5–6
    Term 3), each out of 100 to begin with.
- **The tasks work like assignments.** For each one you set:
  - a name, e.g. "Statistics survey";
  - a date;
  - what it's marked out of, e.g. 20 or 40.

  You can change a maximum until the HOD approves the sheet, but not to less than a mark you've
  already given.
- **Marks:** type each learner's mark, or **A** for absent.
  - A mark above the task's maximum turns red and won't save.
  - Absent counts as 0, but the task still counts in the "out of", as with a missed
    assignment.
  - The **total** (and %) is worked out as you type.
  - Each learner also has their **ECZ examination number** and the teacher's **overall
    comment**.
  - Press **Save** as you go.
- **Submit to HOD** works once every learner has a mark or A for all six tasks. The page says
  how many learners are still missing marks.

### Sign-off: teacher → HOD → head
1. **The HOD of the subject's department** (SBA score sheets → "To check") opens the sheet and
   either **approves** it, or **sends it back** with what to correct. The teacher sees the
   comment, corrects the sheet and submits again.
   - The head teacher or deputy can also act for a department that has no HOD.
   - Nobody approves their own sheet.
2. **The head teacher or deputy** (Head → SBA score sheets → "To check or confirm")
   **confirms** it. It's then final.
   - The head or deputy can **reopen** an approved or confirmed sheet, with a reason.
3. **Notifications** (the bell) go to the HOD on submit, to the teacher when it's sent back or
   confirmed, and to the head when the HOD approves.
4. **History:** every step, with who, when and the comment. Nothing can be removed.
- The head sees **all sheets in the school**, plus a list of **who hasn't started** which
  subject and class. An HOD sees the same for their department.

### The printed score sheet (the hard copy)
- **Score sheet** on any sheet opens the printout in a new tab, set for A4 landscape. It
  follows the ECZ SBA score sheet layout:
  - **Header:** Centre/School Name, Centre Code, Subject Name, Subject Code, Province, District,
    Form, Year.
  - **Table:** S/N, Learner's Name, Examination Number, the **earlier Form's six tasks and
    total**, **this Form's six tasks and total**, the **Total Score**, and the teacher's
    comment. Each task heading shows its term and what it's out of.
  - **Footer:** Teacher's Name and TS No (the staff number), Signature, Date, Head Teacher's
    Name and TS No, Signature, and the Date Stamp box.
- **Form 2 and Form 3 on one sheet:**
  - The Form 3 printout fetches each learner's **Form 2 tasks from last year's sheet** in the
    same subject, whoever kept it.
  - A first-year (e.g. Form 2) printout shows this year on the left, with the next year's
    columns left empty.
- **It carries no ECZ logo or coat of arms.** Those are ECZ's and Government's own, and the
  system shouldn't reproduce them. Use the paper form's official header if ECZ requires it.
- Until the head confirms the sheet, the page says it's a working copy. That note isn't printed.
- **ECZ centre code:** the head enters it once on **School profile**, and it goes on every
  score sheet.

### The DEBS, PEO and HQ see progress only
- **Office → SBA progress** (new) shows, for each school:
  - how many sheets are **expected** this year (one per teacher, subject and Form 1–4 class
    on the 2023 curriculum);
  - how many are **not started**, being **filled in**, **with the HOD**, **with the head**,
    and **confirmed**.

  It also has a "confirmed, lowest first" bar list and a CSV.
- **No marks, names or comments leave the school.** The database only gives the offices
  counts.

### Demo school (Cranes)
After a fresh wipe and seed, **Esther Banda (teacher@cranes.example)** has a Maths SBA sheet for
her Form class on the 2023 curriculum:
- Tasks 1–4 (Terms 1–2) are marked, out of 20, 30, 20 and 40.
- Tasks 5–6 are still open, so it's a draft you can finish and submit.

### Assumptions to confirm
- **Which classes:** Forms 1–4 on the 2023 curriculum. The ECZ sheet you sent is Form 2 &
  Form 3. Tell me if Grade-named classes or other levels need SBA too.
- **Task maxima:** set by each teacher for each task, as you chose. When the official rule is
  known (e.g. every task out of 20), I can fix it nationally.
- **"Total" on the sheet** is the sum of the marks, out of the sum of the maxima, with % on
  screen. The ECZ form doesn't say whether it wants raw totals or a percentage. Tell me if
  it's different.

## Verified on my side
- Type check for the server, the school app and the shared package: clean. ESLint on all new
  and changed files: clean.
- New integration tests in `apps/server/tests/integration/sba.test.ts`, not run on my side:
  - **starting a sheet:** six tasks out of 100; starting it twice is refused; a teacher who
    doesn't teach the subject can't start one;
  - **marks and maxima:** a mark above the maximum is refused; a maximum can't drop below a
    mark already given; only the sheet's own teacher enters marks;
  - **the full flow:** incomplete submit refused → submit → sent back (comment required) →
    resubmit → HOD approves → head confirms → only the head reopens (reason required), with
    the history in order;
  - **two submits at the same moment:** only one is recorded;
  - **the printout:** shows examination numbers and the levels; the DEBS gets counts with no
    comments or marks;
  - **row-level security:** it's on for all five SBA tables.

## Your checklist

### 1. Install
1. Unzip `emis-phase-9b.zip` over the project folder.
2. From the `emis` folder, one line at a time:
   ```powershell
   npm run db:migrate:deploy
   ```
   ```powershell
   npm test
   ```
   - [ ] The deploy applies `20261104090000_sba_score_sheets`.
   - [ ] All tests pass, including `sba.test.ts`.
3. Optional: wipe and re-seed Cranes for the demo SBA sheet (`docs/phases/demo-school-seed.md`).
4. Delete `apps\school\.next`, then run `npm run dev`.

### 2. The head sets the centre code (head@cranes.example)
1. **School profile** → **ECZ examination centre code**: type e.g. `1234`, then **Save**.
   - [ ] "ECZ centre code saved".

### 3. The teacher's sheet (teacher@cranes.example)
1. **SBA score sheets.**
   - [ ] My sheets lists Esther's Form 1/2 subjects and classes (not her Grade 10–12 ones).
2. **Open** the Maths sheet (seeded), or **Start** one.
   - [ ] Six tasks in three term boxes.
3. Change Task 5's name and set it out of 25. Type marks for a few learners, including `A` for
   one and a mark above 25 for another.
   - [ ] The too-high mark turns red, and Save stays greyed out until you fix it.
   - [ ] Totals update as you type.
4. Fix it and **Save**. Try **Submit to HOD** before every mark is in.
   - [ ] "… learner(s) don't have a mark (or "absent") for every task yet".
5. Fill every mark (A is fine), add a few examination numbers and comments, then **Submit to HOD**.
   - [ ] Status "Waiting for the HOD"; the inputs are gone.
6. **Score sheet.**
   - [ ] A landscape page with the header fields filled in, including your centre code.
   - [ ] The learners' marks with totals, and your name and TS No at the bottom.
   - [ ] "Not yet confirmed … working copy" shows on screen but doesn't print.

### 4. The HOD (hod.maths@cranes.example)
1. **SBA score sheets** → "To check" → **Check**.
2. **Send back** with "Check task 3".
   - [ ] Esther sees an amber box with the comment, and the sheet can be edited again.
3. As Esther, **Submit** again. As the HOD, **Approve**.
   - [ ] Status "Waiting for the head".

### 5. The head (head@cranes.example)
1. **SBA score sheets** → "To check or confirm" → **Confirm**.
   - [ ] Status "Confirmed"; the history lists every step.
2. "All sheets in the school" and **Not started yet**.
   - [ ] They list the other teachers' Form 1/2 subjects.
3. **Reopen** with a reason.
   - [ ] It goes back to Esther as "Sent back".

### 6. The DEBS (debs.lusaka@ministry.example)
1. **SBA progress.**
   - [ ] Cranes with its expected number of sheets and the counts per stage, matching what
     the head sees.
   - [ ] No learner names or marks anywhere.
   - [ ] **Spreadsheet** downloads the table.

### 7. Access checks
- [ ] Another teacher (not Esther) can't open Esther's sheet: `/teacher/sba/<id>` says it isn't
  found.
- [ ] HOD Languages doesn't see the Maths sheet under "To check".

## Commit
```powershell
git add -A
```
```powershell
git commit -m "Phase 9b: SBA score sheets (teacher's own sheets, six tasks, HOD and head sign-off, ECZ-layout printout, office progress)"
```
```powershell
git push
```

Send me anything that doesn't match, with a screenshot or the error text.
