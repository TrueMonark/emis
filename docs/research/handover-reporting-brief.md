# Handover: Research and Planning for a Zambia School Management System

**Prepared:** 10 October 2026  
**Purpose:** Transfer the project context, research questions, known source leads, and software-design direction to another AI assistant helping build a school management system for Zambia.

## 1. Project status and immediate goal

The project is at the groundwork stage. The developer has started mapping the education-office hierarchy and reporting flows but has **not yet properly started coding the relevant reporting modules**.

The next AI assistant should begin with research and requirements discovery—not immediate implementation. Find actual forms, reports, manuals, instructions, reporting frequencies, submission routes, and responsible roles. Do not assume that every plausible report is an official Ministry-prescribed return.

**Primary goal:** establish what information schools submit to DEBS, what DEBS consolidates for PEO, and what PEO submits to Ministry headquarters; then design a configurable digital workflow based on verified requirements.

## 2. Education administration hierarchy

Use this as a working model and verify terminology and variations against official sources:

1. **Ministry of Education headquarters (HQ):** national policy, oversight, analysis, and national aggregation.
2. **Provincial Education Office (PEO):** provincial coordination, review, and consolidation of district information.
3. **District Education Office / District Education Board Secretary (DEBS):** district coordination, review of school submissions, monitoring, and district consolidation.
4. **Schools:** maintain operational records and submit required returns and reports.
5. **Zones / zonal coordination:** may operate in practice; verify the role and reporting authority before modelling it as a formal mandatory tier.

The conceptual path is **School → DEBS → PEO → Ministry HQ**. This is a high-level model, not proof that every return follows the same route. Some programmes may use different channels or reporting paths.

## 3. Reporting areas already identified

### School → DEBS
Potential categories to investigate include:
- School identity and administrative details.
- Learner enrolment and related statistics.
- Teacher and staff information, establishment, and staffing levels.
- Infrastructure: classrooms, sanitation, water, and other facilities.
- Teaching and learning materials/resources.
- ICT infrastructure.
- Learner support and programme indicators where required.
- School monitoring, attendance, assessment, and performance information where required.

These are research leads, **not a verified complete list of mandatory returns**. Identify the actual instruments and what each collects.

### DEBS → PEO
Potential categories identified for investigation:
1. District education statistics or consolidated school census.
2. Teacher establishment, staffing, vacancies, and deployment.
3. School monitoring/inspection visit reports and follow-up actions.
4. District work plans, targets, budgets, and expenditure.
5. Infrastructure and resource needs.
6. Special programme implementation/progress reports.

These are **not confirmed official form names or an exhaustive list**. Verify exact names, required fields, frequency, sign-off route, and whether each is submitted as paper, spreadsheet, portal entry, or narrative report.

### PEO → HQ
Investigate how PEOs validate and consolidate district submissions, report provincial statistics and needs, and submit returns to HQ. Do not assume all district-level records travel upward individually; upper levels may receive aggregates or selected exceptions only.

## 4. Previously identified source leads

Begin with official Ministry of Education sources and confirm that links still work and documents are current. These links were identified in earlier discussion and must be opened and verified before citing details.

1. **Education Statistics Bulletin 2025**  
   https://www.edu.gov.zm/wp-content/uploads/2026/03/2025-ESB-.pdf  
   Use for published statistics, definitions, and data categories. A bulletin is not the same as the blank questionnaire used to collect its data.

2. **Education Statistics Bulletin 2022**  
   https://www.edu.gov.zm/wp-content/uploads/2024/11/Eduaction-Statistics-Bulletin-2022_20_11_2024.pdf  
   Previously identified as useful for the data-aggregation path school → DEBS → PEO → HQ. Verify exact wording in the source.

3. **Ministry publications page**  
   https://www.edu.gov.zm/?page_id=195  
   Previously noted as listing items such as *Guidelines for Managing Secondary Schools* and a *Monitoring and Evaluation Book*. Locate the actual documents, editions, and relevant procedures/forms.

4. **Education Statistics Bulletin collection**  
   https://www.edu.gov.zm/?page_id=541  
   Compare editions and changes over time.

5. **Zambia Education Enhancement Project (ZEEP) Project Implementation Manual**  
   https://www.edu.gov.zm/wp-content/uploads/2024/09/ZEEP-PIM-23.08.24-final.pdf  
   Previously identified as containing a Teacher Monitoring Form and programme reporting guidance. Treat it as **project-specific** unless wider national use is corroborated.

6. **National Education Policy 2025**  
   https://www.edu.gov.zm/wp-content/uploads/2026/05/NATIONAL-EDUCATION-POLICY-2025.pdf  
   Use for policy context, not as proof that a specific reporting template exists.

7. **Ministry Strategic Plan**  
   https://www.edu.gov.zm/wp-content/uploads/2024/07/MOE-STARTEGIC-PLAN.pdf  
   Use to identify monitoring indicators, targets, and reporting responsibilities.

Prioritise official government sources. If a document cannot be opened, say so. Use unofficial mirrors only when necessary and label them clearly.

## 5. Highest-priority research: Annual School Census / EMIS

The 2025 Annual School Census questionnaire was previously described as the instrument used to collect school data, with submissions passing through DEBS and PEO to HQ. However, **a publicly downloadable blank copy of the complete questionnaire has not yet been confirmed**.

Research tasks:
- Find the exact name and latest edition of the Annual School Census questionnaire or EMIS collection instrument.
- Search for blank PDF, Word, or Excel forms; instructions; data dictionaries; calendars; and validation rules.
- Determine which fields are annual, continuously updated, or covered by separate programme returns.
- Establish the actual channel: paper, spreadsheet, web portal, EMIS, or a combination.
- Identify who completes, verifies, signs, submits, and approves each return.
- Check whether the instrument differs for primary, secondary, community, private, special, or other school types.
- If the blank form is not public, state that clearly and use the best available official evidence without inventing fields.

## 6. Teacher monitoring and school inspection

A Teacher Monitoring Report form was previously identified in the ZEEP manual. Reported fields included:
- Teacher name and sex.
- Registration number.
- Date of birth and retirement date.
- Qualifications and training.
- In-service training.
- First appointment and confirmation.
- School and district.
- Date of reporting to the current school.
- Appointment status.
- Additional responsibilities.

Verify these against the PDF and establish whether the form is project-only or more widely used. Research official teacher-monitoring, school-supervision, lesson-observation, inspection, attendance, professional-development, and follow-up forms.

Keep three concepts separate:
- **Teacher master profile:** stable personal/professional and appointment details.
- **Monitoring/observation event:** date, officer, school, evidence checked, findings, recommendations, agreed actions, deadlines, and follow-up.
- **Employment/establishment return:** staffing establishment, vacancies, deployment, and appointment status where applicable.

Do not conflate teacher employment records with the record of a monitoring visit.

## 7. Digitalisation approach

Do not merely attach scans of paper forms. Collect structured data once and reuse it in forms, reports, and dashboards.

Suggested progression:
1. Document the current paper/digital process.
2. Digitise verified forms accurately, preserving required wording, field names, codes, and signature requirements.
3. Auto-populate information already in the system, such as school profile, staff, learners, and classes.
4. Validate mandatory fields, allowed values, totals, dates, and cross-field consistency.
5. Generate printable PDFs or spreadsheets matching required returns where necessary.
6. Route submissions to the right officer with deadlines and visible status.
7. Aggregate verified submissions at district and provincial levels.
8. Provide dashboards and exception reports for missing, late, invalid, or unusual data.
9. Add audit logs, correction/resubmission history, and reporting-period locks where appropriate.

### Proposed workflow states
`Draft → Submitted → Under Review → Returned for Correction → Resubmitted → Approved`

These are proposed labels, **not confirmed official terminology**. Adjust them to match verified procedures. Record who submitted, reviewed, changed, returned, or approved each version and when.

### Suggested teacher-monitoring workflow
- Create/import the teacher profile once.
- An authorised officer records each monitoring or inspection visit as a separate dated event.
- Record what was checked, evidence, observations, recommendations, responsible person, target date, and follow-up status.
- Include teacher/headteacher acknowledgement only if the actual procedure calls for it.
- Preserve historical visits instead of overwriting the teacher profile with the latest visit.
- Report visit coverage, outstanding actions, recurring issues, and trends according to role permissions.

### Reporting architecture
Keep these separate:
- **Master data:** schools, offices, teachers, learners, subjects, classes, and organisational hierarchy.
- **Operational records:** attendance, assessments, visits, resources, staffing changes, and daily events.
- **Reporting-period submissions:** snapshots/returns for a term, year, or reporting cycle, including status and version history.
- **Report templates:** configurable field definitions, calculations, filters, groupings, and output formats.

Avoid one giant “school report” table. Generate reports from structured records and verified submission snapshots. Preserve historical submissions so they can be reproduced even after current records change.

## 8. Existing product context and preferences

Previously discussed product assumptions for the developer's Zambia-focused school management system:
- Use **“Class Teacher”**, not “Form Tutor”, for the teacher responsible for class attendance and learner welfare.
- In Grades 1–7, one teacher may teach most or all subjects; in Grades 8–12, subject teachers and streams become more common.
- Streaming starts at Grade 8 and Grade 10 and persists through the relevant progression. Do not assume free learner choice or annual reshuffling. Verify rules with the developer before implementation.
- Keep parent/guardian records separate from student records so one parent/guardian can link to multiple learners.
- Grades 10–12 may report an integrated subject such as SCI_PHY_CHEM while timetabling may need separate Physics and Chemistry periods. Confirm with the developer before coding.
- Role access should reflect responsibilities: teachers see only authorised classes/subjects; school leaders, DEBS, PEO, and HQ users get appropriately scoped views.
- Previously supplied UI palette: `#0052CC`, `#002B5B`, `#4C9AFF`, `#00A8A8`, `#F7F9FC`, `#E1E5EB`, `#333A45`.
- The wider software project may use Next.js, Prisma, and PostgreSQL. **Inspect the active repository, versions, schema, and architecture before proposing migrations or editing files.** Do not assume a folder or implementation structure without checking.

These are product assumptions, not Ministry policy. Preserve them unless the developer changes them or authoritative evidence requires a change.

## 9. Required research deliverables before coding

### A. Source register
For each source record title, issuing organisation, official URL, publication/revision date, document type, relevant pages/sections, current/superseded/project-specific status, what it proves, and what it does not prove.

### B. Forms and reports inventory
Create a table with:
- Document ID.
- Official name exactly as printed.
- Responsible office/role.
- Submitted by → submitted to.
- Purpose.
- Reporting frequency/deadline.
- Data fields and required breakdowns.
- Attachments/signatures.
- Review/approval steps.
- Output format and submission channel.
- Source URL and page number.
- Verification status: **Verified official / Official but current status unclear / Project-specific / Unverified research lead**.
- Digitalisation notes.

### C. End-to-end reporting matrix
Map data collected at school, reviewed by DEBS, consolidated by PEO, and submitted to HQ. Distinguish individual records from aggregates and show alternate paths if specific returns follow different routes.

### D. Teacher monitoring workflow
Document current procedures and exact official forms where found. Separate teacher profile data, visit observations, recommendations, and follow-up.

### E. Data dictionary and draft schema
After identifying requirements, propose entities, field definitions, data types, allowed values, relationships, validation rules, reporting period, provenance, and role-based access. Mark inferred fields as proposed, not official.

### F. Screen and permission plan
List screens for school users, headteachers, DEBS reviewers, PEO reviewers, and HQ users. Specify who can create, view, edit, return, approve, export, and view identifiable data.

### G. Phased implementation roadmap
Recommend this low-risk order:
1. Confirm school master data and organisational hierarchy.
2. Implement core school operational records already in scope.
3. Implement verified school-level forms/reports and printable exports.
4. Add submission tracking and audit logs.
5. Add DEBS review and district consolidation.
6. Add PEO review and provincial consolidation.
7. Add HQ aggregation only when requirements are verified.
8. Add analytics, exception reporting, and configurable templates.

For each phase, provide dependencies and acceptance criteria. Avoid implementing all offices at once.

### H. Open questions
Track unresolved matters, especially:
- Availability of the blank Annual School Census instrument.
- Exact current teacher monitoring and school inspection forms.
- Which reports are mandatory and how often.
- Official deadlines and approval hierarchy.
- Which data is record-level versus aggregated at each tier.
- Existing EMIS or other government-system integrations.
- Privacy, retention, access, and sharing rules for learner and teacher data.
- Offline operation, low-bandwidth support, and connectivity constraints.

## 10. Research and evidence standards

- Prioritise official Ministry of Education and other relevant Government of Zambia sources.
- Check for later revisions and use current sources as of the research date.
- Cite claims with exact page/section references wherever possible.
- Clearly label **confirmed facts**, **reasonable inferences**, **proposed software design**, and **unverified questions**.
- Never present a plausible report category as an official report name without evidence.
- A published statistics bulletin does not prove that its underlying blank questionnaire is publicly available.
- Do not treat a project-specific ZEEP form as nationally mandated without corroboration.
- Do not collect sensitive learner/teacher information at higher administrative levels unless a verified purpose and permission justify it.
- Do not start coding DEBS/PEO modules until the source register, reporting matrix, and open questions have been reviewed with the developer.

## 11. Instructions to the receiving AI assistant

You are assisting with a real school management system for Zambia. Your first task is **research and requirements discovery**, not immediate code generation.

1. Read this entire handover.
2. Verify the linked official documents and search for additional official forms, manuals, circulars, reporting calendars, and EMIS instructions.
3. Present findings incrementally, starting with primary sources and actual forms.
4. Maintain the inventory and mark verification status honestly.
5. Ask the developer only for decisions or access that cannot be established from reliable public sources.
6. After the developer approves requirements, inspect the actual repository and propose small, testable implementation steps.
7. Never claim a report or field is officially mandatory unless reliable evidence supports it.
8. Preserve existing product decisions unless explicitly changed.

**First task:** find and verify the latest Annual School Census questionnaire/data-collection instrument and official teacher monitoring/school inspection forms. Then map the documented **school → DEBS → PEO → HQ** reporting process, citing sources and page numbers.
