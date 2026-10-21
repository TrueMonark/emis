# School fees for private schools: what changed and how to test it

Built 19 October 2026. **One database migration**: `20261019090000_school_fees`.

## What changed, in plain words

### Which schools have it
- **Private schools always have school fees.** When the DEBS registers a school as Private, it
  gets the fees pages.
- **The DEBS (or the PEO or HQ) can switch it on for any other school.** In **Office → Schools →
  Edit**, there's a new "School fees" switch.
  - It's always on, and greyed out, for private schools.
  - Changing a school to Private turns it on.
- The schools list says "school fees on" under those schools.
- When the migration runs, every school that's already Private gets the fees pages.

### A new kind of account: finance staff
- The **head teacher or deputy** makes it. It's for a bursar or accounts clerk.
  - Go to **School fees → Finance staff → New finance account**: name, email, and a mobile
    number if they want one.
  - They get a **one-time password**, just like everyone else.
- **Finance staff have nothing to do with teaching.** They see **only the School fees pages**.
  - The server refuses everything else: students, marks, registers, timetables.
  - They can still change their password, see their notifications, and use "Forgot password?".
  - Their reset request goes to the head or deputy, like any staff member's.
- **The head teacher and deputy** get a **School fees** link in their sidebar (desktop and phone).
  - They can see and print everything.
  - They don't record payments or change fees; those pages say "View only".
- Teachers, HODs and clerks don't see it at all.

### Setting up fees (finance staff)
Everything is in kwacha. The system stores whole ngwee, so totals are exact.
- **Fees & events → New fee or event.** One fee: a name, a kind, the term, the amount, the due
  date, and who pays.
  - Kinds: tuition, boarding, transport, meals, exam, uniform, books, development/PTA, trip,
    event, other.
  - Term: a term, or none for a one-off or whole-year charge.
  - Who pays:
    - **Whole school**;
    - **year levels**, e.g. Grade 12 exam fees;
    - **classes**;
    - **chosen learners only**, for trips and events. Nobody is charged until you add them.
  - "Optional" on a whole-school, year-level or class fee: the same, but only the learners you
    add are charged.
  - **Payment plan:** split a fee into instalments, e.g. 60% by 21 Sept and 40% by 26 Oct.
    - The parts must add up to 100%.
    - Only the parts already due count as overdue.
- **Term fees by year level.** One screen to give each year level its own term amount. It makes
  one fee per level, e.g. "Term 3 tuition – Grade 10".
- **A fee's page** shows every learner charged, with what they've paid, what they owe, and their
  status. From there:
  - **Add learners**: tick learners class by class, e.g. who's going on the trip.
  - **Remove** a learner's charge, if nothing has been paid towards it.
  - **Edit**: change the amount, and everyone's charge follows (less their discounts). You can
    also change the name and due date.
  - **Archive** a fee, or **Delete** it while nobody has been charged.
  - **CSV**.
- **Update charges** (Fees & events): charges this year's fees to learners who joined after the
  fees were set up.

### Discounts and bursaries
- A **percentage** or a **fixed amount** off. It applies to all fees, or only some kinds (e.g.
  tuition only), for the year.
  - Name presets: sibling, staff child, bursary, scholarship, early payment.
- The learner's charges are recalculated straight away, and fees set up later include the
  discount.
- **End** a discount and the charges go back up.

### Payments and receipts
- **Record payment:** the learner, amount, date, and how it was paid.
  - Methods: cash, bank deposit, bank transfer, mobile money, cheque, other.
  - A **reference** is required for bank, mobile money and cheque payments.
  - You can add who paid and notes.
  - "Pay towards": the usual is **oldest balance first**. You can choose a fee instead, e.g. the
    trip.
  - There's a "pay the full balance" shortcut.
- Each payment gets the next **receipt number**: `RCT-2026-000123`, numbered per school and year.
- **Print receipt** shows the school, the learner, the class, the amount, the method and
  reference, and the **balance after this payment**, with signature and stamp lines.
- **Cancelling a wrong payment** ("void") needs a reason.
  - The payment stays in the records, crossed out, and stops counting.
  - Its receipt number is never reused.
  - The printed receipt says CANCELLED.
- **How the money is split:**
  1. a payment made towards a fee pays that fee first;
  2. everything else pays the oldest balances first (last term's arrears before this term's);
  3. anything left over is **credit**.

### Learners' accounts
- **Learners:** everyone on this year's class lists, with charged, paid, balance and overdue.
  You can filter by class, show only those owing, or search by name or learner number. CSV.
- **A learner's account:**
  - the guardian's name and phone;
  - every fee with its discount, what's paid, the balance and overdue;
  - every payment (print or cancel);
  - their discounts.
  - **Statement** prints all of it.

### Printouts and spreadsheets
All print views open in a new tab with a **Print** button (or Ctrl+P). They're plain, black on
white, and fit A4.
- **Receipt**.
- **Learner statement**.
- **Class list with payments on the side:**
  - one row per learner;
  - a Paid and an Owing column for each fee (a term's fees, or the whole year);
  - the learner's total owed;
  - totals at the bottom.
- **Who owes:** largest balance first, with the guardian's phone. For the whole school or a
  class, with "only overdue" and "owing at least K…" options.
- **Money collected** between two dates:
  - totals by method, by day and by who received it;
  - every receipt;
  - the cancelled receipts listed separately.
- Every report, and the Fees, Learners and Payments lists, have a **CSV** download that opens in
  Excel. The amounts are plain numbers, so you can add them up.

### Ready for a bank or mobile money link later
- Every payment records where it came from (`source`, "MANUAL" for now).
- A later connection to a bank or to MTN/Airtel money would record payments the same way:
  with its own source and the provider's transaction reference, the same receipt numbers, and
  the same balances.
- Nothing is connected yet, and no payment details are stored.

### Privacy
- The audit log records fee and payment actions without learners' names.
- Finance staff can't open learner records outside the fees pages.

### Demo school (Cranes)
Cranes is now a **private** school, with a bursar, **bursar@cranes.example** (Memory Tembo).
The seed gives it:
- term fees for each year level for all three terms (Term 3 in two parts);
- the PTA levy, Grade 12 exam fees, the Form 2 Livingstone trip (only those who signed up), and
  sports day;
- sibling discounts and a few bursaries;
- about a year of payments: most families paid up, some part-paid, some behind.

## Verified on my side
- Type checks pass for the server and the school app.
- ESLint is clean on all the new fees screens.
- As agreed, I didn't run the tests or the migration here.

New test file **`fees.test.ts`**. It covers:
- who gets in:
  - finance staff edit;
  - the head views only;
  - a teacher is refused;
  - finance staff can't reach other pages;
  - schools without fees are refused;
- whole-school and year-level charges, discounts (given, amount changed, ended), delete refused
  once charged, and term fees by year level;
- optional fees: only the learners added, nobody off the class lists, no removing a paid
  charge;
- splitting payments:
  - earmarked first, then oldest, then credit;
  - receipt numbers in order;
  - reference and date rules;
  - cancelling (the head can't, not twice, the number isn't reused);
- instalments: only the parts already due are overdue; the parts must add up to 100%;
- the class list, who-owes and money-collected reports;
- another school's finance staff see none of it;
- the head makes and ends finance staff accounts (one-time password, no teacher profile).

`tests/helpers/db.ts`: `createTestUser({ role: FINANCE })` makes no teacher profile, the same as
for clerks.

## Your checklist

### 1. Install
1. Unzip `emis-school-fees.zip` over the project folder.
2. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   npm run db:generate
   npm test
   ```
   - [ ] The migration ends with "All migrations have been successfully applied".
   - [ ] All tests pass, including `fees.test.ts`.
3. To get the demo fees, wipe and re-seed Cranes (`docs/phases/demo-school-seed.md`).
   - [ ] The seed prints a "✅ School fees: …" line, with the number of receipts and the amount
     collected.
4. `npm run dev`.

### 2. Switching it on (as debs.lusaka@ministry.example)
1. Go to **Schools**.
   - [ ] Cranes says "Private · school fees on".
2. Open **Edit** on Cranes.
   - [ ] The School fees switch is on and greyed out ("Always on for private schools").
3. If you have a public school, switch School fees on there and save.
   - [ ] The list shows "school fees on".
   - [ ] Switch it off again.
4. Register a new **Private** school.
   - [ ] It shows "school fees on" straight away.

### 3. The head teacher (head@cranes.example)
1. Look at the sidebar.
   - [ ] **Finance → School fees** is there.
   - [ ] On a phone, it's in the menu drawer.
2. Open it.
   - [ ] The overview shows charged, paid, still owed, overdue, collected today and this month,
     and "Owed by class".
   - [ ] Fees, Learners, Discounts: there's no "Record payment" or "New fee" button, and the
     pages say "View only".
3. Open a learner, then **Statement**.
   - [ ] It prints.
4. **Finance staff**.
   - [ ] Memory Tembo (bursar) is listed.
5. **New finance account** with your own test email.
   - [ ] A one-time password is shown once.
6. Sign in as that account in a private window.
   - [ ] You're asked to change the password.
   - [ ] Then you land on School fees.
7. Back as the head, **End account** on it.
   - [ ] It can't sign in any more.
8. **Back to school pages** takes you back to the head's dashboard.

### 4. Finance staff only see fees (bursar@cranes.example)
- [ ] After signing in you land on **School fees**, not a teacher or admin dashboard.
- [ ] Typing `/admin/students` or `/teacher` in the address bar doesn't show those pages.
- [ ] The sidebar has no Finance staff item (only the head and deputy have it).

### 5. Set up fees (as the bursar)
1. Go to **Fees & events → Term fees by year level**.
   - Term: Term 3. Name: "Term 3 lab fee". Kind: Other. Due: any date.
   - Amounts: Form 1 K50, Grade 12 K80. Leave the rest empty.
   - [ ] "2 fee(s) set up". The new fees list only Form 1 and Grade 12 learners.
2. Go to **New fee or event**.
   - Name: "Grade 11 career day". Kind: Event. Who pays: Classes → Grade 11 A, Optional. K75.
   - [ ] "Add the learners taking part".
3. Open it, then **Add learners**. Tick five learners.
   - [ ] "5 learner(s) charged". Only Grade 11 A learners were offered.
4. **Edit** the fee: change K75 to K100.
   - [ ] Each learner's charge is now K100.
5. Remove one learner (✕).
   - [ ] They're gone. A learner who has paid towards it has no ✕.
6. Make a fee with a **payment plan**: two parts, 50% and 40%.
   - [ ] "The instalments must add up to 100%". Change 40 to 50: it saves.
7. Press **Update charges**.
   - [ ] "Everyone is already charged". If you add a new learner to a class first, it charges
     them instead.

### 6. Payments and receipts (as the bursar)
1. **Learners** → pick someone owing → **Record payment**.
2. Choose Mobile money and leave the reference empty.
   - [ ] "Enter the reference …".
3. Fill in a reference (e.g. MP26123456) and press Record payment.
   - [ ] "Receipt RCT-2026-00…". The number is one more than the last receipt in Payments.
4. **Print receipt**.
   - [ ] It shows the school, learner, class, amount, method, reference, and the balance after
     this payment.
5. Back on the account page:
   - [ ] the oldest fee was paid first;
   - [ ] the balance went down by the amount.
6. Record a payment **towards** the trip for a learner on the Form 2 trip.
   - [ ] The trip line goes down, not the tuition.
7. Pay more than a learner owes.
   - [ ] Their balance shows "K… credit".
8. Go to **Payments**, then cancel (⃠) one payment with a reason.
   - [ ] It's crossed out with the reason.
   - [ ] It disappears from the total.
   - [ ] "Show cancelled" brings it back.
   - [ ] Its printed receipt says CANCELLED.
9. Record another payment.
   - [ ] The receipt number doesn't reuse the cancelled one.
10. Try a payment date in the future.
    - [ ] Refused.

### 7. Discounts (as the bursar)
1. Open a learner → **Discount** → "Sibling discount", 10%, Tuition.
   - [ ] "Discount given; N charge(s) updated".
   - [ ] Their tuition lines show "K… − K…".
2. End it, from the account or from **Discounts & bursaries**.
   - [ ] The charges go back up.
3. On Discounts & bursaries:
   - [ ] the seeded sibling discounts and bursaries are listed;
   - [ ] the ended one is greyed out.

### 8. Reports
1. **Class list with payments**: Form 2 A, Term 3.
   - [ ] One row per learner, with a Paid and Owing column per fee.
   - [ ] Learners not on the trip show "—" there.
   - [ ] Totals at the bottom.
   - [ ] **Print** fits A4 landscape.
   - [ ] **CSV** opens in Excel with numbers that add up.
2. **Who owes**: whole school, only overdue.
   - [ ] Largest first, with the guardian and phone.
   - [ ] Print and CSV work.
3. **Money collected**: the 1st of this month to today.
   - [ ] Totals by method, by day and by who received it; every receipt; cancelled ones listed
     separately.
   - [ ] The total matches the Payments page for the same dates.

### 9. Others are kept out
- [ ] As teacher@cranes.example, `/finance` sends you back to the teacher pages.
- [ ] As admin@cranes.example (clerk), there's no School fees link, and `/finance` sends you away.
- [ ] On a school with fees switched off, the head gets no link. `/finance` says "School fees
  aren't switched on for this school".

Send me anything that doesn't match, with a screenshot or the error text.
