---
updated: 2026-06-09
---

## Current State

Enterprise Stream Deck plugin for Govee lights, shipping on the Elgato Marketplace (approved at v2.0.1, April 2026). Latest release **v2.7.9**. Active, well-tested codebase (DDD + strict TDD, 620 plugin unit tests + E2E). Sibling `@felixgeelhaar/govee-api-client` (latest 3.3.9) holds the API layer; bugs often root-cause there first.

## Last Session Summary

Fixed issue #250 (Floating Mist mode id 0 silently failed on H70B6 — zero-indexed music modes). Client `MusicMode` rejected id 0; fixed (`< 0`) → released client v3.3.9 → bumped plugin → released v2.7.9. Customer comment posted.

## Next Session Should

Confirm v2.7.9 propagated to Elgato store; watch #250 for reporter confirmation that Floating Mist now triggers.

## Blocked / Waiting

- Elgato store rollout of v2.7.9 (out of our hands; lag observed in prior releases)
