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
| **phases/** | What each restructuring phase changed and how to test it; [applying-phases-1-2.md](phases/applying-phases-1-2.md) — how to apply them to a fresh clone |
| **research/** | [reporting-research-2026-10.md](research/reporting-research-2026-10.md) — what is known about school → DEBS → PEO → HQ reporting, including the five Ministry documents (sources, forms, design impact, open questions); the two handover briefs |
| [backlog.md](backlog.md) | Improvement ideas collected from old TODO cards |

## archive/

Session notes, finished plans, progress reports and one-off audits from earlier work, kept for
history only. Don't follow instructions in them without checking the current code; much of what
they describe has since been fixed, renamed or removed.
