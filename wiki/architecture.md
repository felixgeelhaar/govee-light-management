---
updated: 2026-06-09
tags: [architecture]
---

# Architecture

Full reference lives in `CLAUDE.md` (DDD layout, action list, transport layer, build system). This file captures slow-changing notes that don't belong in CLAUDE.md.

## Layering (DDD)

- `backend/domain` — entities (Light, LightGroup), value objects (Scene, SegmentColor, MusicModeConfig/Option), domain services. No external deps.
- `backend/infrastructure` — mappers + repositories (GoveeLightRepository wraps the client).
- `backend/actions` — Stream Deck SingletonActions; filter lights by capability before presenting.
- `frontend` — Vue 3 Property Inspectors (Composition API, XState).

## Build

- Backend: Rollup → single `sdPlugin/bin/plugin.js` (Vite caused packaged-plugin crash-loop; do not revert).
- Frontend: Vite for Property Inspectors.

## Release flow (both repos)

Tag-triggered GitHub Actions. Bump version + push `v*` tag; do NOT `npm publish` manually.

- Plugin: release packs committed files — must bump BOTH `package.json` version AND manifest `Version` (e.g. `2.7.9.0`). 2.7.6 shipped without the manifest bump → store served stale build.
- Client: release workflow syncs version from tag.
