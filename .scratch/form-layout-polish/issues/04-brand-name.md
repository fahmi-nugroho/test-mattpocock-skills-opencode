# 04: Name the business

**What to build:** The business is named once, in one exported constant, and every surface that should carry the name reads from it: the root layout's browser title, the visible brand line above the heading on the landing page, the login page, and the Format Booking page, and the three Indonesian sentences in the public Format Booking form that currently say "Makeup Artist". The social description becomes Indonesian and names the business. The title gains a template so a page can contribute its own title in front of the brand. No other copy changes, and the domain's role word stays as it is in the glossary.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] One exported constant holds the business name and is the only place the string is written outside the copy that reads it.
- [ ] The root layout's title is a default of that name inside a template that appends the name to a page's own title.
- [ ] The brand line above the heading on the landing page, the login page, and the Format Booking page reads the business name.
- [ ] The three Indonesian sentences in the public Format Booking form that name a job title name the business instead, and read as natural Indonesian.
- [ ] The social description is Indonesian and names the business; no other metadata field changes.
- [ ] Nothing else in the copy changes: section headings, hints, empty states, error messages, and the glossary's role vocabulary stay as they are.
- [ ] `npm run typecheck` and the full test suite still pass; no test asserts the old strings.

## Comments
