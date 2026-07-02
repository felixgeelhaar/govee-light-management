---
updated: 2026-07-02
---

## [OPEN]

- #304 "No devices found" — root cause CONFIRMED via reporter log: a device's capability metadata failed the client's strict whole-batch parse. Symptom fixed in plugin v2.7.11 (raw-fetch fallback); root fixed in client 3.3.10 (per-device + per-capability validation) and shipped in plugin v2.7.12. Awaiting reporter (pauljarrell) confirmation.
- ~~Add `format:check` to govee-api-client PR CI~~ DONE (corrected): ci.yml already runs `format:check`; the real gap was that husky hooks were dormant (no `prepare` script → `core.hooksPath` unset), so commits skipped formatting. Fixed by adding `"prepare": "husky"` (PR #45). Formatting now enforced at commit time.

## [BLOCKED]

- Node 24 runtime adoption — `@elgato/cli@1.7.4` validator rejects `Nodejs.Version:"24"`; revisit when Elgato's packer accepts it.

## [WAITING]

- v2.7.12 (+ client 3.3.10) propagation through Elgato Marketplace
- #250 Floating Mist — shipped v2.7.9; still no reporter confirmation (stale, low priority)
