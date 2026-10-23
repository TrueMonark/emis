# Monark Edu teacher app (Phase 6)

Expo / React Native, for Android and iPhone. Offline first: registers, period attendance,
timetable, marks, lesson logs and special-class registers all work without signal and sync later
through the phone sync API (`docs/design/sync-api.md`).

- **Its own npm project** (not a workspace), so its React / React Native versions never clash
  with the web app's. Install with `npm run mobile:install` from the repo root.
- **Shared code:** `@school/shared/<path>` → `packages/shared/src/<path>.ts` (see
  `metro.config.js` and `tsconfig.json`). Only pure TypeScript from there (no server code).
- **Run:** `npm run mobile` from the repo root, then scan the QR code with Expo Go (same Wi-Fi as
  the laptop). On the sign-in screen the server address is the laptop's IP with port 4000. If the phone can't reach the laptop, `npm run mobile:tunnel`.
- **Check:** `npm run mobile:typecheck`.

## How it works
- `src/db.ts`: SQLite on the phone, with the server's rows (`records`), changes waiting to be
  sent (`outbox`, one sync operation each), how those changes look locally (`pending`), and the
  sync cursor and calendar (`meta`).
- `src/sync.ts`: push the outbox, then pull changes (or a snapshot). One at a time; runs on
  unlock, when signal returns, after every save, and from Sync now.
- `src/ops.ts`: every save checks the obvious rules (no register on a non-school day, no future
  dates, offline limit) and adds an operation. The server checks everything again.
- `src/session.tsx`: sign-in (email or mobile number), forced change of a one-time password, PIN
  (hashed in secure storage; locks after 2 minutes in the background; 5 wrong tries → password).
- Learners on the phone: name, gender, learner number and status only.
