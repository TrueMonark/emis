# Phase 7: school profiles and returns — what changed and how to test it

Built 31 October 2026. **One database migration**: `20261031090000_phase7_profiles_and_returns`.
It goes on top of Phase 6 (the phone app needs no changes).

## What changed, in plain words

### School profiles for the DEBS, PEO and HQ
- **A new office page, School profiles**, shows the Ministry's School Profile figures, worked out
  live from each school's own records:
  - learners on roll by year level and sex, and the share of girls;
  - learners admitted and leaving during the period, and learners repeating the year;
  - orphans, other vulnerable children and special educational needs;
  - teachers by sex and qualification, learners per teacher, average class size;
  - **attendance**: present or late, out of all register marks in the period;
  - **registers taken**: class registers taken on school days, out of classes × school days.
    Weekends, public holidays and the school's closures don't count;
  - facilities: learners per classroom and per desk, boys and girls per toilet, water,
    electricity, internet.
- **Who sees what:**
  - **HQ** sees one row per province. Click a province to see its districts, then click a
    district to see its schools.
  - **A PEO** sees one row per district in its province.
  - **A DEBS** sees one row per school in its district.
  - Click a school for its own page: its figures beside the district's, the head and deputy with
    their phone numbers, and its facilities.
- **Counts only.** The offices never see learners' names or records. The database itself only
  hands out counts across schools: two locked-down functions, and nothing else reads across
  schools. A DEBS can't open another district's schools.
- **The period** (last 30 days, last 90 days, this year, or chosen dates) applies to attendance,
  registers, admissions and leavers. Learners on roll and teachers are as they are today.
- **Spreadsheet** downloads the table (CSV, opens in Excel).
- Office **Schools** list: a school's name now opens its profile.

### The school's own profile and facilities
- **Head teacher / deputy → School profile** (new, under "Education office" in the sidebar):
  - the same figures the DEBS sees, beside the district's;
  - **Facilities**: classrooms, desks, toilets (boys, girls, staff), main water source,
    electricity, internet and notes. Keep them up to date here; every new return copies them in.
- Teachers, clerks and finance staff don't see these pages.

### Returns: the office asks, the school submits, the DEBS approves
- **An office opens a return** (Office → **Returns** → **Open a return**). Only the head of the
  office can do this: HQ, a PEO or a DEBS.
  - Give it a name (e.g. "2026 Annual School Census"), a period and a due date. Instructions
    for the schools are optional.
  - Every active school in that office's area gets it: all schools for HQ, the province's schools
    for a PEO, the district's schools for a DEBS.
- **The head or deputy answers it** (School → **Returns**):
  - **Start the return.** The counts are worked out from the school's records for the period,
    and the facilities are copied from the School profile.
  - **Check it.** Correct the facilities if needed (this changes the return's copy only) and add
    remarks for the DEBS. **Refresh figures** works the counts out again, e.g. after more
    registers are taken.
  - **Submit to the DEBS.** It can't be submitted until the facilities are filled in. After
    submitting, the school can't change it unless the DEBS sends it back.
- **The DEBS of the school's district decides.** The DEBS or a DEBS officer (checking returns is
  usually the planning officer's work):
  - **Approve** (with an optional note), or
  - **Send back** with what needs correcting. The head sees the comment, corrects the return and
    submits again. The page shows how many times it has been submitted.
  - The DEBS (head) can **reopen** an approved return, with a reason.
- **The PEO and HQ see the progress** of every return across their districts or provinces, and
  the **approved figures added up**: only approved returns count. Downloads are "Progress"
  (who has submitted) and "Approved figures".
- **Every step is kept:** started, saved, refreshed, submitted, sent back, approved, reopened,
  with who did it, when and the comment. Nothing can be edited or deleted. The figures exactly
  as submitted are stored with each submission.
- **Closing a return:** the office that opened it can close it, so schools can no longer start,
  change or submit it, and reopen it later. Returns that were already submitted can still be
  approved.
- **Print** on a return gives a clean printout of the figures (no buttons or history).

### Not in this phase
- **Announcements** (circulars from the offices to schools) come next.
- **ECZ examination results** on the School Profile need the ECZ results to be imported first.
- **Official form layouts** (a replica of the Annual School Census form) wait for the blank form.
  The return carries the same categories, built from the records.
- **"Left during the period"** uses the date the learner's record last changed, because the
  system doesn't keep a separate withdrawal date. A learner edited after withdrawing could move
  to a later period.

### Demo school (Cranes)
- After a fresh wipe and seed, Cranes has its facilities filled in and **two returns waiting**:
  - "2026 Annual School Census" from HQ;
  - "Term 3 2026 return" from the Lusaka DEBS.

  Neither is started.
- **Without re-seeding**, create them yourself in steps 4–5 below. That is the better test
  anyway.
- Cranes is the only school in its district, so "the district" figures are the same as
  Cranes's. To see a real comparison, register a second school as the DEBS and add a few
  learners.

## Verified on my side
- Type check for the server, the school app and the shared package: clean.
- ESLint on every new and changed file: clean.
- New integration tests in `apps/server/tests/integration/returns.test.ts`, written but not run
  on my side, as agreed:
  - a DEBS sees only its own schools; a PEO sees its districts; another district's DEBS gets
    "not found";
  - facilities: the head saves them, teachers are refused, negative numbers are refused;
  - the full return flow, draft → sent back → submitted again → approved, with the history in
    order and the PEO's approved totals;
  - only the school's own DEBS decides (the PEO gets 403, another DEBS 404); only the DEBS head
    reopens;
  - **two submits at the same moment**: one goes through, the other is refused, with only one
    "submitted" line;
  - a closed return can't be started; only the office that opened it closes it;
  - an HQ return reaches every school, while a district's return doesn't reach other districts.

## Your checklist

### 1. Install
1. Unzip `emis-phase-7.zip` over the project folder.
2. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   npm run db:generate
   npm test
   ```
   - [ ] The migration ends with "All migrations have been successfully applied".
   - [ ] All tests pass, including `returns.test.ts`.
3. Optional: wipe and re-seed Cranes to get its facilities and the two waiting returns
   (`docs/phases/demo-school-seed.md`).
4. Delete `apps\school\.next` (as before), then run `npm run dev`.

### 2. The school's profile (as head@cranes.example)
1. Open **School profile** (sidebar, under "Education office"; on a phone, in the menu).
   - [ ] Learners by year level add up to the "On roll" line, give or take the note about learners not in a class.
   - [ ] Teachers shows the staff count, split by men and women and by qualification.
   - [ ] "Registers taken" and "Attendance" show percentages for the last 30 days.
2. Change the period to **This year so far**.
   - [ ] Admissions and attendance change; learners on roll stays the same.
3. Fill in or change the **Facilities** and press **Save facilities**.
   - [ ] "Facilities saved", and "Learners per classroom" in the indicators changes to match.
4. Sign in as teacher@cranes.example and go to `/admin/school-profile` in the address bar.
   - [ ] Refused (no figures shown).

### 3. The office dashboards
1. Sign in as **debs.lusaka@ministry.example** and open **School profiles**.
   - [ ] One row: Cranes, with the same learners, teachers and attendance as the head saw.
   - [ ] Clicking it opens Cranes's page with "Compared with the district", the head and deputy
     with phone numbers, and the facilities you saved.
   - [ ] **Spreadsheet** downloads a CSV that opens in Excel.
2. Sign in as **peo.lusaka@ministry.example**, then **School profiles**.
   - [ ] One row per Lusaka district; the demo district shows Cranes's figures.
   - [ ] Click it: the schools of that district, with a "School profiles › …" trail above.
3. Sign in as **hq@ministry.example**, then **School profiles**.
   - [ ] One row per province. Lusaka → districts → Cranes works.

### 4. A DEBS return, sent back and approved
1. As **debs.lusaka@ministry.example**: **Returns → Open a return**. Use the name "Test return",
   a period from the start of Term 3 to the end of this month, and a due date next week.
   - [ ] It appears with "1 not started".
2. As **head@cranes.example**: **Returns**.
   - [ ] "Test return" is there, marked "Not started", with an amber border.
3. Open it → **Start the return**.
   - [ ] The counts appear, and the facilities are copied from the School profile.
4. Add a remark, press **Save draft**, then **Submit to the DEBS** and confirm.
   - [ ] "Waiting for DEBS"; the facilities can no longer be changed.
5. As **officer.lusaka@ministry.example** (the DEBS officer): **Returns → Test return**.
   - [ ] Cranes shows "Waiting for DEBS". Click it.
   - [ ] **Send back** without a comment is greyed out. Type "Check the desks" and send.
6. As the head again: open the return.
   - [ ] An amber box: "Sent back for correction by …" with "Check the desks".
   - [ ] The facilities can be edited again. Change desks, then **Refresh figures**, then
     **Submit**.
7. As **debs.lusaka@ministry.example**: open Cranes's return.
   - [ ] **History** lists: started, saved, submitted, sent back, saved, refreshed, submitted.
   - [ ] **Approve** → "Approved". **Reopen** is offered (only to the DEBS, not the officer).
8. **Print** on the return.
   - [ ] A clean printout without buttons or history.

### 5. A national return (HQ → PEO)
1. As **hq@ministry.example**: **Returns → Open a return**, e.g. "Census test".
2. As the head of Cranes: it appears in **Returns**. Start it, check the facilities, submit.
3. As the DEBS: approve it.
4. As **peo.lusaka@ministry.example**: **Returns → Census test**.
   - [ ] Lusaka's districts with their progress. The demo district shows "1 approved".
   - [ ] "Approved figures" shows Cranes's counts and facilities, and **Approved figures**
     downloads them.
   - [ ] The PEO has no Approve or Send back buttons on a school's return.
5. As HQ: the same return, by province.
   - [ ] **Close** works for HQ. As the PEO, there's no Close button on HQ's return.
6. While it's closed, as the head of a school that hasn't started it, open it.
   - [ ] "This return is closed and wasn't started."

### 6. Access checks
- [ ] As teacher@cranes.example, `/admin/returns` shows no returns (refused).
- [ ] As officer.lusaka@ministry.example, **Returns** has no "Open a return" button.
- [ ] **Audit log** (as the DEBS) shows "Opened the return…", "Sent back…" and "Approved…".

## Commit
GitHub Desktop: "Phase 7: school profiles for the offices, school facilities, returns (draft → submitted → approved)", then push.

Send me anything that doesn't match, with a screenshot or the error text.
