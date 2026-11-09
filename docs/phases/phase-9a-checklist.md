# Phase 9a: the office pages' new look and statistics overview — what changed and how to test it

Built 4 November 2026. **No database changes.** Only the screens of the DEBS, PEO and HQ pages
changed. School pages look exactly as before.

## What changed, in plain words
- **Bright by default.** The office pages now open in light mode. They used to open in dark
  mode, and that choice was shared with the school pages.
  - The office now remembers its own choice, separately from the school pages.
  - Dark mode still has matching flag colours.
- **Zambian flag colours, used as touches:**
  - a thin flag stripe (green, red, black, orange) across the top of every office page and
    under the sidebar header;
  - green buttons, links, focus rings and active menu items, where it used to be blue;
  - a thin coloured line along the top of each figure tile.

  The colours are kept to accents, never big coloured blocks.
- **Overview is now a statistics page**, with figures for the last 30 days:
  - four headline figures: **learners** (with % girls and number of schools), **teachers**
    (with learners per teacher), **attendance**, and **registers taken**;
  - **Learners by school / district / province**: the 10 largest, as bars. Hover for % girls
    and learners per teacher.
  - **Registers taken, lowest first**: bars with a dashed line at 80%.
  - **Needs attention**: schools (or districts) with registers below 80%, attendance below
    85%, facilities not given, or setup not finished. Each line opens that school or
    district.
  - **Open returns**: for a DEBS, how many are waiting for you to check, and how many aren't
    submitted yet.
  - **Circulars to acknowledge**: how many school acknowledgements are still outstanding.
  - **Schools**, and how many are still in setup.
  - Every tile and bar links to the page with the detail.
- **School profiles** uses the same figure tiles.
- The old "What your office does here" list is gone from the Overview.

## Verified on my side
- Type check of the school app: clean. ESLint on the changed files: clean.

## Your checklist
1. Unzip `emis-phase-9a.zip` over the project. Delete `apps\school\.next`, then run
   `npm run dev`.
2. Sign in as **debs.lusaka@ministry.example**.
   - [ ] The pages are light, with a thin green/red/black/orange stripe at the top and under the
     sidebar header.
   - [ ] The active menu item and the buttons are green.
3. **Overview:**
   - [ ] Four figure tiles, each with a thin coloured top line.
   - [ ] Two bar lists, with values beside the bars.
   - [ ] "Needs attention", "Open returns" and "Circulars to acknowledge".
   - [ ] Clicking Cranes in a bar list opens its school page.
   - [ ] Hovering a bar shows the extra figures.
4. Sign in as **peo.lusaka@ministry.example**, then **hq@ministry.example**.
   - [ ] The bars are per district (PEO) and per province (HQ). Clicking one opens it on
     School profiles.
5. Open a dialog, e.g. **Returns → Open a return**.
   - [ ] Its button is green too.
6. Sign in as **head@cranes.example**.
   - [ ] The school pages look as before. They aren't green, and they keep their own light/dark
     choice.
7. On a phone (or a narrow window):
   - [ ] The tiles stack, and nothing is cut off.

Send me anything that doesn't look right, ideally with a screenshot: colours too strong or too
weak, or a figure that seems wrong.
