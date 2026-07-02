---
updated: 2026-07-02
---

## Current State

Enterprise Stream Deck plugin for Govee lights, on the Elgato Marketplace (approved v2.0.1, April 2026). Latest release **v2.7.12** (bundles `@felixgeelhaar/govee-api-client` **3.3.10**). DDD + strict TDD, 632 plugin unit tests + E2E; client repo 718 tests. `main` branch protection is strict (up-to-date required) + requires conversation resolution — expect BEHIND re-runs and Copilot-thread gates when merging.

## Last Session Summary

Fixed #304 ("Connect succeeds but no devices found"). Symptom fix: lenient raw-fetch fallback in CloudTransport (v2.7.11). Confirmed root cause from reporter log (one device's capability metadata failed the client's strict whole-batch parse). Root fix in govee-api-client: per-device + per-capability validation + structured learning logs → released client 3.3.10 (PRs #41/#42/#43) → bumped + released plugin **v2.7.12** (#308). Also merged 4 dependabot PRs and consolidated CI to a single Node 20 job (#306).

## Next Session Should

Watch #304 for reporter (pauljarrell) confirmation on v2.7.11/2.7.12. Add `format:check` to the govee-api-client PR CI (ci.yml) so unformatted code can't break a release again (it broke the v3.3.10 release; fixed reactively via PR #44).

## Blocked / Waiting

- #304 reporter confirmation (Elgato store rollout lag expected)
- Node 24 runtime — blocked on Elgato CLI/validator accepting `Nodejs.Version:"24"` (1.7.4 rejects it)
