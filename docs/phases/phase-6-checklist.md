# Phase 6: the teacher phone app — what changed and how to test it

Built 22 October 2026. **No database migration.** The app talks to the phone sync API built in
Phase 5 (and Phase 5b's calendar and marks rules).

## What it is, in plain words
**Monark Edu**, a teacher app for **Android and iPhone**, in `apps/mobile`. A teacher signs in once
with signal; after that it opens with a **PIN** and works **without signal**. Everything saved
offline is sent when there's signal again.

### Signing in and the PIN
- **Sign in** with the server address, your email or mobile number, and your password. It's the
  same account as the website.
- **A one-time password** has to be changed first, in the app.
- **The first download:** your classes, learners (names and learner numbers only), timetable,
  assessments, this term's registers, lesson logs and special classes.
- **Then choose a 4–6 digit PIN.** Easy ones like 1111 or 1234 are refused.
- **When it locks:** each time it's opened, and after 2 minutes in the background.
  - 5 wrong PINs and you need your password again, with signal.
  - The phone's data is kept if the same teacher signs in again.
- **How long offline:** up to 14 days without syncing (the school system's setting). After that,
  saving is refused until the phone syncs once.
- **Signing out** removes everything from the phone. It warns first if anything hasn't been sent.
- **A lost phone:** if the school deactivates the account, the phone stops syncing the next time
  it connects.

### Home: cards you can tap
Each card opens what it counts:
- **Today's lessons** → the timetable;
- **Registers to take**: the daily registers still incomplete, plus lessons so far with no
  register → Registers;
- **Marks to enter**: published assessments with learners still without a mark → Marks;
- **Waiting to sync**: red if something was refused → the Sync page;
- **My classes** (with the number of learners) → the class lists;
- **Lessons to log**: today's lessons with no lesson log → the timetable;
- **Special classes**: approved ones coming up, and how many are waiting for the HOD.

Pull down to sync. The top of Home says whether you're offline, when you last synced, and how
many changes are waiting.

### Tabs
- **Timetable**:
  - Monday–Friday, today highlighted;
  - each lesson has **Take register** and **Log lesson**, showing "marked" or "logged" once done;
  - weekends, public holidays and closure days say "No school".
- **Registers**:
  - pick the day: today, or up to 3 weeks back;
  - the **daily register** of your class (as class teacher, or a register cover);
  - **your lessons** that day;
  - **special classes** that day.
  - Every register shows "12/35" marked.
- **Marks**:
  - **published** assessments of your classes and subjects, to enter marks: a number out of the
    total, or **AB**;
  - **completed** ones to look at only.
- **More**: your account, Sync, My classes, Special classes, the server address, Sign out.

### Taking a register
- One row per learner, with **P / A / L / E** (present, absent, late, excused).
- **Mark the rest present** fills in everyone not marked yet. Then change the few who aren't
  present.
- **Save register** keeps it on the phone and sends it straight away if there's signal.
  - Until the server accepts it, the register shows "waiting to send".
  - Your taps aren't lost if a sync happens while you're marking.
- The app refuses:
  - weekends, public holidays and closure days (special classes are the exception);
  - days that haven't come yet;
  - other teachers' classes;
  - a lesson on the wrong day.
- **The server checks everything again.** If a mark was corrected on the web *after* your offline
  change, the newer one is kept and the Sync page says so.

### Marks, lesson logs, special classes
- **Marks:** type the mark (it turns red over the total) or tap **AB**, then Save.
  - The server refuses marks once the assessment is completed or the entry window has closed.
  - The marks history (Phase 5b) shows the change as coming from the phone.
- **Lesson log:** the topic and subtopics for a lesson on its own day.
- **Special classes:** ask for one on the website. Once the HOD approves, take its register in the
  app on the day.

### The Sync page
- **Waiting to send.**
- **Refused, with the reason.** For example "This assessment has been completed…" or "The marks
  entry window closed…".
- **Sent** (the last two weeks). It also says when someone else's newer mark was kept.
- **Sync now.**

### Reminders, the floating bar and dark mode (added 23 October 2026)
- **Reminders (alarms)** come from the phone itself, so they work without signal. Set them under
  **More → Reminders & appearance**. Each one can be switched off:
  - **before each lesson:** 5, 10 (the default), 15 or 20 minutes before, e.g. "Next lesson in 10
    min: Mathematics · Form 2 A at 10:20". Tapping it opens that lesson's register;
  - **morning register:** at a time you pick (default 07:20), for your class or one you're
    covering. Not sent if the register is already taken;
  - **lesson logs:** later in the day (default 15:30), if today's lessons aren't logged;
  - **special classes:** 15, 30 or 60 minutes before an approved weekend or holiday class;
  - **not sent yet:** two hours after saving, if changes are still waiting to sync;
  - **offline limit:** two days before the phone must sync to keep saving.
- **When they don't come:** never on weekends, public holidays or closure days, and never between
  20:00 and 06:00. They're worked out for the next 7 days and updated whenever your timetable,
  registers or settings change.
- **Testing them:** "Send a test reminder" shows one in 5 seconds. The page says how many are set.
- **Ideas for later** (they need the server to send a message to the phone, which Expo Go can't
  receive; that needs our own app build):
  - your special class was approved;
  - the marks window closes tomorrow;
  - the head asks for a register.
- **The crown loader:** the animated Monark crown shows while the app starts, while signing in and
  the first download run, and on the Sync page while syncing.
- **Fix, 23 October 2026:** Expo Go on Android doesn't have expo-notifications' push "topic"
  module, so importing reminders crashed the app ("Cannot find native module
  'ExpoTopicSubscriptionModule'"). `metro.config.js` now swaps in a stand-in
  (`src/stubs/topic-subscription.js`). Local reminders are unaffected.
- **The floating "island" tab bar,** like the website on a phone: a dark rounded bar with a blue
  glow, clear of the screen edges. The open tab has a blue chip. Pages scroll fully underneath it.
- **Dark mode:** More → Reminders & appearance → **Follow the phone** (the default), **Light** or
  **Dark**. "Follow the phone" switches with the phone's own setting.

## Technical notes (for later)
- The app is its **own npm project** (not a workspace), so its React and React Native versions
  never clash with the website's. The root `package.json` now lists workspaces explicitly
  (`apps/server`, `apps/school`, `packages/*`). It has new scripts: `mobile`, `mobile:install`
  and `mobile:typecheck`.
- **Expo SDK 57** (React Native 0.86): the Play Store Expo Go (client 57.0.9) supports SDK 57 only. Moved down from SDK 58 on 23 October 2026.
- It uses the shared code in `packages/shared` (phone numbers, weekends, the password-change
  code).

## Verified on my side
- The app type-checks (`tsc`).
- The rest of the repo still type-checks.
- As agreed, I didn't run or build the app here. The first run on your phone is the real test,
  so send me any red error screen exactly as it appears.

## Your checklist

### 1. Install (once)
1. Unzip `emis-phase-6.zip` over the project folder.
2. From the `emis` folder:
   ```powershell
   npm install
   npm run mobile:install
   ```
   - The first command only notices the new workspace list.
   - The second installs the app's own packages (a few minutes).
3. **Optional check:** `cd apps\mobile`, then `npx expo-doctor`. It should say all checks pass. If
   it lists version mismatches, send me the output.
4. On your phone, install **Expo Go** from the Play Store or App Store.
5. **Windows Firewall:** the phone must reach your laptop on ports **4000** (the server) and
   **8081** (the app's code). The first time you run them, allow Node.js on **Private** networks.
   The phone and laptop must be on the **same Wi-Fi**.
6. Find your laptop's address: run `ipconfig` and look for the IPv4 address of your Wi-Fi
   adapter, e.g. `192.168.1.20`.

### 2. Run it
1. In one window, from `emis`: `npm run dev` (server and website, as usual).
2. In a second window, from `emis`: `npm run mobile`.
   - [ ] A QR code shows.
3. Scan it: with **Expo Go** on Android, or the **Camera** app on iPhone.
   - [ ] The app opens on "Sign in" with the Monark Edu logo.
   - If the phone can't connect, stop it and use `npm run mobile:tunnel` instead.

### 3. Sign in (Cranes demo, as Esther Banda)
1. Server address: `192.168.1.20:4000` (your laptop's address). Email: `teacher@cranes.example`.
   Password: the demo password.
   - [ ] It downloads, then asks you to choose a PIN.
2. Choose `1234`.
   - [ ] "Choose a PIN that isn't easy to guess".
3. Choose `2580`, then type it again.
   - [ ] Home opens: "Hello, Esther", the date, "Cranes Secondary School", and the cards.
4. Optional: sign in as a teacher still on a one-time password.
   - [ ] It asks for a new password first.
5. As `head@cranes.example`.
   - [ ] Works too (the head has a teacher profile).
6. As `debs.lusaka@ministry.example`.
   - [ ] "This app is for teachers at a school…".

### 4. Cards
Tap each card.
- [ ] Today's lessons → Timetable
- [ ] Registers to take → Registers
- [ ] Marks to enter → Marks
- [ ] Waiting to sync → Sync
- [ ] My classes → the class list, then a class → its learners
- [ ] Lessons to log → Timetable
- [ ] Special classes → the list

### 5. A register with no signal
1. Turn on **airplane mode**. Keep Wi-Fi off too.
   - [ ] Home says "No connection…".
2. **Registers → Daily register → Form 2 A** (if today is a school day).
3. Tap **Mark the rest present**. Set two learners **A** and one **L**, then **Save register**.
   - [ ] "Saved on the phone. It will be sent when there's signal."
   - [ ] The Waiting to sync card shows 1.
   - [ ] The register shows "waiting to send".
4. Close the app completely and open it again.
   - [ ] It asks for the PIN.
   - [ ] The register is still there, still waiting.
5. Turn airplane mode **off** (Wi-Fi back on).
   - [ ] Within a few seconds, Waiting to sync goes to 0.
6. On the website, as Esther: **My classes → Form 2 A → register for today**.
   - [ ] The same two absent and one late.

### 6. Refusals
1. On Registers, go back to a **Saturday**, or the **Mid-term break** day after re-seeding with 5b.
   - [ ] "No registers on Saturday…" and a link to special classes.
2. In airplane mode, open **Marks**, an assessment, and enter marks, then Save.
   - [ ] Saved, waiting.
3. Meanwhile, on the website as the head, **Complete** that assessment.
4. Turn signal back on.
   - [ ] The Sync page lists it under **Refused**: "This assessment has been completed…".
   - [ ] The Waiting to sync card turns red.
5. **Conflict:** in airplane mode, change a learner's mark from the phone and save. Then change the
   same learner's mark on the website. Then turn the signal back on.
   - [ ] The Sync page says "…their newer mark was kept".
   - [ ] The website's **Marks history** shows "Phone change not applied".

### 7. Lesson log and special class
1. **Timetable → today → Log lesson**: topic "Fractions", then Save.
   - [ ] "Lesson logged".
   - [ ] It's on the website's lesson logs.
2. If there's an approved special class for today or earlier, open it from **Special classes** and
   take its register.
   - [ ] It's accepted.

### 8. Lock and sign out
1. Put the app in the background for over 2 minutes and come back.
   - [ ] It asks for the PIN.
2. Enter a wrong PIN 5 times.
   - [ ] It asks you to sign in with your password again.
3. Sign in as the same teacher.
   - [ ] Your data is still there.
4. **More → Sign out** with something waiting.
   - [ ] It warns "N change(s) haven't been sent…".

### 9. Reminders, floating bar, dark mode
1. Make sure the bar at the bottom floats.
   - [ ] It's a dark rounded bar with a gap at the sides and bottom, and the open tab is blue.
   - [ ] Scrolling Home all the way down, the last card shows above the bar.
2. Go to **More → Reminders & appearance**.
   - [ ] The phone asks to allow notifications (Android 13+ / iPhone). Allow.
3. Press **Send a test reminder**, then lock the phone.
   - [ ] A "Monark Edu" notification arrives in about 5 seconds.
   - [ ] Tapping it opens the settings page.
4. Look at "N reminder(s) set for the next 7 days".
   - [ ] On a school day with lessons left, it's more than 0.
5. Switch **Before each lesson** off.
   - [ ] The number goes down.
   - [ ] Switch it back on and choose **5 min**.
6. Optional: wait for a real lesson reminder before your next lesson.
   - [ ] Tapping it opens that lesson's register.
7. Choose **Dark**.
   - [ ] Everything turns dark, and you stay on the settings page.
   - [ ] Check Home, Registers and Marks.
8. Choose **Follow the phone**, then switch the phone's own dark mode on and off.
   - [ ] The app follows it.

Send me anything that doesn't match, with a screenshot (the red error screens especially).
