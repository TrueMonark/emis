# Branding: school name in the sidebar, Monark Devs everywhere it belongs

Built 12 October 2026. **No database change.** One new read-only API route,
`GET /api/school/identity`, which any signed-in person can call to get the school's name.

## What changed
- **Sidebar, top left** (admin, deputy, teacher and HOD screens):
  - the Monark Devs crown logo;
  - the **name of the school** from Settings → School Info, or "School name not set" if it's
    empty;
  - "Monark Devs" underneath.

  A long school name is cut off with "…", and hovering over it shows the full name.
- **Sign-in page, Choose your own password page, Forgot password page:** the logo, "Powered by
  Monark Devs" and "© 2026 Monark Devs, Zambia" at the bottom.
- **Browser tab:** the title is "EMIS · Monark Devs", and the tab icon is the crown.
- **Spelling:** the old "Monarch Devs" (with an h) is replaced everywhere by **Monark Devs**.

Already verified on my side: all automated tests pass (52 files, 306 tests), plus screenshots of
the sign-in page and the admin sidebar.

## Your checklist (no `npm test` needed)
Unzip, then `npm run dev`, and open http://localhost:3000.

- [ ] The browser tab shows the crown icon and "EMIS · Monark Devs". If the old icon is still
      there, press Ctrl+F5 to clear the cached one.
- [ ] Sign-in page: the crown logo and "Powered by Monark Devs / © 2026 Monark Devs, Zambia" are
      under the sign-in box.
- [ ] Sign in as admin. Top left of the sidebar shows the crown, then your school's name, then
      "Monark Devs".
- [ ] Settings → School Info: change the school name and save, then reload the page. The
      sidebar shows the new name.
- [ ] Clear the school name, save and reload. The sidebar shows "School name not set". Put the
      name back.
- [ ] Sign in as a teacher (or HOD). The same header shows the same school name.
- [ ] Collapse the sidebar (hover over the header, then click the toggle). Only the crown shows,
      with no broken image.
- [ ] Choose your own password page and Forgot password page: the Monark Devs credit is at the
      bottom.

Tell me which items pass or fail (and what you see for a failure), and I'll go on or fix it.
