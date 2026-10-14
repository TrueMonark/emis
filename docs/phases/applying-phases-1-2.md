# Setting up the project on your computer (Windows) and putting it in your own GitHub

This is for a folder that holds the unzipped project, has had `npm install` run, and is **not yet
connected to any git repository**. Run every command in **PowerShell**, inside the project folder
(e.g. `C:\Users\you\Documents\projects\emis`). Lines starting with `#` are comments, so don't type
them.

## 0. Check the folder
```powershell
cd C:\Users\you\Documents\projects\emis
Test-Path .gitignore        # must say True
Test-Path .git              # should say False (no git yet)
dir                         # you should see apps, packages, docs, scripts, server.js, package.json, CLAUDE.md
```
If `.gitignore` says `False`, copy it again from the zip. It's what stops passwords and
`node_modules` from being uploaded.

## 1. Put it in your own GitHub repository
1. Check git is installed: `git --version`. If it isn't, install "Git for Windows" and reopen
   PowerShell.
2. First time on this computer only:
   ```powershell
   git config --global user.name  "Your Name"
   git config --global user.email "you@example.com"
   ```
3. On github.com, click **New repository**:
   - name it `emis`;
   - choose **Private**;
   - **don't** tick README, .gitignore or licence, so the repository stays empty.
4. Back in PowerShell:
   ```powershell
   git init
   git add -A
   git status                  # check: no ".env" files and no "node_modules" in the list
   git commit -m "EMIS: restructured project (phases 1-2)"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/emis.git
   git push -u origin main
   ```
   The push opens a browser window to sign in to GitHub the first time. Warnings like "LF will be
   replaced by CRLF" are harmless.

## 2. Install PostgreSQL and create two databases
1. Install PostgreSQL for Windows (the installer from postgresql.org). Keep port **5432**, and
   write down the password you choose for the `postgres` user. To keep things simple, use only
   letters and numbers, because `@ : / #` break the connection line below.
2. Start menu → **SQL Shell (psql)**. Press Enter at each prompt, type your password, then:
   ```sql
   CREATE DATABASE emis_dev;
   CREATE DATABASE emis_test;
   \q
   ```
   `emis_dev` is the one you use. `emis_test` is for the automatic tests; its name **must** end in
   `_test`, and the tests wipe it every time.

## 3. Create the settings files
```powershell
Copy-Item apps\server\.env.example      apps\server\.env
Copy-Item apps\server\.env.test.example apps\server\.env.test
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # prints a random secret; copy it
notepad apps\server\.env
```
In `apps\server\.env`, change the two required lines (replace `YOURPASSWORD` and the secret):
```
DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/emis_dev"
JWT_SECRET="paste-the-random-secret-here"
```
Save. Then run `notepad apps\server\.env.test` and set:
```
DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/emis_test"
```
Leave its `JWT_SECRET` line as it is. These two files stay on your computer only: git ignores them.

## 4. Create the tables and the demo data
```powershell
npm run db:migrate:deploy
npm run db:seed
```
The seed prints a **demo password** once. Write it down. The demo logins are
`admin@school.gov.zm`, `hod.math@school.gov.zm` and `teacher1@school.gov.zm`.

## 5. Check everything works
```powershell
npm run typecheck           # no errors
npm test                    # expect: 50 files, 297 tests passed (it sets up emis_test's tables itself)
npm run dev                 # leave this running
```
Open http://localhost:3000 and log in as `admin@school.gov.zm` with the printed password. Then
work through `docs/phases/phase-1-checklist.md` and `docs/phases/phase-2-checklist.md`. Press
`Ctrl+C` in PowerShell to stop.

## If something goes wrong
| Message | Meaning |
|---|---|
| `Can't reach database server at localhost:5432` | PostgreSQL isn't running: Start menu → Services → start "postgresql-x64-…" |
| `password authentication failed` | The password in `DATABASE_URL` doesn't match the one you chose when installing |
| `database "emis_dev" does not exist` | Step 2 was skipped, or the name in `.env` is different |
| `The table public.users does not exist` in the tests | Old copy of `apps/server/vitest.config.ts` / `tests/global-setup.ts`: get the update that prepares the test database |
| Tests refuse to start ("not a test database") | `.env.test` points at a database whose name doesn't end in `_test` |
| `JWT_SECRET` missing | `apps\server\.env` wasn't saved, or the line is commented out |

## About "20 vulnerabilities" after `npm install`
Those warnings come from libraries the project uses, not from your code. **Don't run
`npm audit fix --force`**: it upgrades libraries across major versions and can break the app. The
important one is Next.js, which needs a version update. That will come as a small, tested fix.
None of it is a risk while the app only runs on your own computer.

## Every day after this
```powershell
git pull                    # if you work on more than one computer
npm run dev
# … work …
git add -A
git commit -m "what you changed"
git push
```
Deployment to a live server comes later. The rules for it are in `README.md` ("Before any live
deployment").
