# Phase 4b: "Forgot password?", phone sign-in, transfers — what changed and how to test it

Built 17 October 2026. **One database migration**: `20261018090000_phase4b_resets_phone_transfers`.
Don't run the seed.

## What changed, in plain words

### Signing in with a mobile number
- The sign-in box now says **Email or mobile number**. Any common way of writing the number works:
  - 0977 123 456
  - 0977123456
  - +260 977 123 456
  - 260977123456
- **Who gets it:**
  - Every account's number is taken from the teacher's profile.
  - A new teacher, head or office account gets theirs when the account is made. On office
    accounts the mobile number is optional.
  - Changing a teacher's phone on the Teachers page changes the number they sign in with.
- **One number opens one account.** If two people share a phone (it happens: husband and wife,
  colleagues), neither gets it automatically, and they keep signing in with email. The
  migration does the same for existing accounts that share a number.

### "Forgot password?" now sends a request
- On the sign-in page a person enters their email or mobile number.
- **The page always answers the same way**, whether or not the account exists, and it's limited
  to a few tries.
- **The request goes to:**

  | Person who forgot | Who resets it |
  |---|---|
  | A teacher or clerk | Their school's head teacher **and** deputy head (both are notified) |
  | The head teacher | The deputy head, and the other way round |
  | A head with no deputy (or no other leader) | The school's DEBS |
  | DEBS staff | Their PEO (or HQ, if the PEO has no head yet) |
  | PEO staff | HQ |

- **School heads and deputies** see a **Password reset requests** box at the top of the Teachers
  page, plus a notification. **Offices** see them on the new **Requests** page.
- **Reset password** gives a one-time password, shown once. It's also sent by SMS, if the
  school has SMS set up. **Turn down** leaves the password as it is.
  - They should check it's really the person asking before pressing either.
- Every reset and every turn-down is written in the audit log: who asked, who reset it, and when.
- **There's no other way to reset someone's password any more.** The Teachers page's "Reset
  Password" menu item now appears only:
  - for someone with an open request, or
  - for an account that has **never been used**, to re-issue a lost or expired first password.
- **The last resort for HQ:**
  `npm run office:create-account -- --email someone@… --reset` gives an office account a new
  one-time password.

### Transfers (one account for life, one school at a time)
- **Asking:** on the Teachers page, **Add existing staff** finds someone by their exact email or
  mobile number. You can't browse other schools' staff. Choose their role, then **Ask for
  transfer**.
- **While it waits:** the person keeps working at their current school, and gets a note when they
  sign in that a transfer is waiting.
- **Deciding:**
  - The current school's head or deputy sees it under **Transfers waiting for confirmation**
    and can **Confirm transfer** or **Turn down**.
  - The DEBS (or PEO, or HQ) can do the same on the new **Transfers** page.
  - The asking school can **Withdraw** it while it waits.
- **On confirmation**, at the same moment, the person moves over completely. At the old school:
  - their class-teacher and subject assignments end today;
  - they stop being HOD there;
  - covers still to come are cancelled.

  Their timetable periods there need a new teacher. Their records (marks, registers, remarks)
  stay where they are.
- **Someone with no school at the moment** (left teaching and coming back) joins straight away.
- **A DEBS registering a school** can now choose **Someone with an account** as head, for
  example a deputy promoted to head. Their account and password stay theirs. If they work at
  another school now, it's a transfer to confirm.
- **The Teachers page has a new filter:** **Current staff** (the default), **Joining (transfer
  waiting)** and **Former staff**.
  - Former staff are read-only: no Edit, Delete or Reset.
  - Lists, dropdowns and dashboard counts across the school now show current staff only.

## Verified on my side
Type checks pass for the server, the school app and the shared package. As agreed, I didn't run
the tests or the migration here.

New test files:
- **`password-resets.test.ts`:**
  - the same reply for real and unknown accounts;
  - head and deputy are notified;
  - a reset gives a working one-time password and closes the request;
  - no reset without a request;
  - every routing rule in the table above;
  - the DEBS resets a lone head, while officers and other districts can't;
  - nobody resets their own password;
  - turning a request down;
  - signing in with a number written four ways;
  - a shared number is left off the second account.
- **`transfers.test.ts`:**
  - finding a person by email;
  - the teacher keeps working at the old school while the transfer waits;
  - the old school confirms;
  - the old school's assignments and HOD post are released;
  - the person appears as former staff (read-only) at the old school and current staff at the
    new one;
  - turning down, withdrawing, and coming back to a former school;
  - the DEBS confirms, while another district can't;
  - someone with no school joins at once;
  - a DEBS registers a school with an existing person as head.

Existing tests updated:
- `teachers.test.ts`: the reset now needs a request.
- `auth-routes.test.ts`: the sign-in error now says "email/mobile number".

## Your checklist

Use the accounts from the Phase 4a checklist:
- HQ, the Lusaka PEO, the Chongwe DEBS;
- Chongwe Day and its head, Mutinta;
- Kaliwe Heights, which you moved to Chongwe.

As before, a normal and a private window let you be two people at once.

### 1. Install
1. Unzip `emis-phase-4b.zip` over the project folder and let it replace files.
2. From the `emis` folder:
   ```powershell
   npm run db:migrate:deploy
   npm test
   ```
   - [ ] The migration ends with "All migrations have been successfully applied".
   - [ ] All tests pass, including `password-resets.test.ts` and `transfers.test.ts`.
3. `npm run dev`.

### 2. Sign in with a mobile number
1. As the Kaliwe Heights head, go to **Teachers** and edit a teacher.
2. Set their phone to `0966100200` (a made-up number; the form wants it without spaces) and
   save.
3. Sign out. In the sign-in box type `0966 100 200`, then that teacher's password.
   - [ ] You're signed in as them.
4. Sign out, sign in again with `+260966100200`.
   - [ ] Works too.
5. Sign in with their email.
   - [ ] Still works.
6. Try `0966 999 999` with any password.
   - [ ] "Invalid email/mobile number or password".

### 3. A teacher forgets their password
1. In a private window, go to the sign-in page, press **Forgot password?** and enter that
   teacher's email.
   - [ ] "If this account exists, your school … has been asked to reset your password."
2. Do the same with `nobody@school.example`.
   - [ ] Exactly the same reply.
3. As the Kaliwe head (normal window), open **Teachers**.
   - [ ] A **Password reset requests** box at the top shows the teacher, with when they asked.
   - [ ] The notification bell has "Password reset request: …".
4. Open another teacher's ⋮ menu (someone who has signed in before).
   - [ ] **No Reset Password item**. The asking teacher's menu does have it.
5. Press **Reset password** in the box, then confirm.
   - [ ] A one-time password is shown once.
   - [ ] The box disappears.
6. In the private window, sign in as the teacher with the one-time password.
   - [ ] You're asked to choose your own password; then you're in.
7. Ask again for the same teacher, and this time press **Turn down**.
   - [ ] Their password still works as before.

### 4. A head with no deputy forgets
1. In the private window, press **Forgot password?** for `head.chongwe@school.example`
   (Chongwe Day has no deputy).
2. As the Chongwe DEBS, open **Requests** in the sidebar.
   - [ ] Mutinta is listed, with "Head teacher, Chongwe Day Secondary School".
3. Press **Reset password**.
   - [ ] One-time password shown.
4. Sign Mutinta in with it and choose a new password.
5. As the Chongwe DEBS, open **Audit log**.
   - [ ] "Password reset" with who did it.
6. Optional: press **Forgot password?** for `debs.chongwe@ministry.example`.
   - [ ] It appears on the **Lusaka PEO's** Requests page, not the DEBS's.

### 5. A transfer between two schools
Use a fresh teacher, so your demo teacher stays where they are.

1. As the Kaliwe head, use **Add Teacher**:
   - name "Transfer Test";
   - email `transfer.test@school.example`;
   - phone `0966300400`.
2. In the private window, sign Transfer Test in once with the one-time password and choose a
   password.
3. As Mutinta (Chongwe Day head), go to **Teachers → Add existing staff** and search
   `0966 300 400`.
   - [ ] "Transfer Test · Works at Kaliwe Heights Secondary School…".
   - [ ] Searching just `transfer` finds nothing (no browsing).
4. Choose **Teacher**, then **Ask for transfer**.
   - [ ] "Transfer requested…".
   - [ ] **Transfers waiting for confirmation** shows "Joining us".
   - [ ] The filter **Joining (transfer waiting)** lists them.
5. Sign in as Transfer Test.
   - [ ] Still Kaliwe Heights.
   - [ ] A note: "Your transfer to Chongwe Day … is waiting for confirmation".
6. As the Kaliwe head, open **Teachers**.
   - [ ] The transfer shows "Leaving us".
7. Press **Confirm transfer** and confirm.
   - [ ] "Transfer Test now works at Chongwe Day…".
8. Kaliwe Teachers, filter **Former staff**.
   - [ ] Transfer Test is there.
   - [ ] Their ⋮ menu has no Edit, Delete or Reset.
   - [ ] They're gone from **Current staff**.
9. Sign in as Transfer Test (same password).
   - [ ] Now Chongwe Day.
10. Chongwe Day Teachers (as Mutinta).
    - [ ] Transfer Test is current staff.
    - [ ] Mutinta has a notification "Transfer confirmed".

### 6. Turning down and withdrawing
1. As Mutinta, ask for another Kaliwe teacher.
2. As the Kaliwe head, press **Turn down**.
   - [ ] They stay at Kaliwe.
   - [ ] Mutinta gets "Transfer turned down".
3. Ask again as Mutinta, then press **Withdraw**.
   - [ ] It disappears for both schools.

### 7. The DEBS: confirm a transfer, and a new school with an existing head
1. As the Chongwe DEBS, open **Schools → Register school**:
   - name "Chongwe North Secondary";
   - head: **Someone with an account**;
   - find `transfer.test@school.example`.
   - [ ] "Works at Chongwe Day Secondary School…".
2. Press **Register school**.
   - [ ] "…transfer is waiting for confirmation".
   - [ ] No one-time password: they keep their own password.
3. Open **Transfers** (sidebar).
   - [ ] Chongwe Day → Chongwe North as head teacher.
4. Press **Confirm transfer**.
5. Sign in as Transfer Test.
   - [ ] You land on **Set up Chongwe North Secondary**, as its head.
6. The DEBS **Audit log**.
   - [ ] Lines for transfer asked, transfer confirmed and school registered.

### 8. Office account with a mobile number
1. As the Chongwe DEBS, go to **Offices & accounts → Add account** (officer) and fill in a
   mobile number.
2. Sign them in with that number and the one-time password.
   - [ ] Works.

### 9. Commit
In GitHub Desktop, commit as "Phase 4b: forgot-password requests, phone sign-in, transfers,
former staff", then push.

Tell me what passes, and what fails with what you see.

## Good to know
- **Accounts that share a phone number** (some demo accounts do) didn't get it. They sign in with
  email. Give one of them a different number on the Teachers page if you want to test.
- **Requests are dropped after 7 days.** A request nobody handled stops counting after 7 days, and
  the person asks again. Asking again within the hour changes nothing.
- **Old reset buttons are gone.** The head and deputy no longer have a "reset anyone" button.
  That was the plan in the design (§3b), so a reset always has a request and an audit line
  behind it.

## Not yet
- **Timetable periods aren't moved automatically.** A transferred teacher's periods at the old
  school stay on the timetable until the head swaps or regenerates them.
- **Unhandled requests don't escalate on their own.** For example, a request isn't passed to the
  DEBS after a few days if the head is away. Tell me if you want it.
- **Phase 5, next:** the sync API that the phone app will use (pull changes, push changes,
  conflicts).
