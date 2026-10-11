# Applying Phases 1 and 2 (starting from a fresh clone)

The zip holds the **whole project** after Phase 1, Phase 2 and the follow-up fixes. You start from
a plain clone of your repository with nothing set up, so you **replace** the repository's contents
with the zip's. There's nothing to migrate and nothing live to worry about.

## 1. Put the new layout into your repository
In a terminal, in your cloned repository folder:
```
git checkout -b restructure
git rm -r -q .
```
`git rm -r .` removes every tracked file from the working folder. The old version stays in git's
history, so nothing is lost. Then:

1. If there are `node_modules` or `.next` folders left over, delete them.
2. Open the zip. It contains one folder, `schoolmanagement/`. Copy **everything inside it** (not the
   folder itself) into your repository folder, next to `.git`. You should see `apps/`,
   `packages/`, `docs/`, `scripts/`, `server.js`, `package.json`, `README.md`, `CLAUDE.md`, and
   `.gitignore` (a hidden file).

## 2. Set it up
1. Install Node.js 20+ and PostgreSQL if you haven't.
2. Create two empty databases, e.g. `school_dev` (to use) and `school_test` (for the tests; the
   name must end in `_test`, and the tests wipe it).
3. Copy `apps/server/.env.example` to **`apps/server/.env`**:
   - set `DATABASE_URL` to `school_dev`;
   - set `JWT_SECRET` to a long random string.
4. Copy `apps/server/.env.test.example` to **`apps/server/.env.test`**, with `DATABASE_URL` set to
   `school_test`.
5. Run, at the repository root:
   ```
   npm install
   npm run db:migrate:deploy
   npm run db:seed
   ```
   The seed prints a demo password. Note it down; the demo accounts must change it at first login.

## 3. Check it
```
npm run typecheck
npm test
```
`npm test` should report **50 files, 297 tests passed**. Then run `npm run dev`, open
http://localhost:3000, log in as `admin@school.gov.zm` with the printed password, and work through
`docs/phases/phase-1-checklist.md` and `docs/phases/phase-2-checklist.md`.

## 4. Commit
```
git add -A
git commit -m "Restructure into apps/server, apps/school, packages/shared, packages/ui (phases 1-2)"
git push -u origin restructure
```
`git status` before committing will show many "renamed" lines; that's expected. Merge `restructure`
into your main branch when you're happy.

Deployment to a live server comes later. The rules for it are in `README.md` ("Before any live
deployment").
