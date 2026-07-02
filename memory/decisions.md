---
updated: 2026-07-02
note: append-only log — never edit or delete entries; supersede with "→ superseded [date]"
---

- 2026-06-09: (placeholder) Adopted Agent OS memory system — persistent cross-session state via memory/ + wiki/ + cadence skills.
- 2026-06-09: Music mode ids validated as non-negative (>= 0), not positive — Govee devices can be zero-indexed (H70B6 Floating Mist = id 0). Fix lives in client `MusicMode.validateModeId`.
- 2026-07-01: Device discovery must be no stricter than the Connect check. `CloudTransport.discoverDevices()` falls back to a lenient raw `/user/devices` fetch (skip only malformed devices) when the strict client throws or returns zero. (#304 / PR #305, shipped v2.7.11)
- 2026-07-01: On fallback failure, keep the primary discovery result (retains `unsupportedDevices` cloud-group entries) rather than returning empty. (Copilot review, PR #305)
- 2026-07-01: CI targets a single Node version = the one Stream Deck runs (`manifest.Nodejs.Version`). Chose 20, not 24: `@elgato/cli@1.7.4` still rejects `Nodejs.Version:"24"` (schema `const`), so 24 is documented but not packable. Dropped `Test (Node 22)` from branch protection required checks. Revisit 24 when Elgato's packer supports it.
- 2026-07-02: Root fix in `@felixgeelhaar/govee-api-client` — `findAll` validates the response envelope strictly, then each device AND each capability individually. A malformed capability drops only that capability (light kept + controllable); a device is skipped only if identity is unusable or capabilities isn't an array. Ships 3.3.10. (client PRs #41, #42)
- 2026-07-02: Treat Govee's API as untrusted/inconsistent by design (device-reported metadata, no central contract, two API generations, no schema versioning, firmware drift). Strategy = tolerant parser + structured "learning" logs (`govee.device.skipped` / `govee.capability.dropped` with sku + failing path + received value) to build a per-SKU quirk catalog. Schema should describe what we can use, not what Govee should send. (client PR #43)
- 2026-07-02: Client repo release flow — release.yml sets version from the git tag at publish time (`npm version --no-git-tag-version`); main's package.json is NOT authoritative, the TAG is. Release = tag `vX.Y.Z` + push. Bug found: PR CI (ci.yml) does not run `format:check` but release.yml does → unformatted code merges then breaks the release (hit on v3.3.10; fixed via PR #44, re-tagged). TODO: add format:check to client PR CI.
