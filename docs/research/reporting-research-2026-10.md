# Reporting research — school → DEBS → PEO → HQ (first pass, 11 October 2026)

Follows the brief in [`handover-reporting-brief.md`](handover-reporting-brief.md). Every statement is
labelled:

- **[Confirmed]** — stated in a source I opened, with the page/section.
- **[Inferred]** — a reasonable reading of confirmed facts, not stated outright.
- **[Proposed]** — a software design suggestion, not official.
- **[Unverified]** — a lead from the brief or a search title I could not open.

## 0. Limits of this pass (read first)

- **The Ministry's own website blocks automated reading of its PDF files** (`edu.gov.zm/wp-content/...`
  returns "robots disallowed"). Its web pages load, but not the documents. So I could **not** open any of
  the Ministry PDFs in the brief: the Education Statistics Bulletins, the ZEEP manual, the National
  Education Policy 2025 or the Strategic Plan. I did not try to get around this. Search results confirm
  that those files exist (titles and links are in §A), but nothing below relies on their contents.
- **The quickest way to fill the biggest gaps:** download those PDFs in your browser and attach them
  (list in §H, item 1). I can then read them directly and update this file.
- **No blank Annual School Census form was found anywhere public.** It is referred to by name, but
  the form itself isn't published online.

## A. Source register

| # | Source (issuer, date) | Where | Opened? | What it proves | What it does not prove |
|---|---|---|---|---|---|
| S1 | *School Profile* guidance, Ministry of General Education (no date shown; hosted by UNICEF, 2018) | [unicef.org](https://www.unicef.org/sites/default/files/2018-08/Guidance_School%20Profile.pdf) | Yes (no page numbers in document) | Each school submits an **Annual School Census (ASC) form** to the Ministry every year; the School Profile sent back to schools is built from it; the data categories (see §B-F1). Schools discuss the profile with ZICs and DEBS. | The ASC route via DEBS/PEO; who signs; the form's actual fields and codes |
| S2 | *Zambia 2024–2029 Partnership Compact*, Ministry of Education / GPE (2024) | [globalpartnership.org](https://www.globalpartnership.org/node/document/download?file=document/file/2024-10-zambia-partnership-compact.pdf) | Yes | EMIS "still manual and generates reports that are neither timely nor reliable" (p.10); ASC tool being revised and digitised (p.26); interim data-collection tool July 2023, provincial and district statisticians trained August 2023 (p.35, Annex 2); unique school coding system planned (pp.35–36); learner-level data target ECE–Grade 5 (p.30); Directorate of Planning and Information runs data collection (p.18); TMIS named (p.iii) | DEBS/PEO roles in the data flow (not described) |
| S3 | World Bank, *ZEEP Project Appraisal Document* PAD1859 (2017) | [worldbank.org](https://documents1.worldbank.org/curated/en/900661504231269364/pdf/ZAMBIA-EDUCATION-PAD-08102017.pdf) | Yes (annexes cut off) | A **"Lesson Observation Form"** is an existing Ministry instrument (para 31); Directorate of Planning and Information owns M&E (paras 60–61); EMIS upgrade and school GPS mapping (para 40) | Contents of the Lesson Observation Form; census procedure |
| S4 | World Bank, *ZEEP Additional Financing* (2020) | [worldbank.org](https://documents1.worldbank.org/curated/en/613441588692336203/pdf/Zambia-Education-Enhancement-Project-Additional-Financing.pdf) | Yes (truncated) | Planned teacher database via a **teacher census** (para 35c); digital monitoring of learner and teacher attendance (para 20); Teacher Portal (para 31) | That these are live national systems today |
| S5 | *Revised Standards and Evaluation Guidelines*, MESVTEE (c. 2015; copy hosted by LATAZ, unofficial) | [lataz.org.zm](https://lataz.org.zm/wp-content/uploads/2024/02/Standards-and-Evaluation-Guidelines-9th-April-2015.pdf) | Partly (cover and appendices not readable) | Education Standards Officers (ESOs) inspect schools and can inspect and copy records (§8.3); they report to the Minister annually, semi-annually and quarterly (§8.2.14); an **inspection report** is required for school registration and licence renewal (p.41); a general inspection report plus a **mandatory head-teacher hand-over form** are needed when a head changes (p.42); Appendix A "Inspection" and Appendix D "Annual Performance Appraisal System Form" exist | The inspection instrument's fields (Appendix A unreadable); current edition |
| S6 | JICA, *Basic Education Sector Analysis Report – Zambia* (2012) | [jica.go.jp](https://openjicareport.jica.go.jp/pdf/12083192.pdf) | Yes (partial) | Inspection results pass **school → District Education Standards Officer → Provincial Education Standards Officer** (pp.27–28); PEO and DEBS handle local administration (p.10) | The census process (not described) |
| S7 | Mooya & Mulenga, *ESOs' supervision roles… Choma District*, MJLSSE vol. 4 no. 1, pp.90–111 | [unza.zm](https://conferences.unza.zm/index.php/mjlsse/article/download/603/524) | Yes | What ESOs check: **schemes of work, lesson plans, records of work, attendance registers, teaching files, school log book** (pp.91, 94, 99, 102); visits about once per term at best, often unannounced (p.97); senior ESOs "write to the DEBs" before visiting (p.99); cites the 2015 Guidelines (p.98) | Official forms (researchers only mention "inspection instruments") |
| S8 | Mulenga & Mooya, *Curriculum implementation strategies of ESOs in Choma*, ZJEMAL vol. 2 no. 1 | [unza.zm](https://education.unza.zm/index.php/ZJEMAL/article/download/700/587) | Yes | Feedback is mostly verbal; follow-up visits are rare (pp.11–14) | — |
| S9 | USAID Education Data activity (DevTech, March 2022) | [devtechsys.com](https://devtechsys.com/insights/2022/03/24/usaid-education-data-activity-understanding-the-complexity-of-language-of-instruction-in-zambia/) | Yes | "An **EMIS number** is a unique identifier of a school"; duplicated or missing EMIS numbers exist in headquarters databases, and such schools can miss Ministry support | — |
| S10 | IGC policy brief, T. Walter (Nov 2019) | [theigc.org](https://www.theigc.org/publications/reducing-school-staffing-imbalances-and-wasteful-government-spending-zambia) | Yes | EMIS and payroll are separate systems; **61% of teachers were not at the school their payroll record shows** | — |
| S11–S19 | Ministry PDFs: Education Statistics Bulletins 2009–2025, ZEEP PIM 2024 **and a newer ZEEP PIM 2026** (`/2026/06/ZEEP-PIM_Final-2026.pdf`), National Education Policy 2025, Strategic Plan | edu.gov.zm (links in the brief) | **No** — site blocks automated reading | Only that they exist (search listings) | Anything about their contents |

## B. Forms and returns inventory

| ID | Name (as found) | From → to | Frequency | What it holds | Status | Digitalisation note |
|---|---|---|---|---|---|---|
| F1 | **Annual School Census (ASC) form** | School → Ministry (S1). Via DEBS/PEO: **[Unverified]**, though trained district and provincial statisticians (S2) make it likely **[Inferred]** | Annual (S1) | From S1's profile sections: enrolment by grade and sex; age of new Grade 1 entrants; ECE experience; vulnerable children, orphans, non-Zambians, refugees, special educational needs; repeaters; dropouts by grade and reasons by sex; teachers; classrooms, desks, toilets; water and electricity; textbooks by grade and subject | **Official**; blank form **not public**; tool being redesigned (S2) | Most learner-side counts can be computed from records this system already holds (see §D). Wait for the real form before making a replica |
| F2 | **School Profile** | Ministry → school (and community notice board; discussed with ZICs/DEBS) | After each ASC (S1) | Exam results vs district/province/national; the F1 indicators vs national standards; summary for school planning | **Official** (undated) | A natural first DEBS/PEO screen: same indicators, computed live **[Proposed]** |
| F3 | **Lesson Observation Form** | ESO → (school / district) | Per visit | Not seen | Official name confirmed (S3); **contents unverified** | Needs a copy of the form |
| F4 | **Inspection report** (Standards and Evaluation) | ESO → head teacher; route DESO → PESO (S6) | Per inspection; ESOs report to the Minister annually, semi-annually and quarterly (S5) | Not seen (Appendix A) | Official (S5, S6); **fields unverified** | Visit record as a dated event with findings, actions, follow-up (the brief's model) **[Proposed]** |
| F5 | **Head-teacher hand-over / take-over form** | Outgoing → incoming head (with ESO inspection) | On change of head | Not seen | Official, "mandatory" (S5 p.42) | Later |
| F6 | **Annual Performance Appraisal System (APAS) form** | Teacher / supervisor | Annual | Not seen | Official name (S5 Appendix D) | Later; HR-sensitive |
| F7 | **Teacher Monitoring Report form** | — | — | Fields listed in the brief §6 | **[Unverified]**: in ZEEP PIM, not opened; **project-specific** unless shown otherwise | Don't build until checked against the PIM |
| F8 | School records ESOs inspect: schemes of work, lesson plans, records of work, attendance registers, teaching files, log book | Kept at school | Ongoing | — | **Confirmed in practice** (S7) | Attendance registers and lesson logs already exist in this system; a visit checklist could point at them **[Proposed]** |
| F9 | ECZ examination results | ECZ → schools/Ministry (not a school return) | Per exam | Divisions by sex and subject | Confirmed source (S1) | Import, don't re-enter **[Proposed]** |

## C. Reporting matrix (what we know so far)

| Data | At school | District (DEBS / DESO) | Province (PEO / PESO) | HQ |
|---|---|---|---|---|
| Census (ASC) | Completes the form, annually (S1) **[Confirmed]** | District statisticians exist and were trained in 2023 (S2), so district handling is likely **[Inferred]** | Provincial statisticians, same (S2) **[Inferred]** | Directorate of Planning and Information collects, cleans and publishes the Statistics Bulletin (S2 pp.18, 35) **[Confirmed]** |
| What comes back down | School Profile, discussed with ZICs/DEBS (S1) **[Confirmed]** | Compares schools to district averages (S1 charts) **[Confirmed]** | — | — |
| Inspection | Records inspected; mostly verbal feedback (S7, S8) **[Confirmed]** | DESO receives results (S6) **[Confirmed]**; notified by province before senior visits (S7) | PESO receives from DESO (S6) **[Confirmed]** | ESO reports to the Minister: annual, semi-annual, quarterly (S5) **[Confirmed]** |
| Teacher posting data | — | Some districts recruit teachers (S4 para 34) | — | EMIS and payroll held separately; they disagree badly (S10) **[Confirmed]**; teacher census and TMIS planned (S2, S4) |
| Learner-level data | Kept at school | — | — | Target: learner-level data for ECE–Grade 5 (S2 p.30) — **a plan, not current practice** |

**Record-level or aggregates?** Every return found so far moves **aggregates** (counts and rates by grade
and sex) upward, not learners' names. That fits the agreed design rule: DEBS and PEO see figures, not
learner files **[Inferred from S1/S2]**.

**Zones:** "ZICs" appear in S1 alongside DEBS. Most likely these are Zonal In-service Coordinators, a
teacher-development role, not a reporting tier **[Inferred; unconfirmed]**. Don't model zones as a
mandatory level yet.

## D. What this means for the build

1. **[Proposed] School identity (Phase 3):** use the EMIS number as the school's ID, but don't trust it
   blindly (S9). It must be unique in our system, and the DEBS must be able to correct it, with the
   change logged. A school can be created as "EMIS number pending".
2. **[Proposed] School details to store** (all of them in the ASC/School Profile categories):
   - EMIS number, name, district, province
   - level (primary/secondary/combined)
   - ownership/agency (exact official category list to confirm from a Statistics Bulletin)
   - water source, electricity
   - counts of classrooms, desks and toilets
   - GPS coordinates (the Ministry is mapping these, S2/S3)
3. **[Confirmed in code] Many census counts already exist per learner** in this system:
   - grade and sex, from students and enrolments
   - orphans and orphan type, vulnerable children, special needs (`Student.vulnerability`, `orphanType`)
   - repeaters (`StudentPromotion = REPEATED`)
   - dropouts/withdrawals (`StudentStatus`, `EnrollmentStatus`)
   - teachers by sex and qualification

   **Missing:** age-at-entry checks, ECE experience, nationality/refugee status, dropout reasons by
   category, and school facilities.
4. **[Proposed] First DEBS/PEO screen = the "School Profile" indicators**, computed live for each school
   and compared with the district. It is a Ministry product people already recognise, and it uses only
   aggregates.
5. **[Proposed] Visits/inspections:** a dated visit record (officer, school, what was checked, findings,
   actions, due dates, follow-up status), kept separate from the teacher profile, as the brief asks.
   The research supports this. It also shows follow-up tracking is the weak point in practice (S8),
   which makes it the feature most likely to add value.
6. **[Proposed] Teacher posting:** our system knows where teachers actually teach, by timetable and
   attendance marking. A DEBS view of "teachers at post" answers a known national problem (S10).
7. **Not yet:** official replicas of any form (ASC, inspection, teacher monitoring) until we have the
   blank forms. Build from structured records, with printable outputs added once fields are verified.

## H. Open questions and what would unblock them

1. **Please download and attach** (from edu.gov.zm in your browser), in priority order:
   1. Education Statistics Bulletin 2025
   2. ZEEP PIM 2026 (and 2024)
   3. the full 2015 *Standards and Evaluation Guidelines*, including Appendix A
   4. National Education Policy 2025
   5. the Ministry Strategic Plan
2. **The blank Annual School Census form** (paper or Excel, latest year), most likely from the pilot
   school's head teacher or the DEBS office. This is the single most useful item.
3. **The Lesson Observation Form and the inspection report form** the DESO currently uses (a blank
   copy each).
4. **How the census is done today:** paper, Excel or the new digital tool? Which month or census day?
   Who at school fills it in, and who checks it at the DEBS office?
5. **What a DEBS actually wants on screen**: your planned deep dive with the offices. Bring §B-F2 (the
   School Profile) as a starting example.
6. **School ownership categories** and the official **province and district list** (for the Phase 3 seed
   data). The Statistics Bulletin is the likely source.
7. **Zones**: do DEBS offices organise schools into zones for reporting, or only for teacher
   development?
8. **Privacy:** confirm the "aggregates only above school level" rule with a DEBS officer, and ask
   whether any named-learner cases exist (transfers, welfare). This is still open from the first handover.
9. **Connectivity:** how reliable is internet at the schools and district offices you expect to use
   this? It affects whether returns need an offline mode later.

---

# Second pass — documents supplied by the developer (11 October 2026)

Five Ministry documents read in full (text extracted; the Secondary Program document is scanned,
so it was read by text recognition, which may have small errors). Labels as above.

## A2. New sources

| # | Source | What it proves |
|---|---|---|
| S20 | **Education Sector Digitalization Strategy**, MoE (Directorate of ICT, Data Management and Information), file dated 29 Jan 2026, v1. Aligned to the National Electronic Government Plan 2023–2026. | The Ministry itself names the "**lack of a school management information system**" (§2.2) and plans to "**Develop school management information system**" (K25,000,000, 2026) and an "**integrated EMIS**" (K75,000,000), with "data exchange protocols", integration of learning platforms "with EMIS and School Management Systems", "automated data capture" and digitised records for schools, DEBS, PEOs and HQ (Annex, Thematic Area 3). Ed-Assist (an Excel EMIS, 2003) was **discontinued in 2021**; the census is now "done manually … by district statistics officers and selected teachers"; "each school has been assigned an EMIS number" but the numbers "have not yet been fully integrated"; "**no unique learner identification number**" (§2.3). 4,951 of 13,487 schools (36%) had internet in 2024; 6,527,980 learners (§2.1). Roles: DEBS "report challenges and progress to the Provincial Education Office"; PEOs "consolidate reports" (§5.1.2). Legal basis: Data Protection Act 2021, Cyber Security and Cyber Crimes Act, ICT Act 2009, ECT Act 2009 (§5.2.2). |
| S21 | **National Education Policy 2025**, MoE | New structure **4-6-4-2**: 4 years ECCDE, **6 years primary**, 4 years secondary Ordinary Level, 2 years Advanced Level (§2.5.1). School categories: public, aided, community, private (Working Definitions). Current EMIS/PMIS (under ZEEP) "not fully multi-year or real-time" (§2.5.3). Decentralisation is "the major window" for managing education (§5.1). Legal list incl. **Data Protection Act No. 3 of 2021**, **Cyber Security Act No. 3 of 2025 and Cyber Crimes Act No. 4 of 2025**, Children's Code Act 2022, Persons with Disabilities Act 2012, ECZ Act 2023, Teaching Profession Act 2013 (§5.2). IFMIS to be rolled out "at all levels of education delivery" (§5.3). |
| S22 | **Guidelines for the Management of Secondary Schools in Zambia**, MoE Department of Secondary Education, 2026 | Secondary = **Forms 1–4 (Ordinary Level, 8 pathways)** and **Forms 5–6 (Advanced Level, 5 pathways, 3–4 subjects each; entry: school certificate with 3 credits in the area)** (§4.1.1). Lists every record a secondary school keeps (Chapter 3, see B2). Lesson observation schedules and records are a school-level duty (§5.2). The head teacher "report[s] to district/provincial authorities (e.g. DEBS)" — exam results, attendance, compliance reports, safeguarding matters (Annex 1 §§5, 6, 15). Supervision chain inside a school: Head → Deputy → HODs → Heads of Section → subject teachers (Annex 1 §8; §2.3.4). "Class teacher" is the term (§2.3.6). TEVETA trade test for eligible **Form 2** learners (§4.1.4). |
| S23 | **21st Century Secondary Education Program Document 2026–2030**, MoE Dept. of Secondary Education | Confirms "the transition from the Grade to the Form system" and O-level Form 1–4 / A-level Form 5–6; grant-aided schools "mainly run by Faith-Based Organisations"; private schools may run "international (Cambridge) or hybrid curricula" (§9). |
| S24 | **Education Act No. 23 of 2011** | Minister may create **education regions and districts "not necessarily coterminous" with provincial/district boundaries** (ss.6–7). The district director "consolidate[s] and submit[s] workplans and budgets" and "prepare[s] and submit[s] workplans and reports" **to the regional director**, who submits "regional budgets, workplans and reports to the Permanent Secretary" (ss.9, 11). Four categories: public, private, community, aided (s.13), each with its own register (ss.66, 79, 93). Education standards officers inspect, may "inspect and take copies of records", report annually to the Minister (ss.110–112). **s.128**: disclosing information obtained in the course of duties without the Minister's consent is an offence. **s.130(a)**: failing "to furnish any information required for purposes of this Act" is an offence. Still defines basic education as ECE–Grade 9 and high school as Grades 10–12 (s.2) — older than the 2025 policy. |

## B2. Records a secondary school must keep (S22, Chapter 3) — and whether this system holds them

| Record (as named) | In the system today? |
|---|---|
| Learner records; Learner Record Cards; Learner Vital Statistics | Yes (student profile; nationality not captured) |
| Class Registers (present/absent/late/sick) | Yes (attendance) |
| Report Forms | Yes (report cards) |
| Enrolment Register (admission, previous school, status) | Mostly (previous school not captured) |
| Transfer In/Out Forms | Partly (status only; no transfer form or clearance) |
| OVC Records; LSEND Records (incl. IEPs) | Partly (orphan/vulnerable/special-needs flags; no IEPs) |
| Re-entry Records | No |
| Medical Records | Free-text only (`medicalInfo`) |
| Disciplinary Records (Punishment Book); Commitment Form | No |
| Hostel Records | No |
| Examination Declaration / Anti-Riotous Commitment Forms | No |
| Staff: certificates, NRC, TCZ registration, vital statistics | Partly (profile; no NRC/TCZ number) |
| **Monthly Staff Returns**; **Staff Establishment** | No |
| Staff appraisal, leave, induction, individual work plan | No |
| Stock books, asset registers, inventories | No |
| Minutes (management, staff, board, PTC, finance…) | No |
| Lesson observation schedules and records (§5.2) | No |

## C2. Reporting chain — now confirmed

**School → DEBS (district) → PEO (province/region) → Permanent Secretary/HQ** is the **legal**
chain for workplans, budgets and reports (S24 ss.9, 11) and the **operational** chain for
digitalisation reporting (S20 §5.1.2) **[Confirmed]**. What travels upward at each step is
consolidated reports and figures, not individual learner files **[Confirmed for workplans/
reports; Inferred for statistics]**. Education offices can have boundaries that differ from the
administrative map (S24 ss.6–7) **[Confirmed]**.

## D2. What changes in the design

1. **This system answers a stated government plan.** S20 budgets a school management
   information system and an integrated EMIS, connected by data-exchange protocols. To be a
   credible candidate, the system has to:
   - export to and connect with EMIS (EMIS number on every school, documented data exports);
   - comply with the Data Protection Act;
   - be hostable on government infrastructure;
   - work where 64% of schools have no internet.

   **[Proposed]**
2. **Year levels must stop being a fixed Grade 1–12 list.** The country is moving to ECCDE (4) →
   primary (6) → O-level Forms 1–4 → A-level Forms 5–6, with pathways in secondary. Schools will
   be part-way through that change for years. Each school needs its own configurable year
   levels, each with:
   - a stage (ECE, primary, O-level, A-level);
   - a display name (Grade n or Form n);
   - an order;
   - optional pathways.

   This replaces today's global `Grade` table with its unique `GRADE_1…12` levels, in Phase 3.
   **[Proposed]**
3. **Education offices are their own tree**, not a copy of the administrative map: HQ → province
   (PEO; in law, "region") → district (DEBS). Seeded from the official office list. A school
   belongs to one district office. **[Proposed]**
4. **School categories** follow the Act: public, aided, community, private. Aided schools also
   record the agency, e.g. the church. **[Proposed]**
5. **A system-wide learner ID** (unique across all schools, carried on transfer) addresses the
   "no unique learner identification number" gap. It's ours, not a national ID, so it must be
   possible to link it to any future national ID. **[Proposed — decision needed]**
6. **Offline working** is needed before a national rollout (64% of schools offline). It's a
   separate, careful piece of work, because the earlier attempt failed (see `CLAUDE.md`). It
   comes after the account chain. **[Proposed — decision needed on timing]**
7. **Legal guardrails:** access to data must be authorised and logged (Act s.128); learner
   records stay at the school, with figures upward (unchanged); safeguarding and medical
   details are the most sensitive (Children's Code Act 2022). Before any national deployment,
   check registration duties under the Data Protection Act 2021 with the Data Protection
   Commissioner's office. **[Proposed; DPA registration duty Unverified]**
8. **New school-level records worth adding later** (from B2):
   - monthly staff returns and staff establishment, which feed DEBS staffing views
   - transfer in/out with clearance
   - re-entry records
   - disciplinary records
   - lesson observation records

   **[Proposed]**

## H2. Open questions — updated

Still open: **the blank Annual School Census form** (still the most useful single item); the
current inspection and lesson-observation forms; what a DEBS wants on screen. New:
- **The official list of education offices** (10 provincial offices and the district offices),
  with any where the education district differs from the administrative district.
- **The Grade → Form changeover timetable:** which year each level switches, so schools can run
  both side by side.
- **The 8 O-level and 5 A-level pathways' subject lists** (2023 Zambia Education Curriculum
  Framework, pp.25–27). Can you get this document?
- **Who to talk to:** S20 puts technical implementation with the Ministry's **Directorate of ICT
  (Data Management and Information)**, working with Smart Zambia Institute and the Electronic
  Government Division. That is the office whose plan this system would serve.
