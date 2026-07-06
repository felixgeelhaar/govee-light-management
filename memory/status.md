---
updated: 2026-07-06
---

## Current State

Enterprise Stream Deck plugin for Govee lights, on the Elgato Marketplace (approved v2.0.1, April 2026). Latest release **v2.7.13** (2026-07-06; bundles `@felixgeelhaar/govee-api-client` **3.3.10**). DDD + strict TDD, 634 plugin unit tests + E2E; client repo 718 tests. `main` branch protection is strict (up-to-date required) + requires conversation resolution — expect BEHIND re-runs and Copilot-thread gates when merging. Releases: tag `v*` → release.yml (streamdeck validate + pack + GitHub release with the `.streamDeckPlugin` asset).

## Last Session Summary

Fixed **#311** ("X is offline and cannot be controlled" — H619A discovered but not controllable). Root cause: control was gated on `Light.canBeControlled()` = `_state.isOnline`, set from the Govee cloud API's unreliable `online` field in `GoveeLightRepository.getLightState()` — same class of cloud-API flakiness as #304. Fix: attempt control regardless of the flag, surface a real transport error only on genuine failure. **Full sweep** found the trap was pervasive — 16 control-dispatch loops + 8 representative-picks bypassed the core path (all group commands via `getControllableLights()`). Fixed all + the post-command cache-remember loop (#312). Also investigated CI flakiness on request → the only real vector was `CircuitBreaker.test.ts` real-timer waits (100ms margin, 0/35 local flakes) → converted to fake timers (#313). Released **v2.7.13** (#314).

## Next Session Should

Watch **#311** for reporter confirmation on v2.7.13 (Elgato store rollout lag expected). Also still watch #304 (pauljarrell) on v2.7.11/2.7.12.

## Blocked / Waiting

- #304 reporter confirmation (Elgato store rollout lag expected)
- Node 24 runtime — blocked on Elgato CLI/validator accepting `Nodejs.Version:"24"` (1.7.4 rejects it)
