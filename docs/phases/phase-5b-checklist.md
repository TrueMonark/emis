# Phase 5b: public holidays, school closures and marks history — what changed and how to test it

Built 21 October 2026. **One database migration**: `20261021090000_phase5b_holidays_and_marks_history`.
Install this **before** the school fees module. The fees zip has been rebuilt to go on top of it.

## What changed, in plain words

### No registers on public holidays or closure days
- **The rule:** registers can't be taken or corrected on a **public holiday** or a day the
  **school is closed**, the same as weekends.
  - This covers the daily register and period registers, from the web and from phones.
  - The message names the day, e.g. "There's no register on Independence Day (a public holiday),
    Monday …".
- **The public holidays are built in.** The system works them out for any year:
  - fixed days: New Year, Women's Day, Youth Day, Kenneth Kaunda Day, Labour Day, Africa Freedom
    Day, Independence Day, Christmas;
  - moving days: Good Friday, Holy Saturday, Easter Monday, Heroes' and Unity Days (first Monday
    and Tuesday of July), Farmers' Day (first Monday of August);
  - a holiday that falls on a Sunday is also kept on the Monday after (e.g. Women's Day 2026 on
    Monday 9 March).
- **The National Day of Prayer:** 18 October until 2025. From 2026 it's **29 December**, the
  "National Day of Prayer and Christian Heritage".
  - The government and the church mother bodies agreed this on 9 October 2026, so 18 October 2026
    was no longer a holiday.
  - The Cranes demo had treated Monday 19 October 2026 as a holiday. It's now an ordinary school day.
- **HQ keeps the list up to date** (Office → **Public holidays**):
  - **declare an extra day**, e.g. a day the President declares, or election day;
  - **cancel** a day that no longer applies, e.g. when the law changes. A Public Holidays
    (Amendment) Bill was before Parliament in 2026.
  - Every school follows the change straight away, and it's in the audit log.
  - PEO and DEBS staff can see the list, but only HQ changes it.
- **Schools add their own closures** (Head teacher → **School calendar**). Examples: a mid-term
  break, a staff development day, a closure after flooding.
  - Only the head or deputy adds or removes closures.
  - Registers already taken on those days stay as they are, and the message says how many.
- **Special classes on holidays:** "Weekend classes" now also covers public holidays and closure
  days. A teacher can ask for a revision class on Independence Day; the HOD approves it as
  before; its register is kept apart.
- **The period-register page** shows "No register today: Independence Day (public holiday)" on
  those days, with a link to special classes.
- **Attendance rates aren't affected.** They're worked out from the registers taken, and none are
  taken on those days.
- **Phones** get the holidays and closure days, from a month ago to four months ahead, with every
  sync. The phone app can then refuse registers on those days even when offline.

### Marks history
- **Every mark is kept with its history:** entered, changed or deleted, by whom, when, and from
  the **web** or a **phone**.
  - The database records it itself, so every way of entering marks is covered: one at a time,
    "Save all", "Fill zeros", phone sync.
  - Nobody can edit or delete the history.
- **Phones can't silently overwrite newer marks any more.** It works like attendance already does:
  - Suppose a mark was changed on the web *after* the teacher changed it on their phone offline.
  - The newer mark is kept, and the phone is told.
  - The history shows a "Phone change not applied" line with both marks.
- **Where to see it:**
  - **Teacher** → Assessments → Enter results → **Marks history** (next to Save All);
  - **HOD** → the assessment's drawer → **History**;
  - **Head teacher / deputy** → Assessments → ⋮ → **Marks history**.
  - Only people who can see the marks themselves can see the history: the subject teacher, the
    subject's HOD, and the head or deputy.

### Demo school (Cranes)
After re-seeding, Cranes has:
- no registers on any 2026 public holiday;
- a staff development day (Fri 25/09/2026) and a mid-term break (29–30/10/2026) on its calendar;
- three corrected marks on a Form 2 A Maths assessment, one of them from a phone. Every other
  mark shows "Entered · System" in the history.

## Verified on my side
Type checks pass for the server, the school app and the shared package. ESLint is clean on the
new code. As agreed, I didn't run the tests or the migration here.

New test files:
- **`calendar.test.ts`:**
  - the built-in list for 2026 (Easter, observed Mondays, Heroes/Unity/Farmers, prayer day
    moved) and Easter 2027;
  - a day HQ declares stops registers, and undoing it allows them;
  - the PEO can't change the list;
  - cancelling a built-in day;
  - closures: the head only, the message, registers already taken, removing one;
  - another school isn't affected;
  - special classes on a holiday;
  - phones get the calendar.
- **`marks-history.test.ts`:**
  - entries and changes on the web, with who made them;
  - re-saving the same mark adds nothing;
  - who may see the history;
  - deletions are kept;
  - phone changes are marked "phone";
  - an older phone change isn't applied, and the history and the phone both say so.

Changed: `register-covers.test.ts` and `sync-api.test.ts` now take their registers on the latest
**school** day, so they still pass when run the day after a public holiday.

## Your checklist

### 1. Install
1. Unzip `emis-phase-5b.zip` over the project folder.
2. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   npm run db:generate
   npm test
   ```
   - [ ] The migration ends with "All migrations have been successfully applied".
   - [ ] All tests pass, including `calendar.test.ts` and `marks-history.test.ts`.
3. Optional: wipe and re-seed Cranes to get the demo calendar and mark corrections
   (`docs/phases/demo-school-seed.md`).
4. Delete `apps\school\.next` (as before), then run `npm run dev`.

### 2. Public holidays (as hq@ministry.example)
1. Go to **Public holidays**.
   - [ ] 2026 lists: Women's Day on 08/03 **and** "(observed)" on 09/03; Good Friday 03/04;
     Holy Saturday 04/04; Easter Monday 06/04; Kenneth Kaunda Day 28/04; Heroes' Day 06/07;
     Unity Day 07/07; Farmers' Day 03/08; Independence Day 24/10; Christmas 25/12; National Day
     of Prayer and Christian Heritage 29/12.
   - [ ] There's nothing on 18/10 or 19/10.
2. Use the arrows to go to 2027.
   - [ ] Good Friday is 26/03/2027.
3. Press **Change → Declare an extra holiday**: pick a weekday next week, name it "Test holiday",
   and save.
   - [ ] It shows with "declared".
4. Sign in as debs.lusaka@ministry.example and go to **Public holidays**.
   - [ ] "Test holiday" is there.
   - [ ] There's no Change button.

### 3. The school calendar (as head@cranes.example)
1. Go to **School calendar** (sidebar, under Academic Management).
   - [ ] The public holidays are listed, including "Test holiday".
   - [ ] After re-seeding: "Staff development day" and "Mid-term break" are under School closed.
2. Press **Close the school**: "Test closure", yesterday (or the last school day), and save.
   - [ ] "Registers already taken on 1 of those day(s) stay as they are" (if the register was
     taken that day).
3. Sign in as teacher@cranes.example.
   - [ ] There's no School calendar in the teacher's menu.

### 4. Registers are refused (as teacher@cranes.example, Esther Banda)
1. **Attendance** (periods): pick the "Test holiday" date.
   - [ ] "No register today: Test holiday (public holiday)", with a link to special classes.
2. Pick the "Test closure" day.
   - [ ] "No register today: Test closure (school closed)".
3. **My classes → Form 2 A → take the register**, on a day that's a holiday or closure.
   - [ ] Refused with the reason.
4. **Weekend classes → Ask**: choose the "Test holiday" date.
   - [ ] It's accepted ("Test holiday (public holiday)" under the date).
   - [ ] An ordinary weekday says "Choose a Saturday, Sunday, public holiday or school closure
     day".
5. As HQ, undo "Test holiday". As the head, remove "Test closure".
   - [ ] Registers on those days work again.

### 5. Marks history
1. As teacher@cranes.example, go to **Assessments**, open a published assessment and **Enter
   results**.
2. Change one learner's mark and let it save.
3. Press **Marks history**.
   - [ ] The newest line says "Changed old → new", with your name, the time, and a computer icon.
   - [ ] After re-seeding, the Form 2 A Maths assessment with corrections shows them, one with a
     phone icon.
4. Sign in as hod.maths@cranes.example. In the assessment drawer, press **History**.
   - [ ] The same lines.
5. Sign in as head@cranes.example. Go to **Assessments → ⋮ → Marks history**.
   - [ ] The same lines.
6. As hod.languages@cranes.example, try a Maths assessment's history (if you can reach it).
   - [ ] Refused.

Send me anything that doesn't match, with a screenshot or the error text.
