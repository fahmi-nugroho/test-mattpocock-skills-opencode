---
target: Customer Format Booking form
total_score: 22
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/home/fahmi/projects/pribadi/test-mattpocock-skills-opencode/src/app/request/[token]/page.tsx"
target_fingerprint: "sha256:69a1b52658f52f8cd1ebe88c128b045bb0f4ed5cdcf3720675cc1468250bfb82"
target_path: /home/fahmi/projects/pribadi/test-mattpocock-skills-opencode/src/app/request/[token]/page.tsx
timestamp: 2026-11-24T04-42-07Z
slug: src-app-request-token-page-tsx
---
Method: dual-agent (A: admin_design · B: admin_detector)

# Customer Format Booking critique

The invitation form is recognizably part of Wandana Makeup, prefilled context saves typing, and the two style cards are easy to understand. The customer comes from WhatsApp to give the artist event details and a proposed time. At present, the proposed time and reservation caveat appear well after the contact details.

## Design health

| # | Nielsen heuristic | Score |
|---|---|---:|
| 1 | Visibility of system status | 3/4 |
| 2 | Match to the real world | 2/4 |
| 3 | User control and freedom | 2/4 |
| 4 | Consistency and standards | 3/4 |
| 5 | Error prevention | 2/4 |
| 6 | Recognition | 2/4 |
| 7 | Flexibility and efficiency | 2/4 |
| 8 | Aesthetic and minimalist design | 2/4 |
| 9 | Error recovery | 2/4 |
| 10 | Help and documentation | 2/4 |
| | **Total** | **22/40 · Acceptable** |

The form communicates loading, previously submitted, and expired states. Completion and correction take extra effort because the form is a long ungrouped sequence and validation feedback is distant from the field.

## Priority issues

1. **P1 · Show the proposed slot and make corrections local.** In the 390px fixture the date input started around 1,050px and the submit action around 1,409px. There were 11 logical fields with no required attributes. A missing WhatsApp number displayed a bottom error while focus stayed on Kirim permintaan. Group the form into Jadwal, Kontak and Detail acara, show any prefilled slot early, explain that Wandana confirms the time in WhatsApp, distinguish required and optional fields, and attach errors to each field with focus to the first invalid one. Enlarge touch targets. Keep clashes as a warning with an actionable suggestion. `$impeccable harden` and `$impeccable layout` · [Validation](../../src/components/request-form.tsx#L147) · [Schedule and error](../../src/components/request-form.tsx#L405)
2. **P2 · Give missing, expired and submitted states an onward path.** Expired tells the visitor to ask on WhatsApp but provides no action. Missing offers a retry of the same token. Show an action to return to the artist or request a new link, reserve retry for connection errors, and clarify what happens after a successful or already-submitted request. `$impeccable clarify` · [Terminal states](../../src/components/request-form.tsx#L207)

## What works and who struggles

Name and time prefill, familiar labels, two defined style choices, and a nonblocking overlap warning suit the chat handoff. Human acknowledgement is clear after submission. An on-the-go customer can enter most details before discovering that the proposed time clashes. A keyboard or assistive-technology user receives an alert but has to navigate back through the form to identify the field. A returning customer with an expired link needs a clear path back to the conversation.

## Detector evidence

The browser detector highlighted the Referensi placeholder at request-form.tsx:380, about 3.32:1 at 14px in the fixture. Move the example into persistent darker helper text associated with the field. It also highlighted the clash warning’s mobile wrap. Shorten the warning while keeping the suggestion to choose another time. Cream and the small brand identifier align with the product context. Source detector returned no customer-form-specific advisory.

## Follow-up questions

- Should the opening show the prefilled schedule when present, or put contact details first in every case?
- Should the first form pass improve completion and recovery alone, or ship together with the admin handoff fix?
