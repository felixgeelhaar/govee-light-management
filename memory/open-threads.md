---
updated: 2026-07-06
---

## [OPEN]

- #311 "Cannot control lights / X is offline and cannot be controlled" (H619A) — FIXED across all control-dispatch paths (attempt regardless of the unreliable `online` flag) + full sweep + CircuitBreaker test hardening. Shipped **v2.7.13** (#312/#313/#314). Awaiting reporter confirmation. Optional follow-up: make the DISPLAY layer (power-glyph) also lenient on the flag — this session fixed control only (cosmetic gap: a wrongly-offline device may render ○ when actually on).
- #304 "No devices found" — root cause CONFIRMED via reporter log: a device's capability metadata failed the client's strict whole-batch parse. Symptom fixed in plugin v2.7.11 (raw-fetch fallback); root fixed in client 3.3.10 (per-device + per-capability validation) and shipped in plugin v2.7.12. Awaiting reporter (pauljarrell) confirmation.
- ~~Add `format:check` to govee-api-client PR CI~~ DONE (corrected): ci.yml already runs `format:check`; the real gap was that husky hooks were dormant (no `prepare` script → `core.hooksPath` unset), so commits skipped formatting. Fixed by adding `"prepare": "husky"` (PR #45). Formatting now enforced at commit time.

## [BLOCKED]

- Node 24 runtime adoption — `@elgato/cli@1.7.4` validator rejects `Nodejs.Version:"24"`; revisit when Elgato's packer accepts it.

## [WAITING]

- v2.7.13 (#311 control fix) propagation through Elgato Marketplace + reporter confirmation
- v2.7.12 (+ client 3.3.10) propagation through Elgato Marketplace
- #250 Floating Mist — shipped v2.7.9; still no reporter confirmation (stale, low priority)
