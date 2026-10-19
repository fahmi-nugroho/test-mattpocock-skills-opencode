# Spec: Tidying the Booking and Permintaan Surfaces

Status: ready-for-agent

## Problem Statement

The owner works two admin forms and two admin lists by hand, and all four have outgrown their first version.

Both forms are one flat two-column grid, laid out in whatever order the fields happen to sit in storage. Rows therefore end in holes: the DP amount is stranded alone beside the full-width notes field, the status select opens a row by itself, the link form pads its date row with an invisible cell, and the Style radios — two short labels — occupy a full-width fieldset with nothing beside them. She is looking at a form that reads as unfinished rather than as a sequence of decisions, and the emptiness makes it slower to scan than a denser, grouped form would be.

Correcting a row is worse than filling one in. The inline row editors label nothing: each input carries a screen-reader name and no visible one, and only the Reference box carries a placeholder. Every edit row is populated by definition, so a placeholder would be invisible there anyway, and with no label above the box she has to infer which box is the date and which is the DP amount from the shape of the value inside it.

Both lists render every row ever recorded, and the dashboard stacks every section on one page, so the page grows without bound as the business records work. The Booking list is also ordered oldest-first, which puts today's job and this week's jobs below every piece of work the business has ever done; reaching them means scrolling past history, and the sections below — Blokir, Portfolio, Harga, Profil — recede further with every Booking accepted. The Permintaan list is unbounded from the newest end.

And the business has no name of its own online. The browser tab reads "Makeup Artist" on the landing page, on the dashboard, on the login page, and on a client's Format Booking link alike, so nothing distinguishes them and nothing names the business; the social description is the only English string in the app; and there is no icon at all, so a bookmarked or shared link shows a blank page glyph.

## Solution

Tidy the four surfaces the owner actually works, and give the business its name:

- **Group the two forms.** Each form's fields become labelled fieldsets — schedule, client, event and Style, payment and notes — each an internal two-column grid that fills its rows. No row ends in an empty cell because a spanning field can no longer strand its neighbour, and the Style radios move inside their group as chips instead of carrying a full-width fieldset of their own.
- **Label the edit rows.** Every inline row editor gains the visible label and the placeholder its counterpart on the create form already has, so a populated row is readable at a glance.
- **Move each list into a dialog.** The section keeps its create form and gains a summary line with a trigger; the dialog holds the attention badge, the refresh, the state chips, the search box, every row and every row action. The Booking dialog splits its rows into *Mendatang* and *Riwayat*, each capped at ten with a "Muat lebih banyak" step, so the section — and therefore the page — stops growing with the data. The dialog closes back to the trigger with focus returned to it.
- **Name the business.** "Wandana Makeup" becomes a single exported constant used by the browser title, the four visible brand lines, and the three Indonesian sentences that currently say "Makeup Artist"; the title gains a template so the dashboard and the login page have their own tabs and a client's Format Booking link has its own; the social description becomes Indonesian and names the business; and the app gets an icon: a serif W on the espresso tile.

The client-facing Format Booking form is untouched. It has no edit mode to label, its single column is the right shape for a phone, and its contract — what a client can send and when — is not in question here.

## User Stories

**Admin — the two forms**

1. As the admin, I want each form's fields grouped into labelled fieldsets, so that the form reads as a sequence of decisions rather than one long list.
2. As the admin, I want the slot fields together, so that date, start, and end are one glance instead of three stops.
3. As the admin, I want the client's name and number together, so that the pair I retype from a chat thread is one group.
4. As the admin, I want the event, the Headcount, the venue, the Style, and the Reference together, so that everything about the job itself is in one place.
5. As the admin, I want the total, the DP, the remaining balance, and the notes together, so that the money is not split across the form.
6. As the admin, I want no row to end in an empty cell, so that the form looks deliberate instead of half-filled.
7. As the admin, I want the Style radios to sit as chips inside their group, so that two short labels stop commanding a whole row.
8. As the admin, I want the link form to stop padding its date row with an invisible spacer, so that the date, start, and end read as one group too.
9. As the admin, I want both forms grouped the same way, so that I learn the shape once.
10. As the admin, I want the grouping to change nothing about the fields themselves, so that validation, the double-booking guard, the suggested total, and the remaining balance behave exactly as they did.
11. As the admin, I want the grouped form to work at 360px, so that I can record a Booking from my phone.

**Admin — correcting a row**

12. As the admin, I want a visible label above every box in an edit row, so that I can tell the date from the DP amount without decoding the value.
13. As the admin, I want those labels to name the fields the same way the create form does, so that the two surfaces do not teach me different words.
14. As the admin, I want the optional fields in an edit row to carry the same placeholders as the create form, so that a genuinely blank one reads as blank rather than as missing.
15. As the admin, I want the label wired to its input, so that clicking it focuses the box and a screen reader reads the same words I see.
16. As the admin, I want to keep editing in the row itself, so that fixing a typo is still as quick as reading it.
17. As the admin, I want the Style radios and the legacy read-only Style line to stay exactly as they are inside the edit row, so that the labelling work does not change what an edit can express.

**Admin — working the list from a dialog**

18. As the admin, I want the section to show a summary of what is in the list without rendering the list, so that I can see whether there is anything to do at a glance.
19. As the admin, I want that summary to count the upcoming Bookings and how many are still waiting, so that the number I act on is the one on the button.
20. As the admin, I want one trigger to open the full list, so that the section is short when I am not working it.
21. As the admin, I want the trigger to sit beside the create form, so that the flow I already use — accept a Booking Request, land on the form — is unchanged.
22. As the admin, I want the attention badge inside the dialog, so that the count and the rows it counts are never on two different screens.
23. As the admin, I want the refresh button inside the dialog, so that pulling in a request that arrived while the tab was open still works exactly as it did.
24. As the admin, I want the state chips inside the dialog, so that narrowing to what needs action is still one tap.
25. As the admin, I want the search box inside the dialog, so that finding a row by name, number, date, or note is unchanged.
26. As the admin, I want every row action to work inside the dialog exactly as it did in the list, so that nothing I could do before costs an extra step.
27. As the admin, I want "Jadikan Booking" inside the dialog to close it and prefill the form, so that accepting a request is still one tap and lands me where I write the Booking.
28. As the admin, I want a row's refusal or failure message to still appear in that row, so that the dialog does not swallow the reason it refused.
29. As the admin, I want the two-click delete confirmation to still work in the dialog, so that a stray tap still cannot destroy anything.
30. As the admin, I want an empty list and a search that matches nothing to keep their own distinct messages, so that I can tell "nothing yet" from "nothing matching".
31. As the admin, I want to close the dialog with Escape or by tapping outside it, so that dismissing it needs no aim.
32. As the admin, I want focus to land inside the dialog and return to the trigger on close, so that I can work it from the keyboard.
33. As the admin, I want the page behind the dialog to hold still, so that closing it leaves me where I was.
34. As the admin, I want the dialog to fit a phone, so that it is usable from anywhere I happen to be.

**Admin — a bounded list**

35. As the admin, I want the Booking dialog's rows split into *Mendatang* and *Riwayat*, so that today and this week are not mixed in with jobs from last year.
36. As the admin, I want *Mendatang* to start at today and read forward, so that the next job down is the next job due.
37. As the admin, I want *Riwayat* to read newest-first, so that the most recent past work is nearest.
38. As the admin, I want a booking dated today to count as upcoming, so that today's work is never filed as history.
39. As the admin, I want each group capped at ten rows with a "Muat lebih banyak" step, so that a busy year does not turn the dialog into the same endless scroll I opened it to escape.
40. As the admin, I want that step to tell me how many rows are still hidden, so that I know the size of what is behind it.
41. As the admin, I want the reveal to reset when I change the chip or the search text, so that a narrowed list always opens at a predictable size.
42. As the admin, I want the Permintaan dialog capped the same way over whatever the chip and the search currently match, so that the newest requests are not buried either.
43. As the admin, I want the rest of the dashboard reachable without scrolling past a list, so that Blokir, Portfolio, Harga and Profil stop receding as the business grows.

**The business's name and icon**

44. As the owner, I want the browser tab to say "Wandana Makeup", so that the business is named everywhere a client sees the site.
45. As the owner, I want the dashboard tab and the login tab to name themselves after the business, so that I can tell my own open tabs apart.
46. As the owner, I want a client's Format Booking tab to read "Format Booking", so that it is distinguishable from my dashboard when both are open.
47. As the owner, I want the business named once in the code, so that renaming it later is one edit rather than a hunt.
48. As the owner, I want the brand line above the heading on the landing page, the login page, and the Format Booking page to say the business's name, so that the site stops introducing itself generically.
49. As the owner, I want the client-facing sentences that currently say "Makeup Artist" to name the business, so that a client reading them is reading about the business rather than about a job title.
50. As the client, I want the description under a shared link to be in Indonesian and to name the business, so that a link preview reads like the site it opens.
51. As the client, I want an icon on the tab, so that the site is recognisable among a row of tabs and in my bookmarks.
52. As the client, I want that icon to be the business's initial, so that it is legible at tab size rather than a smudge.
53. As the client, I want the Format Booking form I fill in to be unchanged, so that the work on the admin side does not shift the page I was sent.

**Quality and safety**

54. As the artist, I want the admin scope of this effort to be explicit, so that no public surface changes by accident.
55. As the artist, I want the two modals already on the public site left alone, so that a tuned, tested interaction is not re-verified for no visible gain.
56. As the artist, I want no schema change and no new dependency, so that this deploys as everything else does.
57. As the artist, I want the dialog to read the rows the section already loaded rather than fetching again, so that opening a list costs nothing.
58. As the artist, I want the list-narrowing logic covered by tests, so that today's-booking boundary and the reveal arithmetic are not verified by eye.
59. As the artist, I want no new test harness introduced for this, so that the repo's testing shape stays as it is.
60. As the artist, I want the effort split into shippable slices, so that the layout work is not held behind the branding or vice versa.

## Implementation Decisions

**Scope.** The two admin forms and their inline row editors, the two admin lists that back them, and the app's name and icon. The client-facing Format Booking form, the portfolio lightbox, the calendar day popup, and the other five admin lists are untouched.

**Fields, not a flat grid.** The Booking create form groups into four fieldsets — schedule (date, start, end, status), client (name, number), the job (event, Headcount, venue, Style, Reference), and money and notes (total, DP, remaining balance, notes) — and the link form into two (client and send-to; optional slot). Each fieldset is an internal two-column grid that fills its rows, so a spanning field can no longer strand a neighbour and no row ends empty. The invisible spacer cell in the link form is deleted rather than kept. The Style radios become chips inside the job group; the read-only legacy Style line keeps its place beneath them. Labels, hints, placeholders, order within a group, validation, the overlap guard, the suggested total, and the remaining-balance line all stay as they are.

**Label *and* placeholder in edit mode.** Every inline row editor input gains the visible label its create-form counterpart has, wired to the input, plus the same placeholder for the fields that can legitimately be blank. Placeholders alone would not have helped: an edit row is populated by definition, and a placeholder renders only when a box is empty. The input's accessible name becomes the visible label rather than the separate screen-reader-only string.

**One shared dialog component.** A single modal component owns the overlay, the Escape key, backdrop dismissal, the body scroll-lock, moving focus into the panel on open and returning it to the trigger on close, a default panel (centred, capped height, rounded, white, internally scrollable), a title, and a close button — with a panel-class escape hatch for a call site that needs a different shape. It is a controlled component (open flag plus an on-close callback), not a hook, so the managers' existing open/close state is untouched. No variant enum: the call sites that differ can pass a class. The two public modals are **not** migrated to it; that is a follow-up with its own verification, and the portfolio lightbox's Escape handling is fused with its arrow-key navigation, so folding it in is the risky half of that refactor.

**The section keeps the create form and gains a summary and a trigger.** The dialog holds the attention badge, the refresh, the chips, the search box, the rows, and every row action. The attention count keeps being computed and reported to the page from the same load, so the tab badge cannot disagree with the dialog. The summary reuses the existing overview counts rather than adding a counter: the Booking trigger shows how many are upcoming and how many of those are still pending; the Permintaan trigger shows the "perlu ditindak" count the badge already computes.

**Two groupings, one cap rule.** The Booking dialog splits its rows into *Mendatang* (date on or after today, ordered by date then start) and *Riwayat* (date before today, newest first). The Permintaan dialog has no date grouping — its dimension is state, which the existing chips already express — so it applies one cap over the currently filtered set. In both, ten rows show, "Muat lebih banyak" reveals ten more and states the number still hidden, and the reveal resets to the first ten whenever the chip or the search text changes, because a reveal count is meaningless against a different list.

**One new pure module for the windowing.** A single pure module beside the existing admin helpers owns: the *Mendatang* / *Riwayat* split with its ordering, and the cap-and-reveal window returning the visible slice plus the hidden remainder, with the page size as one exported constant shared by both dialogs. Nothing about it touches Supabase, React, or the clock except through parameters. The Booking manager's two inline re-sorts after a create and after a save are deleted in favour of the split's ordering, so one rule orders the list rather than three.

**A bounded list is still a fetched list.** The cap is a view concern only: both dialogs read the rows the section already loaded, so no adapter, query, or limit changes and opening a dialog fetches nothing. Server-side pagination is explicitly not introduced.

**Naming the business.** One exported constant holds the name. The root layout's title uses it as the default inside a template that appends it to a page's own title. The visible brand line above the heading on the landing page, the login page, and the Format Booking page uses it, as do the three Indonesian sentences in the public form that currently name a job title. The social description becomes Indonesian and names the business.

**Per-route titles need a server page.** A client component cannot export metadata, and both admin routes are client components, so each is split the way the public Format Booking route already is: a thin server page exporting the route's title that renders the existing client component. The dashboard reads "Dashboard Admin" and the login page "Login Admin", each composed with the brand through the template. The auth guard, the session redirect, and the sign-in handling move without changing.

**The icon is an SVG, chosen by convention.** The app-router file convention supplies the icon; no manifest, no bitmap, and no image-generation dependency is added to the project. The mark is a serif "W" in cream on the espresso tile so that it stays legible at tab size, using a generic serif stack because a document icon cannot load the app's display font.

**Deliberately unchanged.** Every field, label, hint, validation rule, guard, and adapter; the derived Booking Request state and its refusal copy; the attention-count contract with the page; the cross-panel schedule signal; the client-facing form; the two existing public modals; the other five admin lists; the sticky tab bar and the section headings.

## Testing Decisions

A good test here asserts externally visible behaviour only: given a set of rows and a date, assert the two groups and their order; given a row count and a reveal count, assert the visible slice and the hidden remainder. No React rendering, no snapshots, no live database, no assertion on how a component is structured.

**One new seam: the pure windowing module.** It is tested with plain row fixtures and a pinned today key, and its boundaries are the point of the tests: a row dated today belongs to *Mendatang*, not *Riwayat*; a cancelled past row is still *Riwayat* (grouping is by date, independent of status); the ordering inside each group; and the window arithmetic at its edges — nothing revealed, a partial page, exactly one page, and more than one. Prior art: the existing pure helper tests for the query filter, the request state filter, and the overview summariser, which are the same shape and the same fixtures.

**Reused seams need no new tests.** The search box keeps using the same tested substring helper, the chips keep using the same tested state filter, and the trigger's counts reuse the tested overview summariser. The dropped inline re-sorts are covered by the new module.

**No component tests are added.** The dialogs, the fieldsets, the edit-row labels, the brand strings, the route titles, and the icon are verified by hand, as every screen in this repo is — the repo has no render harness today and this effort does not introduce the first one.

## Out of Scope

- The client-facing Format Booking form: no field, no layout, no copy beyond renaming the business where it is named in prose.
- Migrating the portfolio lightbox or the calendar day popup onto the shared dialog component.
- The other five admin lists — Blokir, Portfolio, Harga & Layanan, Stat, and Testimoni — whether by dialog, cap, or grouping.
- Server-side pagination, infinite scroll, sorting controls, column views, bulk selection, or bulk actions.
- A URL or hash address for an open dialog; the admin tab bar keeps its existing hash routing.
- Any other copy rewrite: the work is the layout, the edit-row labelling, the list window, the business's name, and the icon. Section headings, hints, empty states, and error messages stay as they are.
- Renaming the domain role in the glossary. "Makeup artist" stays the actor the domain is about; the brand is the practice's name, and the glossary is not a home for proper nouns.
- Bitmap icons, an apple touch icon, a web app manifest, an OG image, and any change to how the site is shared beyond the description string.
- Any schema, policy, function, or migration change, and any new runtime dependency.

## Further Notes

- **Why the cap survives the dialog.** They solve different problems and both are still needed: the dialog bounds the page (the section stops growing, so Blokir and Portfolio stop receding), and the cap bounds the dialog (so the list is a glanceable two-screen workspace rather than the same endless scroll wearing a hat).
- **Why the two public modals are left alone.** The portfolio lightbox's Escape handling lives in the same listener as its arrow-key navigation and was specifically fixed to stop stealing focus and flickering the scroll-lock; re-basing it on the new component means re-verifying a tuned public interaction inside an effort about the admin side. The component earns its place from the two new dialogs; the migration is a clean follow-up ticket.
- **Why the role word survives in the glossary.** `GLOSSARY.md` describes what a Booking, a Format Booking, a Booking Request, a Headcount, a Style, and a Reference *are*. "Wandana Makeup" names the practice, not a concept, so no glossary entry is added and no existing entry changes.
- **No ADR.** Nothing here is hard to reverse, surprising without context, or the result of a contested trade-off: the dialog is a presentation choice, the cap is a constant, and the name is a string. The two decisions worth remembering are recorded above as reasoning rather than as architecture.
- **Build order and dependencies.** The three layout and edit-row tickets touch the same two managers and are ordered; the dialog ticket depends on both because it relocates the markup they edit. The per-route titles depend on the brand constant existing. The icon is independent.
- Tickets for this feature live at `.scratch/form-layout-polish/issues/`.
