---
target: the landing page
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/home/fahmi/projects/pribadi/test-mattpocock-skills-opencode/src/app/page.tsx"
target_fingerprint: "sha256:1f21ca68797260c1cbce9950a596dfcdc4bff7dabc2f80ee81370fcd2e95a660"
target_path: /home/fahmi/projects/pribadi/test-mattpocock-skills-opencode/src/app/page.tsx
timestamp: 2026-11-24T04-10-51Z
slug: src-app-page-tsx
---
Method: dual-agent (A: design_review · B: detector_review)

# Wandana Makeup landing page critique

The landing page’s strongest material is the real makeup photography. On a phone, the first viewport gives more room to the headline, stats, buttons and a testimonial, with the portfolio starting just beyond 1,000px at 390px wide. The site feels warm and coherent, but clients who want to judge the work or check a date have to scroll to reach either.

## Design health

| # | Heuristic | Score | Evidence |
|---|---|---:|---|
| 1 | System status | 3/4 | The calendar announces month changes and has loading and retry states. |
| 2 | Match to the real world | 3/4 | Indonesian copy and rupiah work well. A few labels are in English, and Tersedia can sound like a confirmed slot. |
| 3 | User control | 2/4 | Escape restores focus, but Tab can leave both dialogs. |
| 4 | Consistency | 3/4 | The palette is coherent. Calendar WhatsApp actions use varying treatments. |
| 5 | Error prevention | 2/4 | Past dates are disabled. The floating chat can intercept a date tap. |
| 6 | Recognition | 2/4 | Pricing has a hero shortcut. The portfolio and schedule have none. |
| 7 | Flexibility | n/a | Public inquiry flow with no repeated expert task. |
| 8 | Aesthetic and minimalist design | 2/4 | Hero proof competes with the work. The one visible service sits in a three-column desktop grid. |
| 9 | Error recovery | 3/4 | Calendar retry is clear. Empty catalog sections lack a local next action. |
| 10 | Help and documentation | n/a | Standalone help is unnecessary for the short inquiry flow. |
| | **Total** | **20/32** | **Acceptable (62.5%)** |

## What works

- Real makeup photos and the warm cream-and-espresso palette give the page a coherent identity. Keep the portrait and the work prominent.
- Style, service and date-specific WhatsApp links carry the visitor’s context into chat. The calendar reveals details only after a date is selected.

## Priority issues

1. **P1 · Put the work and date check within reach.** At 390px wide, the hero image starts about 530px down, Portfolio around 1,033px, and Jadwal around 2,119px. Move most testimonial cards below the work, keep a clear WhatsApp action, and add direct shortcuts to **Lihat hasil rias** and **Cek jadwal**. `$impeccable layout`. [Hero](../../src/components/hero-trust.tsx#L79) · [Page sections](../../src/app/page.tsx#L104)
2. **P1 · Keep keyboard focus inside both dialogs.** In Chromium, Tab moved from the portfolio lightbox to the page behind it and left the day sheet as well. Preserve Escape and focus return while containing Tab and Shift+Tab. The existing native dialog is a pattern to consider. `$impeccable harden`. [Portfolio](../../src/components/portfolio-grid.tsx#L173) · [Day sheet](../../src/components/availability-calendar.tsx#L408) · [Dialog](../../src/components/dialog.tsx#L60)
3. **P1 · Keep the calendar tappable and explain the status.** At 390px, the floating chat intercepted the center of a date at one scroll position. Move it away from the calendar, enlarge the 34px month arrows and 30px sheet close control, and explain that the artist confirms the time in chat. Remove the unreachable Penuh legend item. `$impeccable adapt` and `$impeccable clarify`. [Floating chat](../../src/components/wa-float.tsx#L16) · [Calendar](../../src/components/availability-calendar.tsx#L275)
4. **P2 · Keep trust claims tied to published evidence.** Hiding all stats or quotes can bring back hardcoded content. The preview showed 3 Tahun, while the fallback says 5+ Tahun. Omit empty proof, keep artist-approved entries, and use readable localized labels. `$impeccable harden`. [Proof fallbacks](../../src/lib/hero-proof.ts#L110)
5. **P2 · Put package inclusions in readable text.** The service cover is a price flyer whose details are clipped or hard to read on mobile, and the description repeats the title. Put verified inclusions beside the price, give a single service a layout that fits, and use a featured label instead of a popularity claim for a placement determined by catalog order. `$impeccable clarify`. [Service card](../../src/components/price-list.tsx#L37)

## Visitor journeys

- **First-time client.** The portrait creates interest, but three similar image names and a long opening make it hard to judge distinct looks.
- **Client checking a date one-handed.** The calendar is familiar, but finding it and avoiding the floating button add friction. The date appears in the outgoing message once selected.
- **Keyboard visitor.** Escape is predictable. Tabbing past the last action loses dialog context.

Cognitive load is moderate. The three stats and three equal quote cards compete for attention on desktop. The gallery’s three filters and familiar month grid are easy to understand. The site’s most convincing moments are seeing the work up close and carrying a date into chat.

## Detector evidence and smaller observations

The source scan reported zero primary findings and one advisory for the 11px mobile badge (price-list.tsx:59). The headless browser detector reported two anti-patterns. The hero brand label was highlighted, and the interface showed global advisories for Inter and cream. Those two style choices follow DESIGN.md. Translate Prev/Next, Client, and Rating where visible. Give the gallery items descriptive names, and use a portrait alt only when the hero really is a portrait.

## Questions to consider

- What should the first screen help a visitor do first? See the work, check a date, or start a WhatsApp chat?
- What should lead the first pass? Calendar and keyboard reliability, the portfolio and service presentation, or both?
