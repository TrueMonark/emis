# Docs

The rules for changing code are in [`/CLAUDE.md`](../CLAUDE.md) (binding). How to install, run and
deploy is in [`/README.md`](../README.md). This folder holds the background.

**Note on older docs:** everything here was written before the October 2026 move to the
`apps/` + `packages/` layout. Paths like `app/api/...`, `lib/...` or `components/ui/...` now live
under `apps/server/src/`, `apps/school/` or `packages/ui/src/`. The rules and domain knowledge
still hold; trust `CLAUDE.md` for paths.

## Living documents

| Document | What it explains |
|---|---|
| [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) | What the system does, in brief |
| [ARCHITECTURAL_ANALYSIS.md](ARCHITECTURAL_ANALYSIS.md) | The audit `CLAUDE.md` was derived from |
| [deployment-options.md](deployment-options.md) | Hosting options considered |
| **domain/** | |
| [GRADING_SYSTEMS.md](domain/GRADING_SYSTEMS.md) | ECZ grading rules as implemented |
| [Subject Orientation.md](domain/Subject%20Orientation.md) | How subjects, grades and classes relate |
| [ROLE_HIERARCHY_SYSTEM.md](domain/ROLE_HIERARCHY_SYSTEM.md) | Roles, HOD as a position |
| [REPORT_CARD_PDF.md](domain/REPORT_CARD_PDF.md) | Report-card PDF generation |
| [EDGE_CASES.md](domain/EDGE_CASES.md) | Known edge cases to keep handling |
| **timetable/** | Timetable generation: spec, solver settings, double-period patterns, how-to |
| **integrations/** | [SMS_INTEGRATION.md](integrations/SMS_INTEGRATION.md) — SMS providers |
| **phases/** | What each restructuring phase changed and how to test it; [applying-phases-1-2.md](phases/applying-phases-1-2.md) — setting up on Windows and pushing to your own GitHub; [one-time-passwords-checklist.md](phases/one-time-passwords-checklist.md) — random one-time passwords and the forced password change; [branding-checklist.md](phases/branding-checklist.md) — school name and Monark Devs branding; [phase-3a-checklist.md](phases/phase-3a-checklist.md) — many schools in one database; [teacher-fixes-checklist.md](phases/teacher-fixes-checklist.md) — teacher screen fixes and handing over the class register; [phase-3b-checklist.md](phases/phase-3b-checklist.md) — year levels per school, national subject catalogue and pathways, learner numbers; [phase-3c-checklist.md](phases/phase-3c-checklist.md) — offline-ready data (versions, change log, teacher scope); [phase-4a-checklist.md](phases/phase-4a-checklist.md) — education offices, the account chain, school setup wizard, audit log; [phase-4b-checklist.md](phases/phase-4b-checklist.md) — "Forgot password?" requests, signing in with a mobile number, transfers, former staff; [phase-5-checklist.md](phases/phase-5-checklist.md) — weekend classes and the phone sync API; [phase-5b-checklist.md](phases/phase-5b-checklist.md) — public holidays, school closures and marks history; [school-fees-checklist.md](phases/school-fees-checklist.md) — school fees for private schools, finance staff, receipts and money reports; [phase-6-checklist.md](phases/phase-6-checklist.md) — the teacher phone app (Expo Go, offline registers, marks, PIN); [demo-school-seed.md](phases/demo-school-seed.md) — wiping the database and seeding the Cranes demo |
| **research/** | [reporting-research-2026-10.md](research/reporting-research-2026-10.md) — what is known about school → DEBS → PEO → HQ reporting, including the five Ministry documents (sources, forms, design impact, open questions); the two handover briefs |
| **design/** | [phase-3-foundation.md](design/phase-3-foundation.md) — draft design for many schools, year levels, learner numbers and offline-ready data; [sync-api.md](design/sync-api.md) — the phone sync API (snapshot, changes, push) |
| [backlog.md](backlog.md) | Improvement ideas collected from old TODO cards |

## archive/

Session notes, finished plans, progress reports and one-off audits from earlier work, kept for
history only. Don't follow instructions in them without checking the current code; much of what
they describe has since been fixed, renamed or removed.
