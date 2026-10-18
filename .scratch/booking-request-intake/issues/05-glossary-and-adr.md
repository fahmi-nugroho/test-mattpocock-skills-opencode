# 05: Glossary and the intake ADR

**What to build:** The project's first `GLOSSARY.md` and the architecture decision record for this intake design.

**Blocked by:** nothing, but best written once 01 to 04 have settled the names.

**Status:** needs-triage

- [ ] Given `GLOSSARY.md` is created at the repo root, it defines Booking, Format Booking, Booking Request, and Headcount in domain language only, with no implementation detail, no schema, and no process notes.
- [ ] Given the glossary exists, every term is the one the feature, its tests, and its tickets actually use; in particular there is no "Inquiry" term.
- [ ] Given the glossary entry for Booking, it still records that only the admin creates bookings and only confirmed bookings occupy the calendar.
- [ ] Given an ADR is added, it records that intake is a token link plus a Booking Request table rather than parsing WhatsApp text or using the WhatsApp API, states the alternatives considered and why they were rejected, and notes that this introduces the project's first public write path.
- [ ] Given the ADR exists, it does not contradict the existing hours-removal ADR, and it is linked from the spec's further notes.
- [ ] Given the issue tracker conventions, the spec and tickets cross-reference each other by slug and number, and each ticket's status line is present.

## Comments
