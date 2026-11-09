# Phase 9c: announcements on the teacher phone app — what changed and how to test it

Built 4 November 2026. **No database changes.** The server's phone sync and the phone app
changed.

## What changed, in plain words
- **Announcements reach the phone with every sync.** That's the same list as the website's
  Announcements page: everything for the head and deputy, and all-staff announcements for
  everyone else. The phone keeps the latest 50.
- **They can be read offline**, once they've arrived.
- **Where to find them:**
  - an **Announcements** card on the Home tab, counting what's unread or still to acknowledge;
  - **More → Announcements**.
- **Opening one** marks it read. That's sent with the next sync, so the office sees the school
  "opened" it.
- **Acknowledge for the school** (head teacher or deputy, when the office asked for it):
  - Works offline too. It shows "Acknowledgement waiting to send" until the phone syncs.
  - A teacher can't acknowledge. The server refuses it, as on the website.
- **Withdrawn** announcements show the office's reason.
- **Attachments** are listed by name and size. They open on the website, because they're
  private files and aren't stored on phones.

## Verified on my side
- **Type checks:** server and phone app clean; ESLint on the server's changed files clean.
- **New tests:** `apps/server/tests/integration/sync-announcements.test.ts`, not run on my side.
  - The snapshot carries an HQ announcement, and opening it on the phone marks it read.
  - A teacher's acknowledgement from the phone is refused; the head's is applied, and it then
    shows as acknowledged.

## Your checklist
1. Unzip `emis-phase-9c.zip` over the project.
2. Run `npm test`.
   - [ ] All tests pass, including `sync-announcements.test.ts`.
3. Restart the server (`npm run dev`).
4. Restart the phone app. Its code changed, so run:
   ```powershell
   npm run mobile:clear
   ```
5. As **debs.lusaka@ministry.example** on the website, post an announcement to **all staff**,
   asking for an acknowledgement.
6. On the phone, signed in as **teacher@cranes.example**, pull down on Home to sync.
   - [ ] The **Announcements** card shows 1.
   - [ ] **More → Announcements** lists it with a blue dot.
7. Turn on **airplane mode** and open it.
   - [ ] The message shows; the dot goes.
   - [ ] **Sync** shows "Announcement opened" waiting.
8. Turn airplane mode off and sync.
   - [ ] On the website, the DEBS's announcement page shows Cranes as **opened**.
9. Sign the phone in as **head@cranes.example**, or the deputy, and sync. Open the
   announcement → **Acknowledge for the school**.
   - [ ] It shows "Acknowledged" after the sync.
   - [ ] The DEBS sees Cranes as **acknowledged**, by the head.
10. As the DEBS, withdraw it, then sync the phone.
    - [ ] It shows **Withdrawn** with the reason.
11. Post one with a PDF attached.
    - [ ] The phone lists the file name and says to open it on the website.

## Commit
```powershell
git add -A
```
```powershell
git commit -m "Phase 9c: announcements on the teacher phone app"
```
```powershell
git push
```
