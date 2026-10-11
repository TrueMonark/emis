# @school/shared

Code that both the API server (`apps/server`) and the screens (`apps/school`, later `apps/office`)
need, so it exists exactly once:

| Folder | What |
|---|---|
| `auth/role-hierarchy.ts` | Role order and role → permission map |
| `grading/` | ECZ grading rules |
| `settings/academic-policy.ts` | Academic policy defaults |
| `report-cards/` | Report-card PDF templates and attendance label |
| `services/performance-calculator-pure.ts` | Pure performance maths (no database) |
| `config/` | Subject validation config |
| `types/` | Prisma enum re-exports and shared API types |
| `format.ts` | Display helpers (teacher label, class label, error message) |

Rules: nothing here may touch the database, `process.env`, or the browser — it must run
unchanged on both sides. Import it as `@school/shared/<path>`, e.g.
`import { calculateECZGrade } from "@school/shared/grading/ecz-grading-system"`.
