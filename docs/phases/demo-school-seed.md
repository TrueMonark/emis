# Demo school: Cranes Secondary School (fictional), with HQ, PEO and DEBS

`apps/server/prisma/seed-demo-term.ts` (`npm run db:seed:demo`) adds a fully populated, fictional
school, so pages can be checked with a real school's worth of data. It's also good for screen
recordings. (It replaced the earlier Kaliwe Heights demo on 18 October 2026.)

## What it creates
- **Education offices and their accounts:**
  - a "Lusaka District Education Board" under the Lusaka Provincial Education Office;
  - accounts for HQ (head and officer), the Lusaka PEO, and the Lusaka DEBS (head and officer);
  - a few audit log lines, as if the chain had been built from the office pages.
- **The school:**
  - Cranes Secondary School, a **private** school in that district, with EMIS number
    DEMO-CRN-0001 (confirmed);
  - already set up, so there's no setup wizard.
- **Year and staff:**
  - the 2026 year, with Terms 1 and 2 finished and Term 3 running up to today;
  - a head teacher, deputy head, school administrator (clerk) and **30 teachers** in 4
    departments, each department with an HOD.
- **Classes and learners:**
  - 9 classes: Form 1 A/B/C, Form 2 A/B, Grade 10 A/B, Grade 11 A, Grade 12 A;
  - about **300 learners**, with their guardians and learner numbers.
- **Teaching data:**
  - curriculum, subject teachers and class teachers;
  - daily registers for every school day;
  - CAT, mid-term and end-of-term marks;
  - a generated timetable, and Term 3 lesson logs.
- **Report cards:** Term 1 for every class, and Term 2 for every class except Grade 12 A (left
  out on purpose for a live "Bulk Generate").
- **School fees** (since 19 October 2026):
  - a bursar (finance staff account);
  - term fees per year level for all three terms, with Term 3 in two parts;
  - the PTA levy, Grade 12 exam fees, a Form 2 trip (only those signed up) and sports day;
  - sibling discounts and a few bursaries;
  - about a year of payments with receipts: most families paid up, some part-paid, some behind.
- **Messages:** SMS history (simulated; nothing is sent) and staff notifications.
- **Sign-in by mobile:** every account has its own made-up mobile number, so it can also sign
  in with that number.

## Rules it keeps
- **No fixed password in the code.** Set `DEMO_SEED_PASSWORD="..."` in `apps\server\.env` to
  choose one. Otherwise it prints a random password at the end. Every demo account uses that
  one password.
- **Local databases only.** It refuses any database that isn't on your computer (unless
  `SEED_ALLOW_REMOTE=true`).
- **It refuses to run twice.** Wipe the database first (below).
- **Made-up details only.** Emails use the reserved `.example` domains and phone numbers are
  made up. **Don't put real SMS gateway credentials on this database**, or "send SMS" buttons
  could text whoever owns those numbers.

## Wipe the database and seed Cranes (Windows, PowerShell)

> ⚠️ This deletes **everything** in the database that `apps\server\.env` points at:
> - every school, including any real or pilot school;
> - every account, including the HQ/PEO/DEBS accounts you made yourself;
> - all marks and registers.
>
> Check `DATABASE_URL` in `apps\server\.env` first. It must be your local development database,
> **not** the `_test` one in `.env.test`.

1. Stop `npm run dev` if it's running (Ctrl+C).
2. Optional: keep a backup of what's there now:
   ```powershell
   pg_dump --format=custom --file "$HOME\emis-backup-before-cranes.dump" "<your DATABASE_URL>"
   ```
   Paste the `DATABASE_URL` from `.env` **without** any `?schema=public` on the end (pg_dump
   doesn't accept it).
3. Wipe and rebuild the tables:
   ```powershell
   cd C:\Users\truem\Documents\projects\emis\apps\server
   npx prisma migrate reset --force --skip-seed
   npm run db:generate
   ```
   - `migrate reset` empties the database and runs every migration again. That brings back the
     national lists: HQ and the provinces, the subject catalogue and pathways.
   - `--skip-seed` stops it running the old basic seed (`prisma/seed.ts`).
4. Seed Cranes:
   ```powershell
   npm run db:seed:demo
   ```
   It takes a few minutes and prints each step. At the end it prints the password and the
   logins.
5. Start the app again:
   ```powershell
   cd ..\..
   npm run dev
   ```

Don't use the old `npm run db:reset` script for this. It predates the multi-school tables and
leaves schools, memberships and offices behind; `prisma migrate reset` is the complete wipe.

## Logins (password printed at the end)

| Who | Email |
|---|---|
| HQ (head) | hq@ministry.example |
| HQ (officer) | hq.officer@ministry.example |
| PEO Lusaka | peo.lusaka@ministry.example |
| DEBS Lusaka | debs.lusaka@ministry.example |
| DEBS officer | officer.lusaka@ministry.example |
| Head teacher | head@cranes.example |
| Deputy head | deputy@cranes.example |
| Clerk (administrator) | admin@cranes.example |
| HOD Maths & Sciences | hod.maths@cranes.example |
| HOD Languages | hod.languages@cranes.example |
| Teacher | teacher@cranes.example (Esther Banda, Maths, class teacher of Form 2 A) |
| Finance (bursar) | bursar@cranes.example (Memory Tembo; school fees pages only) |

The other teachers are firstname.lastname@cranes.example (e.g. joyce.lungu@cranes.example). The
head's and Esther Banda's mobile numbers are printed at the end too.

## Checklist
- [ ] The script finishes with "🎉 Demo school ready!". If it stops with an error, send me the
      last lines.
- [ ] Sign in as head@cranes.example.
  - [ ] The sidebar says "Cranes Secondary School".
  - [ ] Teachers shows 33 staff.
  - [ ] Students shows about 300.
- [ ] Sign in with the head's printed mobile number instead of the email. It works.
- [ ] Sign in as debs.lusaka@ministry.example.
  - [ ] **Schools** shows Cranes in the Lusaka district.
  - [ ] **Audit log** has the registration lines.
- [ ] Sign in as peo.lusaka@ministry.example and hq@ministry.example.
  - [ ] Both see Cranes under Lusaka.
- [ ] Sign in as teacher@cranes.example.
  - [ ] "My classes", the register and marks are filled in.
