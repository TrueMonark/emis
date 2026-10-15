# Phase 3b: year levels, curriculum and learner numbers — what changed and how to test it

Built 16 October 2026. **One database migration**, `20261016090000_phase3b_year_levels`. It
changes existing data (your grades and learners), so **back up the database first** (step 1).
Don't run the seed. Your passwords stay as they are.

## What changed, in plain words
- **Year levels belong to each school.** Until now the twelve grades were shared by every school
  in the database. Now each school has its own list, and each level has:
  - a name, e.g. "Grade 9", "Form 1", "Reception", "Level 2", "16+";
  - a **stage**: ECE, lower primary, upper primary, junior secondary (the old Grades 8–9),
    O-level, A-level, LSEND or YALE;
  - a **curriculum** (2013 or 2023);
  - its **national exam**: old PSLE, new PSLE, JSSL, old School Certificate, new O-level
    School Certificate, or A-level;
  - where learners **normally go next**. That isn't simply the next number: Grade 12 → Form 5,
    Grade 7 → Form 1.

  So one school can run Grade 9 and Form 1 side by side. Renaming a level at one school changes
  nothing at another.
- **What the migration does to your data:**
  - Each school gets its own copy of the old grades, with the same names, order and "next grade".
  - Classes and subject links move to their school's copy.
  - Stage, curriculum and exam are filled in from the names: "Form n" counts as the 2023
    curriculum; "Grade n" follows the old structure (PSLE at 7, JSSL at 9, School Certificate at 12).
- **Grading follows the stage, not the grade number:**
  - primary stages use the primary scale;
  - junior secondary (old Grades 8–9) uses the junior scale and the Junior report card;
  - everything else uses the 9-point senior scale.
  - A Form-named class inside Grade 8/9 (e.g. "F1-A") still counts as senior, as before.
  - Only the **old Grade 12 School Certificate** merges Physics and Chemistry into "Science". The
    new Form 4 keeps them separate.
  - ECZ hasn't published grading for the new exams yet. Those levels use the matching old scale
    and show "provisional grading".
- **Settings → Academic calendar** has two new tabs: **Year Levels** and **Pathways**.
  - Year Levels:
    - add levels from a template: Primary Grades 1–6, Secondary Forms 1–6, Changeover 2026, or
      the old Grades 1–12;
    - add, edit, reorder, or remove levels (only when they have no classes).
  - Head and deputy can change things; others can only look.
- **National subject catalogue.** The subject list of the 2023 Curriculum Framework is in the
  database: groups, the stages each subject is taught at, and default periods per week.
  - **Subjects → From national list** adds the ones your school offers.
  - Each added subject is linked to the national entry. If you already have a subject with the
    same code, it's linked instead of duplicated.
  - Subjects the framework doesn't list stay as your school's own local subjects.
  - The migration already linked your existing subjects whose name matches, e.g. "Mathematics",
    "Biology", "Computer Studies" → ICT.
- **Pathways.** The 8 O-level and 5 A-level pathways, with their subject rules. A few examples:
  - English, Mathematics and Civic Education are compulsory for every O-level learner;
  - ICT is compulsory unless the learner takes Computer Science;
  - Natural Sciences adds Biology, Chemistry and Physics;
  - 6–7 subjects in total, 8 for Home Economics and Hospitality.

  How a school uses them:
  - tick the pathways your school offers;
  - tie an O-level or A-level class to one in the class's side panel;
  - the panel then shows whether the class's subjects fit. It warns but never blocks, because the
    framework has gaps (for example, it gives no A-level combinations).
- **Learner numbers.** Every learner now has a learner number like `ZM26-4K7Q2PB-H`:
  - "ZM";
  - the year they were first registered in the system;
  - 7 random characters;
  - a check character that catches any single typo or swapped pair.

  How it works:
  - It never contains 0/O, 1/I or L, which are easily misread.
  - The database gives every new learner one automatically, and it can't be reused.
  - Existing learners got theirs from this migration, numbered by the year their record was
    created.
  - It shows on the learner's side panel and profile, next to the school's own admission number.
  - You can search for it on the Students page, with or without the dashes.
- **Period length per stage.** Timetable → Generate has a new optional box, "Lower primary
  period length". In the 2023 curriculum, Grades 1–3 have 30-minute periods.
  - The bell times of lower-primary classes follow that length; the number of periods stays the
    same.
  - Leave it empty if every class uses the same length.
- **Report cards and promotions** now record year-level names, which works for Forms too:
  - "Next year level" on a report card is chosen from your school's levels;
  - a promotion records the "from" and "to" year levels by name.

## Verified on my side
Type checks pass for the server, the school app and the shared package. As agreed, I didn't run
the tests, a build or the migration here; the steps below are for you to run.

New tests:
- `year-levels.test.ts`:
  - the changeover template;
  - add, rename, reorder and remove, with the head/teacher rights;
  - two schools keeping their own lists;
  - the grading and Science rules by stage.
- `learner-numbers.test.ts`:
  - the check character catches every single typo and neighbour swap;
  - loose typing is accepted;
  - the database's numbers are valid, unique and can't be reused;
  - search finds a learner by learner number.
- `national-curriculum.test.ts`:
  - the national lists are complete and read-only;
  - adding national subjects, and linking an existing one;
  - offered pathways, a class's pathway and the subject check;
  - the pathway rules.

The promotions test now also checks the recorded year-level names.

## Your checklist

### 1. Back up, then migrate
1. **Back up the database** (PowerShell). The database name and user are in `apps\server\.env`, after the last `/` and after `postgresql://`; `school_db` and `postgres` below are examples:
   ```powershell
   pg_dump -U postgres -d school_db -F c -f emis-before-3b.dump
   ```
   If something goes wrong, `pg_restore -U postgres -d school_db --clean emis-before-3b.dump`
   puts it back.
2. Unzip `emis-phase-3b.zip` over the project folder and let it replace files.
3. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   ```
   It should end with "All migrations have been successfully applied".

   If it stops with "some classes or subject links still use a shared grade", nothing was
   changed. Send me the message.
4. Run the tests:
   ```powershell
   npm test
   ```
   [ ] All pass, including the three new files.
5. Start the app: `npm run dev`.

### 2. Year levels (as head@kaliweheights.example)
- [ ] Settings → Academic calendar → **Year Levels**.
  - [ ] The demo school's levels are there in order: Grade 1–7, Form 1, Form 2, Grade 10–12.
  - [ ] Each one shows its stage, curriculum and class count.
  - [ ] Grade 7 shows "PSLE (old)" and Grade 12 shows "School Cert. (old)".
- [ ] **Add from template → Changeover 2026 (secondary)**.
  - [ ] It adds the missing Forms 3–6 and keeps your existing levels.
  - [ ] Form 4 shows "School Cert. O-level · provisional grading".
  - [ ] Grade 12 now says "next: Form 5". It had no next level, so the template linked it.
    Form 2 keeps the demo's own link ("next: Grade 10"); existing links are never overwritten.
- [ ] Edit **Form 2** and set "Learners normally move on to" = Form 3. The row says "next: Form 3".
- [ ] Move a level up and down with the arrows. The order sticks after a reload.
- [ ] Try to remove a level that has classes. The bin is disabled. Remove an empty one (e.g. Form 6).
- [ ] Sign in as `teacher@kaliweheights.example` and open the same page. You can see the list,
  but there are no edit buttons.

### 3. Pathways and the national subject list (as head)
- [ ] Academic calendar → **Pathways**. Tick "Natural Sciences (STEM)" and "Social Sciences",
  then **Save pathways**. Each pathway lists its subject rules in plain words.
- [ ] Subjects → **From national list**.
  - [ ] Subjects you already have show "Offered as …". Your existing Mathematics, Biology, etc.
    were linked by the migration.
  - [ ] Tick e.g. "Agricultural Science" and **Add**. It appears in your subjects with code AGRIC.
- [ ] Classes → open a **Form 1** class. In Class Information, under **Pathway**, choose
  "Natural Sciences (STEM)".
  - [ ] A green "fits" note or a yellow list appears, e.g. "Missing compulsory: Physics".
  - [ ] Subjects that aren't on the national list are named as "not counted".
- [ ] Open a **Grade 10** class. The Pathway box is there too (Grade 10–12 count as O-level stage).
- [ ] Open a **primary** class. There's no Pathway box.

### 4. Learner numbers
- [ ] Students → open any learner. The side panel shows **Admission Number** and
  **Learner Number** (`ZM..-.......-.`).
- [ ] Copy a learner number. Search for it on the Students page, then search again without the
  dashes. The learner is found both times.
- [ ] Add a new learner. They get a learner number straight away.

### 5. Grading, report cards, promotions
- [ ] Reports / report cards for a **Form 1** class: the Senior report card, 9-point grades, as
  before.
- [ ] Report cards for a **Grade 12** class: Physics and Chemistry still show as one "Science"
  result where both have marks, as before.
- [ ] Edit a report card. "Next year level" lists your school's levels by name (Form 1, Grade 11 …).
- [ ] Promotions page: the next level for Form 2 is Form 3, as set in step 2.

### 6. Period length per stage (only if you have primary classes)
- [ ] Timetable → Generate. Set "Lower primary period length" to 30, save and regenerate.
- [ ] A Grade 1–3 class's timetable shows 30-minute bell times; other classes keep theirs.

### 7. Commit
In GitHub Desktop: "Phase 3b: year levels per school, national curriculum, learner numbers", then
push.

Tell me what passes, and what fails with what you see.

## Not yet (planned)
- **New exam grading:** the new PSLE, O-level and A-level grading scales are still needed from
  ECZ. Until then those levels use the old scales (marked provisional).
- **Learner subject choices:** pathways are checked per class. Individual learners choosing
  subjects within a class comes later.
- **Transfers between schools by learner number** come with transfers in Phase 4. For now, a
  learner moving school is registered again at the new school.
- **Primary SBA** (10% from each of Grades 4–6, sent to ECZ) and TEVETA entries build on this
  later.
- **First-login setup for a new school** (Phase 4) will ask the head to pick a year-level
  template, so a new school isn't left without levels.
