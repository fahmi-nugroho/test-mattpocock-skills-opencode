# 04: Name the business

**What to build:** The business is named once, in one exported constant, and every surface that should carry the name reads from it: the root layout's browser title, the visible brand line above the heading on the landing page, the login page, and the Format Booking page, and the three Indonesian sentences in the public Format Booking form that currently say "Makeup Artist". The social description becomes Indonesian and names the business. The title gains a template so a page can contribute its own title in front of the brand. No other copy changes, and the domain's role word stays as it is in the glossary.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] One exported constant holds the business name and is the only place the string is written outside the copy that reads it.
- [x] The root layout's title is a default of that name inside a template that appends the name to a page's own title.
- [x] The brand line above the heading on the landing page, the login page, and the Format Booking page reads the business name.
- [x] The three Indonesian sentences in the public Format Booking form that name a job title name the business instead, and read as natural Indonesian.
- [x] The social description is Indonesian and names the business; no other metadata field changes.
- [x] Nothing else in the copy changes: section headings, hints, empty states, error messages, and the glossary's role vocabulary stay as they are.
- [x] `npm run typecheck` and the full test suite still pass; no test asserts the old strings.

## Comments

- 2026-10-19 — Implemented on `feat/form-layout-polish-spec`.
  - New module `src/lib/brand.ts` exports `BUSINESS_NAME = "Wandana Makeup"`; it is the only place the name is written (`grep -rn "Wandana" src` finds only that file). No test or source file outside it contains the string, and no test asserted the old "Makeup Artist" strings.
  - `src/app/layout.tsx`: `metadata.title` is now `{ default: BUSINESS_NAME, template: `%s · ${BUSINESS_NAME}` }`. The template is unexercised until ticket 05 adds per-route titles, which is the dependency the ticket describes.
  - `metadata.description` is Indonesian and names the business: `Portofolio, harga, dan ketersediaan Wandana Makeup — pemesanan lewat WhatsApp.` The trailing "booking via WhatsApp" was also translated so the whole description is Indonesian; no other metadata field changed.
  - The visible brand line reads the constant on the landing page (`src/components/hero-trust.tsx`), the login page (`src/app/admin/login/page.tsx`), and the Format Booking page (`src/app/request/[token]/page.tsx`). The dashboard has no brand line in this ticket's scope — the parent spec's "four visible brand lines" counts the three ticket surfaces plus the title, and ticket 05 adds the route titles.
  - The three Indonesian sentences in `src/components/request-form.tsx` now name the business instead of the job title: the expired-link line (`Minta link baru ke Wandana Makeup lewat WhatsApp…`), the form intro (`…supaya Wandana Makeup bisa menyiapkan jadwalmu.`), and the Style hint (`Pilih salah satu supaya Wandana Makeup tahu cara menata.`). Each was checked to read naturally in Indonesian.
  - Unchanged: section headings, hints, placeholders, empty states, error messages, the alt text `Portrait makeup artist`, and `GLOSSARY.md`'s role vocabulary. No schema or dependency change.
  - Code review (standards + spec axes). Fixed: the half-translated description tail. Deliberately kept: the duplicated brand-line markup across the three layouts (inline-Tailwind repo convention, and the three copies differ only by centering); README/GLOSSARY prose that still says "Makeup Artist", which describes the role, not the brand.
  - Verified: `npm run typecheck` clean, full `vitest run` (55 files, 491 passed).
