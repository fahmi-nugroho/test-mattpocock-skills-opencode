# 04: Price hierarchy with featured badge

**What to build:** price-forward service cards with one "Paling Dipilih" badge driven by sort order, so a client scans cost fast and gets guided to the popular choice.

**Blocked by:** 01 (needs tokens and width foundation).

**Status:** ready-for-agent

- [ ] Cards show prominent IDR price with subtle duration and keep per-service WA prefill buttons
- [ ] Exactly one badge appears on the first active service by ascending sort (none when no active service) via the new pure selector, covered by a Vitest unit test
- [ ] No schema migration; owner controls the badge through the existing sort field
