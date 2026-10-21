# Phase 5: weekend classes, and the phone sync API — what changed and how to test it

Built 18 October 2026. **One database migration**: `20261018120000_phase5_weekend_classes_and_sync`.

## What changed, in plain words

### No attendance on weekends, except an approved weekend class
- **The weekend rule.** Nobody can take or correct a register for a Saturday or Sunday. This
  covers the daily register and period registers, on the web and from phones. The message says
  what to do instead.
- **A weekend lesson is a "weekend class":**
  1. **The teacher asks for it** under **Weekend classes** (teacher sidebar, under Attendance):
     - for a class and subject they teach;
     - on a Saturday or Sunday inside a term;
     - with times, topic, and optionally where and why.
  2. **The HOD of the subject's department** gets a notification, and approves or turns it down
     (with an optional note).
     - The head teacher or deputy can decide too. They're the fallback when there's no HOD, or
       when the teacher *is* the HOD.
     - A head's or deputy's own weekend class needs no approval.
  3. **On the day** (or after), **only the teacher who asked** takes its register. The head or
     deputy can correct it. Before the day, the register says when it opens.
- **Its register is separate** from the daily register, so weekend classes never change
  report-card attendance.
- **Cancelling:** a weekend class can be cancelled until its register has been taken.
- **Clashes:** two weekend classes for the same class can't overlap that day.
- **Where it appears:**
  - Teachers: **Weekend classes**. HODs also get a "To approve" tab there.
  - HOD pages: **Weekend classes**.
  - Head teacher / deputy: **Weekend classes**, with "To approve", "All" and their own.
  - The weekend message on the teacher's Attendance page links there.

### The phone sync API (for the Phase 6 app)
No new screens: this is what the teacher phone app will talk to. The full reference is
`docs/design/sync-api.md`.
- **Snapshot.** Everything a teacher's phone may hold, with only the fields it needs. That's:
  - their classes;
  - their learners' names (no birth dates, addresses, medical or vulnerability details, no
    guardians);
  - their timetable, assessments and marks;
  - this term's registers, lesson logs, covers and weekend classes.
- **Changes since last time.** Changed rows come with their new values; deleted ones come as
  "deleted". If the teacher's classes, covers or term change, the phone is told to download
  again.
- **Push.** The phone sends the changes it made offline as operations:
  - take a register;
  - take a weekend class register;
  - enter marks;
  - log a lesson.

  Each one goes through the same rules as the web. Every rejection comes back with the reason
  (for example "Attendance can't be taken on a Saturday or Sunday…").
- **Sent twice, applied once.** An operation sent twice (signal dropped) is applied once, and
  the second send gets the first answer.
- **Conflicts:**
  - **Attendance:** if someone corrected a mark on the web *after* the teacher made their change
    offline, the newer mark is kept and the phone is told.
  - **Marks:** refused once the assessment is completed or its entry window has closed.
- **Offline limit:** the phone gets the offline limit (14 days, setting `SYNC_OFFLINE_DAYS`).

### Smaller fixes
- **Ended assignments:** a teacher whose subject assignment ended (e.g. after a transfer) no
  longer gets that class on their phone.
- **Cranes demo seed:** it now includes weekend classes:
  - one held last Saturday, with its register;
  - one approved for next Saturday;
  - one waiting for the Maths HOD.

## Verified on my side
Type checks pass for the server, the school app and the shared package. As agreed, I didn't run
the tests or the migration here.

New test files:
- **`special-classes.test.ts`:**
  - the weekend register is refused;
  - asking (weekday, not your subject, times the wrong way round, overlapping);
  - only the subject's HOD (or the head/deputy) can approve, and nobody approves their own;
  - the register opens on the day;
  - only the asking teacher (or the head) takes it, and the class teacher can look;
  - it's kept out of the daily register;
  - no cancelling after the register is taken;
  - the head's own class needs no approval.
- **`sync-api.test.ts`:**
  - the snapshot holds only the teacher's scope, with the minimum learner fields;
  - a clerk gets 403;
  - changes come with the rows, deletions as tombstones, and a new class makes the phone resync;
  - a pushed register is applied once even when sent twice;
  - weekend, unknown and invalid operations are rejected with reasons;
  - the attendance conflict rule;
  - marks open, completed and window closed;
  - lesson logs and weekend-class registers;
  - another teacher's phone can't take a weekend-class register.

Changed: `register-covers.test.ts` now takes its register on the latest weekday, so it also
passes when run on a weekend.

## Your checklist

### 1. Install
1. Unzip `emis-phase-5.zip` over the project folder.
2. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   npm test
   ```
   - [ ] The migration ends with "All migrations have been successfully applied".
   - [ ] All tests pass, including `special-classes.test.ts` and `sync-api.test.ts`.
3. To get the demo weekend classes, wipe and re-seed Cranes (`docs/phases/demo-school-seed.md`).
   Or keep your data: the migration alone is enough, and you create weekend classes yourself.
4. `npm run dev`.

### 2. The weekend rule (as teacher@cranes.example, Esther Banda)
- [ ] **Attendance** with today being a Saturday or Sunday (or pick one in the date picker):
  "No register on a Saturday or Sunday", with a link to **Weekend classes**.
- [ ] In **Weekend classes**, after re-seeding:
  - [ ] last Saturday's class shows "Approved · register taken";
  - [ ] next Saturday's shows "Approved".

### 3. Asking for a weekend class
1. Go to **Weekend classes → Ask for a weekend class**.
2. Pick one of your classes, next Saturday, 14:00–15:30, topic "Test lesson".
3. First choose a weekday as the day.
   - [ ] "Choose a Saturday or Sunday", and the button stays greyed out.
4. Now choose next Saturday and press **Send for approval**.
   - [ ] "Waiting for HOD".
5. Ask again for the same class, next Saturday, 15:00–16:00.
   - [ ] Refused: "…already has … from 14:00 to 15:30 that day".

### 4. The HOD decides (sign in as hod.maths@cranes.example, Peter Mwale, the Maths & Sciences HOD)
1. Go to **Weekend classes** (HOD pages, or "To approve" on the teacher pages).
   - [ ] Esther's request is there.
   - [ ] After re-seeding, Brian Chanda's request is there too.
2. Press **Approve** with a note.
   - [ ] "Approved. The teacher has been told."
3. Sign in as **hod.languages@cranes.example** (Grace Mumba).
   - [ ] "To approve" has nothing from Maths/Science teachers.
4. Back as Esther.
   - [ ] A notification says it's approved.
5. Open its **Register**.
   - [ ] "The register opens on the day of the class (…)", and the buttons are greyed out.
6. Re-seeded only: open **last Saturday's** class and **Register**.
   - [ ] The class list with marks.
   - [ ] Change one, **Save register**.
   - [ ] "Register saved".

### 5. Head teacher (head@cranes.example)
1. Go to **Weekend classes**.
   - [ ] "To approve", "All" and "My weekend classes" tabs.
   - [ ] "All" lists everyone's weekend classes.
2. **Ask for a weekend class** yourself.
   - [ ] It's "Approved" straight away.
3. **Cancel** it.
   - [ ] "Cancelled".

### 6. The sync API (PowerShell, while `npm run dev` runs)
Use Esther's account. Put the demo password in `$pw` first.
1. Sign in and take a snapshot:
   ```powershell
   $pw = "<the demo password>"
   $base = "http://localhost:4000/api"
   $login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" `
     -Body (@{ identifier = "teacher@cranes.example"; password = $pw } | ConvertTo-Json)
   $h = @{ Authorization = "Bearer $($login.data.token)" }
   $snap = (Invoke-RestMethod -Uri "$base/sync/snapshot" -Headers $h).data
   $snap.data.students.Count
   $snap.data.students[0]
   ```
   - [ ] About 34–100 learners: only Esther's classes, not all 300.
   - [ ] A learner shows only id, version, learnerNumber, names, gender and status. No date of
     birth or address.
2. Take Friday's register for one learner, then send exactly the same thing again:
   ```powershell
   $classId = $snap.data.class_teacher_assignments[0].classId
   $termId = ($snap.data.terms | Where-Object isActive).id
   $student = ($snap.data.student_class_enrollments | Where-Object classId -eq $classId)[0].studentId
   $friday = (Get-Date).AddDays(-(((Get-Date).DayOfWeek.value__ + 2) % 7)).ToString("yyyy-MM-dd")
   $body = @{ deviceId = "my-test"; operations = @(@{ opId = "test-op-0001"; type = "attendance.mark";
     payload = @{ classId = $classId; termId = $termId; date = $friday; records = @(@{ studentId = $student; status = "LATE" }) } }) } |
     ConvertTo-Json -Depth 6
   (Invoke-RestMethod -Method Post -Uri "$base/sync/push" -Headers $h -ContentType "application/json" -Body $body).data.results
   (Invoke-RestMethod -Method Post -Uri "$base/sync/push" -Headers $h -ContentType "application/json" -Body $body).data.results
   ```
   - [ ] First: `status: applied`, `result` with `applied: 1`.
   - [ ] Second: `status: applied`, `duplicate: True`. It was applied once only.
3. Send the same, but for a weekend day (`opId = "test-op-0002"`, `date` = last Saturday).
   - [ ] `status: rejected`, `error`: "Attendance can't be taken on a Saturday or Sunday…".
4. Ask for the changes since the snapshot:
   ```powershell
   $c = (Invoke-RestMethod -Uri "$base/sync/changes?cursor=$([uri]::EscapeDataString($snap.cursor))&scope=$($snap.scope)" -Headers $h).data
   $c.resyncRequired
   $c.changes | Select-Object entity, op, @{n="status";e={$_.record.status}}, @{n="version";e={$_.record.version}}
   ```
   - [ ] `False`, and an `attendance_records` UPSERT with status LATE and version 2.

### 7. Commit
In GitHub Desktop, commit as "Phase 5: weekend classes and the phone sync API", then push.

Tell me what passes, and what fails with what you see.

## Not yet
- **The phone app** (Phase 6): offline storage, PIN or fingerprint lock, the "waiting to sync"
  counter, and the screens.
- **Marks history:** marks pushed from phones have no history line yet. The later entry wins
  while the window is open.
- **Public holidays** aren't blocked like weekends (no holiday calendar in the system yet).
