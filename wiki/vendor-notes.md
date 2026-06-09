---
updated: 2026-06-09
tags: [vendors, reference]
---

# Vendor Notes

## Govee public Developer API

- Endpoint: `https://openapi.api.govee.com/router/api/v1/user/devices` (capability list per device).
- Public API is poorer than the Govee mobile app's private API — some modes/scenes the app shows aren't exposed publicly.
- **Mode ids can be zero-indexed.** H70B6 (Curtain Lights Pro) Floating Mist = mode id `0`. Validate `>= 0`, never `> 0`.
- Scene capability shapes vary: some devices omit `dataType` / return unmodeled DIY shapes. Parse resiliently (skip odd entries, don't fail the whole response).
- Multi-outlet devices (HS5089) use indexed toggle instances (`socketToggle1/2`); route/validate by `/Toggle\d*$/`, not `endsWith('Toggle')`.

## @felixgeelhaar/govee-api-client (sibling repo)

- Separate repo at `../govee-api-client`. API/parsing/validation bugs usually root-cause HERE first, then bump the plugin dep.
- Enterprise client: rate limiting, retry w/ backoff, circuit breaker, Zod validation.
- Latest: 3.3.9 (mode id 0 accepted).
