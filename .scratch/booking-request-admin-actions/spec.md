# Spec: Working the Permintaan List

Status: ready-for-agent

## Problem Statement

The Permintaan section is append-only. It lists every Booking Request ever created, newest first, and offers exactly one action on them: turn a submitted one into a Booking. There is no way to search it, no way to narrow it, no way to correct it, no way to remove it, and no way to replace a link that has gone stale. The tab badge refreshes only when the page loads or when the schedule changes elsewhere, so a request that arrives while the dashboard sits open is invisible until a manual reload.

Four things follow as the list grows:

- The request the artist needs is buried. She knows the client's name, or the date, or roughly when the request arrived, and has to read down a list of every request she has ever made to find it.
- Requests she will never act on stay forever: clients who never answered, spam that got past the entry point, accidental duplicates. They crowd out the ones that matter and inflate the section.
- A link with a mistake in it — a date typed wrong before sending — has to be abandoned. There is no way to fix the prefill on a live link, and no way to make a new one that already knows what the old one said, so she retypes it.
- A link that lapses leaves the artist stuck. She cannot accept it, and the only marked route to a Booking is to create a Format Booking request from an empty form and start the conversation over.

## Solution

The Permintaan section becomes workable:

- **Search** it by anything she would remember about a client, using the same search box every other admin list already has.
- **Filter** it by state — who needs action, who has answered, who is done, what has lapsed — so chasing is a click and not a read-through.
- **Delete** requests she will never act on, with a two-step confirmation, while an accepted request stays exactly where it is.
- **Correct** a live link's prefill in place when she gets the name or the slot wrong, without burning the token she already sent.
- **Re-issue** a lapsed link as a fresh one that already carries the name and slot from the old, so the conversation continues instead of restarting.
- **Re-send** a live link — copy it again, or open WhatsApp with it prefilled — for the client who lost the message, without storing a phone number she did not ask to store.
- **Refresh** the list on demand, so a request that arrived while the tab was open appears without a page reload.

Expiry keeps its meaning and its teeth: a lapsed link still cannot be accepted, and the seven-day window is not configurable. This feature makes a lapsed link recoverable, not acceptable.

## User Stories

**Admin**

1. As an admin, I want to search the Permintaan list by client name, so that I can find a request I remember without reading the whole list.
2. As an admin, I want that same search to match a phone number, so that I can find a request when the client's name is spelled several ways.
3. As an admin, I want the search to match the event, the venue, the style, the reference, and the notes, so that I can find a request by whatever detail I actually remember.
4. As an admin, I want the search to match the requested date, so that I can find everything booked for a given day.
5. As an admin, I want the search box to behave exactly like the one on my other lists, so that there is nothing new to learn.
6. As an admin, I want to see at a glance when nothing matches, so that I know the search worked rather than the list being empty.
7. As an admin, I want to filter the list to the requests that need my action, so that chasing is one tap and not a read-through.
8. As an admin, I want to filter to what is still open, so that I can see who I am still waiting on.
9. As an admin, I want to filter to what has been accepted, so that I can check what became work.
10. As an admin, I want to filter to what has lapsed, so that I can decide who to re-issue a link to.
11. As an admin, I want a filter that shows everything, so that I can get back to the full list in one tap.
12. As an admin, I want the search and the filter to work together, so that I can narrow to lapsed requests from one client, for instance.
13. As an admin, I want the filter chips to match what the badge already counts, so that the section does not tell me two different stories.
14. As an admin, I want to delete a request a client never answered, so that abandoned links stop crowding my list.
15. As an admin, I want to delete a submission that is junk or the client's accidental duplicate, so that a mistake in the intake does not stay in my list forever.
16. As an admin, I want deleting to take two deliberate clicks, so that a stray tap cannot destroy anything.
17. As an admin, I want to be told why I cannot delete a request, in plain Indonesian, when it has already become a Booking.
18. As an admin, I want to be pointed at the right way to remove an accepted one, so that I am not left with a button that refuses me and no alternative.
19. As an admin, I want to know before confirming that deleting kills the client's link, so that I do not silently break a link I already sent.
20. As an admin, I want a deleted request to disappear from the list immediately, so that the section reflects what I just did.
21. As an admin, I want to correct the name or the requested slot on a link I have sent but the client has not answered, so that a typo does not cost me the link.
22. As an admin, I want that correction to be refused once the client has answered, so that their own request is never silently rewritten by me.
23. As an admin, I want to correct a live link in the row itself, so that fixing a typo is as quick as reading it.
24. As an admin, I want a corrected prefill to be part of the same link, so that nothing I already sent in the chat stops working.
25. As an admin, I want to know that a client who already opened the form keeps the values they loaded, so that I am not surprised when they send the old ones.
26. As an admin, I want to make a fresh link from a lapsed one, so that a client who never answered can be asked again.
27. As an admin, I want that fresh link to carry the name and the slot from the old one, so that I do not retype what I already entered.
28. As an admin, I want the old request kept as history when I re-issue, so that I can still read what was originally asked.
29. As an admin, I want the re-issue to be a new link with a fresh clock, so that a dead token is never resurrected.
30. As an admin, I want to be told plainly that the client must fill the form again, so that I know what re-issuing does and does not carry over.
31. As an admin, I want to copy a live link again, so that a client who lost the message can be sent it once more without creating anything new.
32. As an admin, I want to open WhatsApp with that link prefilled, so that re-sending is one tap when I am at my desk.
33. As an admin, I want to type the number to send to rather than have it stored, so that my list does not collect phone numbers I never asked for.
34. As an admin, I want that number field pre-filled when the request already carries a number, so that re-sending an answered request is genuinely one tap.
35. As an admin, I want the copy and re-send actions hidden when they would be meaningless, so that the row only offers what actually works for that state.
36. As an admin, I want a refresh button on the section, so that a request that arrived while I had the page open shows up without reloading everything.
37. As an admin, I want refreshing not to blank the list, so that I can keep reading while it updates.
38. As an admin, I want refreshing to update the tab badge too, so that the count never disagrees with the list.
39. As an admin, I want every one of these actions to look and behave like the ones on my other lists, so that there is nothing new to learn.
40. As an admin, I want an action that fails to tell me so in Indonesian, in the row, so that I know whether to try again.

**Quality and safety**

41. As the artist, I want an accepted request to be impossible to delete, so that the record of what was asked and what it became survives.
42. As the artist, I want the client's own answers never to be editable by me, so that a Booking Request stays the record of what the client actually sent.
43. As the artist, I want a correction to be refused by the database query itself rather than only by the button, so that a stale screen cannot rewrite an answered request.
44. As the artist, I want the seven-day window and the accept rule untouched, so that this feature does not quietly loosen intake.
45. As the artist, I want a re-issued link to be a new token, so that an old link can never be revived.
46. As the artist, I want no new client-facing surface, so that the public contract I deliberately kept narrow stays narrow.
47. As the artist, I want this to run with no realtime connection and no background polling, so that it deploys exactly as everything else does.

## Implementation Decisions

**No schema change and no SQL.** This feature is entirely admin-side: the request table's policies already permit full mutation by the authenticated admin, and the public functions are untouched. It adds columns to nothing.

**Two new guarded adapters** beside the existing request data-access wrapper, both following the shape the accept path already established: put the rule in the query, and if the guarded write matches nothing, read the row back and explain in Indonesian.

- **Delete a request.** Deletes only when the request is not linked to a Booking. Refuses an accepted request with a message, and the component turns that into the path that does work — delete the Booking instead, whose foreign key already releases the request.
- **Correct a request's prefill.** Patches only the admin-owned fields — the client's name and the requested date, start, and end — and only while the request is still open: not yet answered, not yet lapsed. The same slot validation the create path already uses runs first.

**One new pure helper: the state filter.** A pure function taking the requests, the chosen filter, and a clock, returning the matching subset. It reuses the existing derived-state function, so the chips can never disagree with the badge or with the accept guard. The filter vocabulary is: all, needs action (submitted), open, accepted, lapsed. The clock is injected so tests can pin it, matching the derived-state function's existing signature.

**Search reuses the existing convention unchanged.** The list is filtered client-side by the same pure substring helper the other five admin lists already use, with a field picker over the client's name and number, the event, the venue, the style, the reference, the notes, the requested date, and the state label.

**Filter chips.** A row of roving-tablist buttons above the list, one per filter state, the first of their kind in the admin area and styled from the public portfolio category chips. They compose with the search box rather than replacing it.

**Re-issue reuses the existing create path.** "Buat link baru" on a lapsed request calls the same create function the link form calls, with the client name and slot copied from the old row. That is what makes the old row's history safe: nothing about it is mutated. Prefilled client details cannot be carried over, because the public read function deliberately returns none of them.

**Re-send stores nothing.** Copying the link needs no state at all. The WhatsApp action takes a number typed into a per-row field that is never written to the database, mirroring the deliberate "not stored" decision the link form already made; it is pre-filled from the request's own number when the client has supplied one.

**State-aware row actions.** The row offers only what works for its derived state: a live link can be copied, re-sent, or corrected; a lapsed one can be re-issued; an answered one can be accepted; an accepted one can be deleted only by way of its Booking.

**Refresh.** The list's load function is hoisted out of its effect so a button can call it, and the pending state is a separate flag from the initial load, so the list never blanks behind a loading message. The tab badge updates from the same load, and the existing cross-panel refetch signal continues to work untouched.

**Deliberately unchanged.** The state derivation and its refusal copy, the accept guard and the accept path, the seven-day window, the create path's own validation, the row patterns themselves, and the absence of any detail page or modal. Deleting a request dispatches no schedule event, because a Booking Request never occupies the calendar and no other panel can be affected by its removal. No `updated_at` column is added: nothing displays one and nothing needs it.

## Testing Decisions

A good test asserts externally visible behaviour only: given a stored request row and a clock, assert the filtered subset; given a mocked client, assert the guards a write carries and the refusal it produces when nothing matches. No live database, no component internals, no snapshots.

Two existing seams, no new test infrastructure:

- **The pure state filter.** Tested against the existing request-row and clock fixtures, including the boundary that matters most: a request answered before its window lapsed reads as lapsed, because that is what the derivation and the accept guard both say. Prior art: the existing derived-state and no-match filter tests.
- **The two guarded adapters, with the injected recording mock client.** Tested for the guard chain each write carries and for the Indonesian refusal when the guarded write matches nothing — the same shape the accept path's test already asserts. Prior art: the existing admin request adapter tests.

**Nothing else changes.** There is no migration, so the declarative schema contract test is untouched; the request list has no component tests today and does not gain any, so the chips, the search box, the row actions, and the refresh button are covered by manual QA like every other screen in this repo.

## Out of Scope

- Editing what the client sent. A submitted request stays the record of their answer; correcting the Booking after accepting it is the route.
- Accepting a lapsed request, reviving a token, re-opening a submitted request, or making the seven-day window configurable.
- Undo, a recycle bin, soft deletion, a `deleted_at` column, or any edit history and audit trail — deletion here is permanent, as it is everywhere else in this repo.
- Pagination, infinite scroll, server-side search, or any list limit; other lists load everything and so does this one.
- Realtime, polling, or any background refresh. The button is manual by decision.
- Bulk selection, bulk delete, sorting controls, or a request detail page.
- Notifying the client, by email, push, or WhatsApp automation.
- Removing an accepted request directly, or cascading a Booking's deletion.
- Any change to the public form, the public functions, or the client's link.

## Further Notes

- Build order: (1) both guarded adapters with their tests; (2) the pure state filter with its tests, then the search box and the chips; (3) the row actions and the refresh button. The search field picker should include the Style and the Reference, so this feature lands **after** `.scratch/booking-request-style-and-reference/`, which adds them.
- No glossary term and no ADR. Nothing here changes what a Booking Request *is*: it stays the client's own answer, kept as the record of what they sent, acceptable at most once. That is why [ADR-0002](../../docs/adr/0002-booking-request-intake.md) needs no amendment — refusing to delete an accepted request, refusing to rewrite an answered one, and re-issuing a lapsed link as a new token all move inside the decision it already recorded.
- The accepted cost of the delete rule: removing an accepted request means deleting its Booking first, which releases the request through the existing foreign key, after which it deletes normally. Two steps, and the audit link is never quietly severed.
- The expiry rule the artist chose to keep has a consequence worth stating: with the window fixed and lapsed links unaccept-able, a client who answered on the sixth day and was not accepted by the seventh can only be served by a re-issued link. The section's lapsed chip and the re-issue action are therefore the normal end of a link's life, not an edge case.
- Tickets for this feature live at `.scratch/booking-request-admin-actions/issues/`.
