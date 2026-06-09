# AGENTS.md — last updated: 2026-06-09

# Keep under 400 lines. Split overflow to memory/ files.

# Technical architecture/commands live in CLAUDE.md — do not duplicate here. This file is working style + constraints.

## Working Style

Output format: terse, structured; bullets over prose.
Decision style: recommend directly with a default; surface options only when the user's answer changes the outcome.
When stuck: make a call and flag it; ask only for genuinely user-owned decisions (releases, scope).
Review mode: critique hard — this is production software on a public marketplace.

## Project Context

Project: Govee Light Management — enterprise Stream Deck plugin to control Govee smart lights.
Phase: maintenance + incremental features. Live on Elgato Marketplace (approved v2.0.1, April 2026), latest v2.7.9.
Stack: TypeScript, DDD backend (Rollup → single plugin.js), Vue 3 Property Inspectors (Vite), Vitest + Playwright.
Sibling repo: `../govee-api-client` (`@felixgeelhaar/govee-api-client`) — the API layer; bugs often fixed there first.

## Constraints

Never: ship mocks, stubs, or placeholder data in production code (mocks only in tests).
Never: `npm publish` manually — release is tag-triggered GitHub Actions (bump version + push `v*` tag).
Never: bump plugin release without bumping BOTH package.json version AND manifest `Version` (e.g. 2.7.9.0) — manifest-less bump serves a stale store build (2.7.6 lesson).
Never: validate Govee mode/segment/toggle ids with `> 0` or `if (!id)` — ids can be 0 (zero-indexed devices). Use `>= 0` / `Number.isInteger(x) && x >= 0`.
Never: reuse another action's icon path as a placeholder — every new action needs its own `icon.svg` (mono) + `key.svg` (gradient+glow).
Always: strict TDD — RED → GREEN → REFACTOR; failing test before implementation.
Always: respect DDD layering — domain has no external deps; actions filter by capability before presenting lights.
Always: when fixing a bug, add an E2E invariant / regression test that locks it.
Always: PI datasource responses use `sendPIDatasource` with status `ok|empty|error`; sdpi-select with datasource needs a setting attr.

## Known Failure Modes

- Tends to assume mode/index ids start at 1 → correct by validating `>= 0` (H70B6 Floating Mist = id 0).
- Tends to patch symptoms in the plugin when root cause is in the client → check `../govee-api-client` first for API/parse/validation bugs.
- Tends to forget the manifest `Version` field on release → bump package.json + manifest together.
- Tends to branch off a stale main → merge blocked as `BEHIND` (branch protection requires up-to-date branches). Correct by branching off fresh `origin/main`, or rebase + force-push before merge.

## Decision Summary

# 3–5 most consequential decisions. Full log in memory/decisions.md

- 2026-06-09: Music mode ids validated `>= 0` (zero-indexed devices) — client 3.3.9 → plugin 2.7.9.
- (earlier) Backend build on Rollup, not Vite — Vite broke packaged plugin (crash-loop).
- (earlier) API bugs root-caused in sibling client repo first, then plugin dep bump.

## Active Patterns

- "brief me" → /brief (reads ./memory/status.md)
- "capture" → /capture (writes session log, updates status)
- "/mem-compact" → digest sessions older than 30 days
