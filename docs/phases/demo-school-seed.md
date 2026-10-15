# Demo school: Kaliwe Heights Secondary School (fictional)

`apps/server/prisma/seed-demo-term.ts` adds a fully populated, fictional school, so pages can be
checked with a real school's worth of data. It's also good for screen recordings.

## What it creates
- **Year and staff:** the 2026 year with Terms 1 and 2 finished and Term 3 running up to
  today; a head teacher, deputy head, school administrator (clerk) and 18 teachers in 4
  departments, each department with an HOD.
- **Classes and learners:** 8 classes (Form 1 A/B, Form 2 A/B, Grade 10 A/B, Grade 11 A,
  Grade 12 A) with about 300 learners and their guardians.
- **Teaching data:** curriculum, subject teachers and class teachers; daily registers for
  every school day; CAT, mid-term and end-of-term marks; a generated timetable and Term 3
  lesson logs.
- **Report cards:** Term 1 for every class, and Term 2 for every class except Grade 12 A
  (left out on purpose for a live "Bulk Generate").
- **Messages:** SMS history (simulated; nothing is sent) and staff notifications.

## Changes for the multi-school system
- **It's its own school.** The demo goes into a new school, "Kaliwe Heights Secondary
  School". The database keeps it apart from your own school, so you can add it to your normal
  local database. A separate database still works too.
- **It refuses to run twice** (the demo school already exists), and refuses any database that
  isn't on your computer.
- **The school administrator (Chipo Nkhoma) is now a Clerk.** "Administrator" is no longer a
  school role. The head teacher (Joseph Mulenga) runs the app's generators (timetable, report
  cards).
- **No fixed password in the code.** Set `DEMO_SEED_PASSWORD="..."` in `apps\server\.env` to
  choose one; otherwise it prints a random password at the end. This password is only for the
  demo accounts. Your own accounts aren't touched.
- **Grade names:** the grade list is still shared by every school until Phase 3b. Grades that
  already exist keep their names; only missing grades are created, with Form 1 and Form 2 for
  Grades 8 and 9.

## Run it
```powershell
cd apps\server
npx tsx prisma/seed-demo-term.ts
cd ..\..
npm run dev
```
It takes a few minutes and prints each step. At the end it lists the logins:
- head@kaliweheights.example
- deputy@kaliweheights.example
- admin@kaliweheights.example (clerk)
- hod.maths@kaliweheights.example
- hod.languages@kaliweheights.example
- teacher@kaliweheights.example

## Checklist
- [ ] The script finishes with "🎉 Demo school ready!". If it stops with an error, send me the
      last lines.
- [ ] Log in as head@kaliweheights.example. The sidebar says "Kaliwe Heights Secondary School".
- [ ] Log in as your own head teacher. You see only your own school; none of the demo learners
      or teachers appear.
- [ ] As the demo head, go through the pages where you found problems with the old system, and
      note for each one: the page, what you did, and what went wrong (a screenshot helps).
