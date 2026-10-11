# School Management System

One API server and one database for every level of the education system: schools today,
DEBS and PEO offices next. Each level gets its own app; all of them use the same server.

```
schoolmanagement/
├─ apps/
│  ├─ server/     the API: every /api route, business logic, database (Express + Prisma)
│  └─ school/     the school app: admin, teacher and HOD screens (Next.js)
│                 (apps/office/ for DEBS + PEO comes in a later phase)
├─ packages/
│  ├─ shared/     code server and screens both use: roles, grading rules, formatting, report-card PDFs
│  └─ ui/         building blocks for every app's screens: buttons, dialogs, tables, sidebar
├─ server.js      production: runs the API + school app together on one port
├─ CLAUDE.md      the binding coding rules — read before changing code
└─ docs/          background docs (docs/README.md: what's current); docs/phases/: per-phase checklists
```

## First-time setup (on your computer)

You need Node.js 20 or newer and PostgreSQL.

1. Install everything (run at the repo root, once):
   ```
   npm install
   ```
2. Create the server's settings file: copy `apps/server/.env.example` to `apps/server/.env` and fill in
   `DATABASE_URL` and `JWT_SECRET`. (If you had a `.env` at the old project root, its contents go here.)
3. Create the database tables and the Prisma client:
   ```
   npm run db:migrate:deploy
   ```
4. Optional, for a fresh **local** database: add demo data with `npm run db:seed`. It prints the
   demo accounts' password once (or uses `SEED_DEMO_PASSWORD` from `apps/server/.env`), and the
   accounts must change it at first login. It refuses to run against a non-local database.

## Every day

| What | Command (repo root) |
|---|---|
| Run everything for development | `npm run dev` → open http://localhost:3000 (the API runs on :4000) |
| Run only the API / only the screens | `npm run dev:server` / `npm run dev:school` |
| Run the tests | `npm test` (needs `apps/server/.env.test`, see below) |
| Check types / lint | `npm run typecheck` / `npm run lint` |
| New database change | edit `apps/server/prisma/schema.prisma`, then `npm run db:migrate` |

**Tests** use their own database, which they wipe between tests. Copy `apps/server/.env.test.example` to
`apps/server/.env.test` and point it at a database whose name ends in `_test`.

## Production

### One program, one port (recommended; same as before)

This is how the host already runs the app: one `node server.js` behind Passenger/Plesk.

```
npm ci
npm run db:migrate:deploy
npm run build
npm start            # = node server.js, listens on $PORT (default 3000)
```

`server.js` answers `/api/*` and `/uploads/*` itself and passes everything else to the school app.
Settings come from `apps/server/.env`. Set `UPLOADS_DIR` to a folder outside the code (so a redeploy
can't wipe the school logo); the default is `apps/server/uploads`.

### Two programs (optional)

The API (`npm start -w @school/server`, port 4000) and the school app (`npm start -w @school/school`,
port 3000) can also run separately. In that case:
- build the school app with `API_URL` set to the server's address;
- put nginx (or similar) in front of the school app so it sets `X-Forwarded-For`. The login rate
  limiter needs the real visitor IP, and the school app's pass-through doesn't add it.

## Before any live deployment

- Back up the database (`pg_dump`) before every deploy; deploy into a new folder and switch the
  host over, so rolling back is just switching back.
- Set `UPLOADS_DIR` outside the code folder.
- Never run `npm run db:seed` against a live database (it refuses unless `SEED_ALLOW_REMOTE=true`).
- If any database was ever seeded with the old demo accounts (`admin@school.gov.zm`, …), change
  or deactivate them — their old passwords are written in earlier versions of the code.
