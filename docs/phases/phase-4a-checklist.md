# Phase 4a: education offices, the account chain and school setup — what changed and how to test it

Built 17 October 2026. **One database migration**, `20261017090000_phase4a_offices_and_accounts`.
Your existing schools are marked as already set up, so nothing changes for them. Don't run the
seed.

## What changed, in plain words
- **Education office accounts.** People at Ministry HQ, a Provincial Education Office (PEO) or a
  District Education Board (DEBS) now have accounts of their own.
  - They use the same sign-in page as everyone else and land on the new **office pages**:
    Overview, Schools, Offices & accounts, Audit log.
  - Each office has a **head** (makes changes) and **officers** (can see everything, change
    nothing).
- **The account chain:**

  | Office | Sees | Its head can |
  |---|---|---|
  | **HQ** | every office and school | create accounts anywhere (PEOs first); add district offices to any province; move schools between districts |
  | **PEO** | its province's districts and schools | add the province's district offices; create their DEBS accounts; move schools within the province (or out of "not yet assigned") |
  | **DEBS** | its district's schools | **register a school together with its first head teacher**; correct EMIS numbers (pending / confirmed / disputed); add officers |

  Rules that apply to every level:
  - Heads of an office are created by the level above.
  - A head adds officers to their own office.
  - A DEBS can only register schools in its own district; the server enforces it.
- **District offices.** The official list of education districts isn't loaded yet (still
  wanted), so PEOs and HQ add their own districts. Existing schools stay in "District not yet
  assigned" until HQ or the PEO moves them.
- **First-time setup for a new school.**
  - When a DEBS registers a school, the head gets a one-time password.
  - After choosing their own password, the head is held on a **setup wizard** with these steps:
    1. School details.
    2. An active academic year with its terms.
    3. Year levels.
    4. Subjects (recommended, not required).
  - Until the required steps are done and **Finish setup** is pressed, the server keeps the
    school's other pages closed, the same way it does for the password change. Anyone else at
    that school sees "being set up".
- **The first HQ account** is made with a command: `npm run office:create-account` (below).
  It prints a one-time password once.
- **Audit log.** The following are recorded with who and when:
  - accounts and district offices created;
  - office roles ended;
  - schools registered, changed (including old → new EMIS number) or moved;
  - setups finished.

  Each office sees its own area's log. Lines can't be changed or deleted.

## Verified on my side
Type checks pass for the server, the school app and the shared package. As agreed, I didn't run
the tests or the migration here.

New test file `office-chain.test.ts`:
- **the full chain**:
  - HQ creates a PEO;
  - the PEO adds a district and creates its DEBS;
  - the DEBS registers a school with its head;
  - each person must change their password first;
  - the head is held in setup until year, terms and year levels exist, then finishes it;
  - everything shows in HQ's audit log;
- **each office stays inside its area**:
  - a PEO can't create accounts in another province, or a head for its own office;
  - a DEBS can't act outside its district;
  - an officer changes nothing;
  - only a DEBS head registers schools;
  - EMIS numbers are unique;
  - a school isn't left behind if its head can't be created;
  - lists and audit logs are limited to each office's area;
- moving schools: a PEO can move a school within its province only; a DEBS can't move schools;
- office accounts are refused on school pages, and school accounts on office pages;
- ending an office role takes the person out of the office pages, and nobody can end their own.

## Your checklist

Tip: to be signed in as two people at once, use a normal window and a private/incognito window.
The browser keeps one sign-in per window type.

### 1. Install
1. Unzip `emis-phase-4a.zip` over the project folder and let it replace files.
2. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   npm test
   ```
   - [ ] The migration ends with "All migrations have been successfully applied".
   - [ ] All tests pass, including `office-chain.test.ts`.
3. Make the first HQ account. Use any email you like; the `.example` ending keeps it obviously
   a test account.
   ```powershell
   npm run office:create-account -- --email hq@ministry.example --name "HQ Administrator"
   ```
   - [ ] It prints a one-time password. Copy it.
4. `npm run dev`.

### 2. HQ → PEO
- [ ] Sign in as `hq@ministry.example` with the one-time password.
  - [ ] You're asked to choose your own password.
  - [ ] Then you land on the **office Overview** ("Ministry of Education Headquarters").
- [ ] **Offices & accounts**: all 10 provinces and the "not yet assigned" placeholders are listed.
  - [ ] On *Lusaka Provincial Education Office*, **Add account**: name "Lusaka PEO", email
    `peo.lusaka@ministry.example`, role head.
  - [ ] A one-time password is shown once. Copy it.
- [ ] **Schools** lists your existing schools (Kaliwe Heights, your own school), all in "District
  not yet assigned".

### 3. PEO → district → DEBS (private window)
- [ ] Sign in as `peo.lusaka@ministry.example` and choose a password.
- [ ] **Offices & accounts → Add district office**: "Chongwe District Education Board", code
  `DEBS-CHONGWE`.
  - [ ] It appears under Lusaka.
- [ ] On Chongwe, **Add account**: role *District Education Board Secretary*, email
  `debs.chongwe@ministry.example`. Copy the password.
- [ ] Try **Add account** on your own office. Only *Officer* is offered: heads come from HQ.
- [ ] **Schools**: move *Kaliwe Heights* (the → arrow) to Chongwe.
  - [ ] It now shows District = Chongwe.
  - [ ] HQ's **Audit log** shows "Moved Kaliwe Heights Secondary School to Chongwe…".

### 4. DEBS → school + head
- [ ] Sign in as `debs.chongwe@ministry.example` (choose a password).
  - [ ] **Schools** shows only Kaliwe Heights, the school in this district.
- [ ] **Register school**:
  - name "Chongwe Day Secondary School", EMIS `CH-0001`;
  - head "Mutinta Hamoonga", email `head.chongwe@school.example`, phone `0977000111`;
  - a date of birth, staff number `TS-90001`, Degree.
  - [ ] A one-time password for the head is shown once. Copy it.
- [ ] Register another school with the same EMIS number. It's refused with "already used by…".
- [ ] Edit *Chongwe Day*: set EMIS status to **Confirmed**. The audit log records it.

### 5. The new school's setup (head)
- [ ] Sign in as `head.chongwe@school.example`, choose a password.
  - [ ] You land on **Set up Chongwe Day Secondary School**.
- [ ] Type `/admin/students` in the address bar. You're sent back to the setup page.
- [ ] **Finish setup** is greyed out. Then work through the steps:
  - [ ] **School details**: choose Secondary, add a motto, then **Save details**.
  - [ ] **Add academic year** (2026), then **Make active**. Then **Add term**.
  - [ ] **Year levels → Add from template → Secondary Forms 1–6**.
  - [ ] Optional: **Choose from the national list** and add a few subjects.
- [ ] Each step gets a green tick. **Finish setup** becomes active; press it.
  - [ ] You land on the normal head teacher dashboard, with the school's name in the sidebar.
- [ ] The DEBS's **Schools** list no longer says "setting up" for Chongwe Day. The audit log
  shows "finished its first-time setup".

### 6. Keeping apart
- [ ] As the DEBS, type `/admin` in the address bar. You're sent to the office pages.
- [ ] As `teacher@kaliweheights.example`, type `/office`. You're sent away from the office pages
  (to sign-in, or straight back to your own pages), because this account has no office role.
- [ ] Your existing schools work exactly as before; there's no setup wizard for them.

### 7. Commit
GitHub Desktop: "Phase 4a: education offices, account chain, school setup wizard, audit log",
then push.

Tell me what passes, and what fails with what you see.

## Not yet (Phase 4b, next)
- **"Forgot password?" requests**:
  - the request goes to the school's head and deputy, then up to the DEBS, PEO or HQ;
  - with a "Reset password" button that exists only while a request is open.
- **Signing in with a mobile number** as well as email.
- **Transfers**:
  - the receiving school adds an existing person;
  - the old school (or the DEBS) confirms;
  - class assignments at the old school are released;
  - a "former staff" filter on Teachers.
- **Adding an existing person as a school's head** (e.g. a deputy promoted to another school).
  Until transfers exist, a DEBS registers a new school's head with an email that has no account
  yet.
- **Office statistics** (learners, attendance, results across schools) come with the dashboards
  in Phase 7. The office pages show schools and accounts, not learners' data.
