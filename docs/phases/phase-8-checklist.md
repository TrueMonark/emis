# Phase 8: announcements — what changed and how to test it

Built 2 November 2026. **One database migration**: `20261102090000_announcements`.

## What changed, in plain words

### Offices post announcements (circulars)
- **Office → Announcements → New announcement.** Only the head of the office posts, whether HQ,
  a PEO or a DEBS.
  - Give it a **title** and a **message**.
  - **Who receives it:** head teachers and deputies only, or **all staff** (teachers, clerks and
    finance staff too).
  - **Ask for an acknowledgement:** each school's head teacher or deputy must press
    "Acknowledge", and the office sees which schools haven't yet.
  - **Attachments:** PDF, PNG or JPEG files, up to 5 per announcement and 9 MB in total, e.g.
    the signed circular.
- **It reaches every active school in the office's area straight away.** That means all schools
  for HQ, the province's schools for a PEO, and the district's schools for a DEBS.
- **It can't be edited afterwards.** A circular is a record. The office that posted it can
  **withdraw** it, giving a reason. Schools then see it marked "Withdrawn" with the reason, and
  can no longer acknowledge it.
- **Progress, per announcement:** how many schools have opened it, and, if asked, how many have
  acknowledged it.
  - The table shows each school with when it was first opened, how many people there opened
    it, and who acknowledged it and when.
  - Filters show "Not opened" and "Not acknowledged".
  - **Schools** downloads the table as a spreadsheet (CSV).
- **Offices see announcements from above too.** A DEBS sees HQ's and the PEO's announcements,
  counted over its own schools. These are read-only for the DEBS.
- Posting and withdrawing are in the **Audit log**.

### Schools receive them
- **Announcements** is a new menu item for every role at a school: head, deputy, clerk,
  teachers (and HODs) and finance staff.
  - The head and deputy see every announcement.
  - Everyone else sees only the ones sent to all staff.
  - On phones it's in the menu drawer.
- **A number beside "Announcements"** counts what's waiting: unread announcements, plus, for
  the head and deputy, ones the school still has to acknowledge. It goes down as you read them.
- **Opening one** shows the message and its attachments, and records that you've read it.
  Unread ones have a blue dot.
- **Acknowledge for the school** (head or deputy, when the office asked for it): one press
  covers the school, and everyone at the school then sees "Acknowledged by …".
- **Attachments are private.** They aren't public links like the school logo:
  - Only people who received the announcement, and the offices that can see it, can open them.
  - Files are stored on the server in a separate private folder (`apps/server/private-files`,
    or `PRIVATE_FILES_DIR` in production). That folder is kept out of git.
  - A file that claims to be a PDF but isn't is refused.

### Not in this phase
- Announcements on the **teacher phone app**: they'd need to be added to phone sync, which
  comes later.
- **SMS or email** alerts when an announcement is posted.
- Schools sending announcements to their own staff or parents. The existing SMS and
  notifications pages cover some of this.

### Demo school (Cranes)
After a fresh wipe and seed:
- one announcement from **HQ to all staff**;
- one from the **DEBS to the head and deputy**, asking for an acknowledgement.

Neither has been opened yet, and neither has attachments. Try attachments by posting one
yourself.

### Also in this delivery
- Returns and announcements now share one piece of code for "which offices reach which
  schools". Returns behave exactly as before.

## Verified on my side
- Type check for the server, the school app and the shared package: clean.
- ESLint on every new and changed file: clean.
- New integration tests in `apps/server/tests/integration/announcements.test.ts`, written but
  not run on my side:
  - a DEBS posts to leaders with a PDF; the head reads it, opens the file and acknowledges; the
    office sees "opened 1, acknowledged 1";
  - teachers, and the other district's head, see neither the announcement nor the file;
  - HQ to all staff reaches teachers in both districts; teachers can't acknowledge; each
    office counts only its own schools;
  - officers can't post; a fake PDF and a wrong audience are refused, and nothing is saved;
  - only the posting office withdraws; after that it can't be acknowledged;
  - one district doesn't see another district's announcements.

## Your checklist

### 1. Install
1. Unzip `emis-phase-8.zip` over the project folder.
2. From the `emis` folder, one line at a time:
   ```powershell
   npm run db:migrate:deploy
   ```
   ```powershell
   npm test
   ```
   - [ ] The deploy applies `20261102090000_announcements` only.
   - [ ] All tests pass, including `announcements.test.ts` and `returns.test.ts`.
3. Optional: wipe and re-seed Cranes to get the two demo announcements
   (`docs/phases/demo-school-seed.md`).
4. Delete `apps\school\.next`, then run `npm run dev`.

### 2. Post one (as debs.lusaka@ministry.example)
1. **Announcements → New announcement.**
   - Title: "Test circular".
   - Write a short message.
   - Choose **Head teachers and deputies**.
   - Tick **Ask … to acknowledge**.
   - Attach a PDF and a photo (JPEG).
2. **Post to the schools.**
   - [ ] It appears in the list with "Opened 0/1" and "Acknowledged 0/1".
3. Try to attach a `.docx` file.
   - [ ] "Only PDF, PNG and JPEG files can be attached".

### 3. The school (as head@cranes.example)
1. Look at the sidebar.
   - [ ] **Announcements** has a number beside it (under "Education office").
2. Open **Announcements → Test circular**.
   - [ ] The message, both files and an amber **Acknowledge** badge.
3. Click the PDF.
   - [ ] It opens in a new tab.
   - [ ] Copy that tab's address into a new **private/incognito** window. It doesn't open there:
     the address only lives in your own browser.
4. **Acknowledge for the school.**
   - [ ] "Acknowledged for the school by …", and the number in the sidebar goes down.
5. As **teacher@cranes.example**, open **Announcements**.
   - [ ] "Test circular" isn't there (it went to leaders only).

### 4. Back at the office (debs.lusaka@ministry.example)
1. Open **Test circular**.
   - [ ] "1 of 1 school(s) have opened it", "1 of 1 have acknowledged it".
   - [ ] Cranes shows the time it was opened, and the head's name under "Acknowledged".
   - [ ] **Schools** downloads the CSV.
2. **Withdraw**, with the reason "Test finished".
   - [ ] The head sees it marked **Withdrawn** with the reason.

### 5. All staff, from HQ
1. As **hq@ministry.example**: post an announcement to **All staff at the schools**, without
   asking for an acknowledgement.
2. Check who sees it:
   - [ ] **teacher@cranes.example** sees it, and has no Acknowledge button.
   - [ ] **bursar@cranes.example** (finance) sees it under **Announcements** in the fees
     sidebar.
3. As **debs.lusaka@ministry.example**: it's in the list as "From HQ …".
   - [ ] There's no Withdraw button.
4. As **officer.lusaka@ministry.example**:
   - [ ] There's no "New announcement" button.

### 6. Audit log (as the DEBS)
- [ ] "Posted "Test circular" to head teachers and deputies (acknowledgement asked), 2
  attachment(s)" and "Withdrew "Test circular": Test finished".

## Commit
GitHub Desktop or the terminal:
```powershell
git add -A
```
```powershell
git commit -m "Phase 8: announcements from the offices (leaders or all staff, private attachments, read receipts, acknowledgements)"
```
```powershell
git push
```

Send me anything that doesn't match, with a screenshot or the error text.
