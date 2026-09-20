# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

This file describes the code that exists today. It is an operating manual, not
a changelog — release history lives in `CHANGELOG.md`, working style and
constraints live in `AGENTS.md`.

## Project Overview

A Stream Deck plugin for controlling Govee smart lights. It registers 18
actions (13 keypad classes + 5 encoder classes) that talk to the Govee Cloud
API through `@felixgeelhaar/govee-api-client` (`^3.3.10`). Published on the
Elgato Marketplace; current version is 2.8.0 (`package.json` `version` and the
manifest's `Version` field — `2.8.0.0` — must be bumped together).

Runtime target: Node 20 (the version Elgato's CLI validator pins in the
manifest), TypeScript, ESM.

## How to work in this repo

**Tests first.** The project is test-driven: write the failing test, make it
pass, then refactor. When fixing a bug, add the regression test — or the E2E
invariant — that locks the fix before changing the code.

**Respect the layering.** The backend is domain-driven, and the layers are real
directories:

- `src/backend/domain/` — entities, value objects, repository _interfaces_, and
  pure domain services. No SDK imports, no HTTP, no Stream Deck. This is where
  business rules live and where they are cheapest to test.
- `src/backend/application/` — orchestration over the domain. Today that is
  `services/DeviceService.ts`: discovery caching, capability normalization,
  telemetry.
- `src/backend/infrastructure/` — the adapters. `repositories/GoveeLightRepository`
  implements `ILightRepository` against the Govee client;
  `repositories/StreamDeckLightGroupRepository` implements
  `ILightGroupRepository` against Stream Deck's settings storage; `mappers/`
  convert between domain types and the client's types; `SchedulerEngine.ts`
  sits here too.
- `src/backend/actions/` — the Stream Deck entry layer. Action classes receive
  SDK events and delegate; they own presentation (titles, badges, dial
  feedback) and little else. `actions/shared/ActionServices.ts` is the seam
  they all go through.

Dependencies point inward. An action reaches infrastructure through
`ActionServices`; the domain never reaches outward.

**Filter by capability.** Actions ask `Light` what it supports before offering
it in a Property Inspector dropdown — never present a light whose command would
be rejected.

## Commands

Every script below exists in `package.json`. Nothing else does — in particular
there is no `test:ui` and no `test:server`.

### Build and development

- `npm run build` — Rollup bundle to `com.felixgeelhaar.govee-light-management.sdPlugin/bin/plugin.js`
- `npm run watch` — Rollup in watch mode
- `npm run dev` — `scripts/watch-backend.js`: rebuilds and restarts the plugin on change
- `npm run type-check` — `tsc --noEmit`

### Test

- `npm run test` — Vitest (`vitest`; runs once in CI, watches in a TTY)
- `npm run test:coverage` — Vitest with v8 coverage and the thresholds in `vitest.config.ts`
- `npm run test:e2e` — Playwright against the Property Inspector HTML

### Quality

- `npm run lint` / `npm run lint:fix` — `eslint .` over the whole repo
- `npm run format` / `npm run format:check` — Prettier over `src/**/*.{ts,js,json}`

### Stream Deck

- `npm run streamdeck:validate` / `:pack` / `:link` / `:restart` / `:dev`
- `npm run dev:build` — builds, then `scripts/patch-dev-build.mjs` copies the
  bundle into `com.felixgeelhaar.govee-light-management.dev.sdPlugin` with a
  `.dev` UUID so a development copy can run beside the installed release
- `npm run dev:link` / `dev:restart` / `dev:unlink`
- `npm run prod:pack` — build + `streamdeck pack` into `dist/`

There is no `streamdeck install` command; installation is `streamdeck link`
during development, or opening the packed `.streamDeckPlugin` file.

## Repository layout

```
src/
├── backend/
│   ├── actions/              # entry layer: 18 Stream Deck action classes
│   │   └── shared/           # ActionServices, BaseDialAction, status badge, utils
│   ├── application/services/ # DeviceService (discovery cache + normalization)
│   ├── connectivity/         # ITransport, TransportOrchestrator, cloud/CloudTransport
│   ├── domain/
│   │   ├── entities/         # Light, LightGroup, RgbEffect, ScheduledAction, Sequence
│   │   ├── repositories/     # ILightRepository, ILightGroupRepository (interfaces)
│   │   ├── services/         # LightControlService, LightGroupService, group-fan-out, …
│   │   └── value-objects/    # Brightness, ColorRgb, ColorTemperature, Scene, …
│   ├── infrastructure/
│   │   ├── mappers/          # domain ↔ govee-api-client conversion
│   │   ├── repositories/     # GoveeLightRepository, StreamDeckLightGroupRepository
│   │   └── SchedulerEngine.ts
│   ├── services/             # SchedulerService, SequenceService, EffectService,
│   │                         # GlobalSettingsService, TelemetryService, lifecycle
│   └── plugin.ts             # entry point; registers every action, wires shutdown
└── shared/types/             # types shared between backend and PI payloads

com.felixgeelhaar.govee-light-management.sdPlugin/
├── manifest.json
├── bin/plugin.js             # build output
├── imgs/actions/<name>/      # icon.svg (mono) + key.svg (gradient) per action
└── ui/                       # Property Inspectors: hand-written HTML
    ├── *.html                # one per action
    ├── css/main.css
    └── js/setup.js           # shared PI logic
        js/sdpi-components.js # vendored Elgato component bundle
        js/range-value.js
```

There is no frontend framework in this repository. The Property Inspectors are
plain HTML plus `ui/js/setup.js` and the vendored SDPI web components. There is
no Vue, no Vite, no `src/frontend/`, no `ui/dist/`.

## Actions

Registered in `src/backend/plugin.ts`. UUIDs are prefixed
`com.felixgeelhaar.govee-light-management.`.

### Keypad-first actions

| UUID suffix     | Class                    | Notes                                                            |
| --------------- | ------------------------ | ---------------------------------------------------------------- |
| `lights`        | `OnOffAction`            | On / Off / Toggle, with live state sync and a press epoch guard  |
| `brightness`    | `BrightnessAction`       | Also an encoder (see hybrid actions)                             |
| `color`         | `ColorAction`            | Also an encoder                                                  |
| `colortemp`     | `ColorTemperatureAction` | Also an encoder                                                  |
| `segment-color` | `SegmentColorAction`     | Also an encoder; presets rainbow / solid / gradient over a range |
| `recall`        | `RecallAction`           | Dynamic scenes + DIY scenes + snapshots in one "look" picker     |
| `scene`         | `SceneAction`            | The device's dynamic scenes, fetched per device                  |
| `snapshot`      | `SnapshotAction`         | Govee snapshots saved in the Govee app                           |
| `music-mode`    | `MusicModeAction`        | Device-specific music modes, queried from the API                |
| `toggle`        | `ToggleAction`           | Device toggle capabilities (gradient, nightlight, …) by instance |
| `schedule`      | `ScheduleAction`         | Daily / weekly / delay triggers via `SchedulerService`           |
| `sequence`      | `SequenceAction`         | Multi-step command chains via `SequenceService`                  |
| `custom-effect` | `CustomEffectAction`     | RGB animations driven by `EffectService` / `EffectPlayer`        |

### Encoder actions

`saturation-dial` (`SaturationDialAction`) is a hybrid like the five above it.
The remaining four are the pre-2.7.0 standalone dials, kept registered and
labelled _(legacy)_ in the manifest so existing user bindings keep working:
`brightness-dial`, `colortemp-dial`, `colorhue-dial`, `segment-color-dial`.

### Hybrid keypad + encoder

`brightness`, `color`, `colortemp`, `segment-color` and `saturation-dial`
declare `Controllers: ["Keypad", "Encoder"]`. One UUID serves both: `onKeyDown`
applies a fixed configured value, `onDialRotate` adjusts by a step, `onDialDown`
toggles power.

### Dial step sizes

Read from `settings.stepSize`, clamped in the rotate handler:

| Action                              | Range    | Default |
| ----------------------------------- | -------- | ------- |
| Brightness / Brightness Dial        | 1–25 %   | 5 %     |
| Saturation                          | 1–25 %   | 5 %     |
| Color Temperature / Color Temp Dial | 50–500 K | 100 K   |
| Color / Color Hue Dial              | 1–90°    | 15°     |
| Segment Color / Segment Color Dial  | 1–90°    | 15°     |

## Backend architecture

### `ActionServices` (`actions/shared/ActionServices.ts`)

The largest single file in the backend and the seam every action goes through.
It owns API-key resolution and client construction (`ensureServices`), target
resolution for a light or a group (`parseTarget`, `resolveTarget`), the PI
request handlers (`handleGetDevices`, `handleGetGroups`, `handleSaveGroup`,
`handleDeleteGroup`, `handleRefreshState`, `handleGetDeviceDebug`), command
dispatch (`controlTarget`, `applyToTarget`), dial throttling and deferral
(`deferDialAction`, `cleanupDialTimers`), light-state snapshots and live-state
reads, and the scene / snapshot / music-mode / toggle helpers that wrap the
repository.

### `BaseDialAction` (`actions/shared/BaseDialAction.ts`)

Abstract base for every encoder-capable action. Handles per-context state maps,
a 3 s live-sync interval that is suppressed for 8 s after an interaction,
offline cache-busting with a 30 s minimum gap, power toggling with an epoch
guard against interleaved presses, and `onWillDisappear` cleanup. Subclasses
implement `initValueMaps`, `cleanupValueMaps`, `syncLiveState`, `updateDisplay`,
and optionally `handleCustomPIEvent`.

### Group fan-out and partial failure

`domain/services/group-fan-out.ts` exports `fanOutToLights(lights, apply)`. It
issues every request before awaiting any, settles them all, and returns
`{ total, failed }`. A partial failure resolves — one unreachable lamp must not
discard work that succeeded elsewhere. Only a total failure (or an empty light
list) rejects, and it rejects with the first member's error so callers can still
classify it as validation / rate limit / out of range.

`ActionServices.applyToTarget` runs an operation over a resolved target through
that helper; `reportPartialFailure` and `showPartialFailureBanner` then put a
persistent `⚠ N/M` line under the key title, reverting after 30 s.
`clearPartialFailureBanner(contextId)` must be called from `onWillDisappear`, or
the timer outlives the key.

### Status badge (`actions/shared/status-badge.ts`)

Renders the ●/◐/○ power indicator into the shipped key artwork at runtime.
`KEY_ART_NAMES` lists the `imgs/actions/<name>/` folders wired into the badge,
and a test asserts each one ships a `key.svg`. Visibility is a global
preference: `plugin.ts` reads it once at start-up via `GlobalSettingsService`
and pushes it into `setStatusBadgeVisible`, then re-pushes on
`onDidReceiveGlobalSettings`. The badge module deliberately imports neither the
SDK nor the settings service, which is what keeps it cheap to test.

### Colour temperature and Kelvin (`actions/shared/kelvin-utils.ts`)

- `SAFE_KELVIN_RANGE` is **2700–6500 K**, precision 100. Used only when no
  device has advertised a range. The previous 2000–9000 K default was a guess no
  real device honoured; values outside a device's true range come back as
  "parameter value out of range" (#167).
- `unionKelvinRanges(ranges)` widens a group's dial to the **union** of its
  members' ranges — lowest min to highest max — because a group is applied by
  fanning out one command per light, and each light is clamped to its own range
  at send time in `ActionServices.controlTarget`. A 2200–6500 K lamp grouped
  with a 2700–6500 K lamp gives a 2200–6500 K dial. Precision is the coarsest of
  the members, so every step the dial produces is one each member can land on.
- `normalizeKelvin(k, range)` clamps and snaps to the device's precision step,
  since some devices only accept multiples of 50 or 100 K.
- `kelvinToBarValue` / `kelvinFromPercent` convert between Kelvin and the 0–100
  values the dial feedback bar and the PI slider use.

### Transport layer (`src/backend/connectivity/`)

- `ITransport` — discovery (with a staleness flag), state retrieval, command
  execution, health check, capability query.
- `TransportOrchestrator` — picks a transport by health and latency, aggregates
  discovery across transports, exposes `refreshHealth()` and
  `getHealthSnapshot()`. `NoHealthyTransportError` when nothing is usable.
- `cloud/CloudTransport` — the only transport implemented. Wraps
  `@felixgeelhaar/govee-api-client` and normalizes device capabilities.
  A LAN transport and a WebSocket transport are design intentions, not code.

### `DeviceService` (`src/backend/application/services/DeviceService.ts`)

Discovery cache (default TTL **30 s**, overridable via `cacheTtlMs`), stale-data
handling, capability normalization, and telemetry for discovery and command
timings. On a discovery failure it serves the previous cache rather than an
empty list.

**Concurrent callers share one round trip.** Discovery answers a question about
the account, not about the caller, and every visible key asks it — the dial
live-sync every 3 s, the keypad tracker every 30 s, `resolveTarget` on each
cache miss. Without coalescing, the moment the cache lapsed each key issued its
own request at a rate-limited API. A `forceRefresh` arriving mid-flight joins
that request rather than starting a second.

**Discovery is bounded** (`discoveryTimeoutMs`, default 15 s). The transport
issues a plain fetch with no `AbortSignal`, so a hung connection would otherwise
hold a sync tick open indefinitely. On timeout it takes the same path as a
transport error: cached lights if there are any, an empty list otherwise.

### Shutdown

Stream Deck stops a plugin by signalling its process. `plugin.ts` registers a
shutdown runner (`services/lifecycle.ts`) on SIGTERM and SIGINT, which stops the
scheduler's 30 s engine poll and persists the schedule. Handlers run in order
and are awaited; one failure does not strand the rest, and a second signal is
ignored. Register anything else that owns a process-wide timer the same way.

### Telemetry — accuracy note

`TelemetryService` is a singleton that accumulates discovery, command, and
transport-health counters in memory. `recordCommand` is called from
`DeviceService` and from the five hybrid actions. `getSnapshot()` is exercised
only by tests — nothing in the plugin reads it back, and there is no diagnostics
UI. It is instrumentation, not a working production feature; do not describe it
as one.

## Domain layer

`Brightness`, `ColorRgb` and `ColorTemperature` are **local classes** in
`src/backend/domain/value-objects/`, not re-exports of the API client's types.
`infrastructure/mappers/LightValueMapper` converts between them and the client's
equivalents at the boundary. Only six files import from
`@felixgeelhaar/govee-api-client` at all: `CloudTransport`,
`GoveeLightRepository`, the three mappers, and `deviceStateUtils`. That is the
entire outward dependency surface — keep it that way.

Other value objects: `Scene` (with `sunrise`/`sunset`/`rainbow`/`aurora`/
`movie`/`reading`/`nightlight` factories), `SegmentColor`, `MusicModeConfig`,
`MusicModeOption`, `DynamicSceneOption`, `DiySceneOption`, `SnapshotOption`,
`Schedule`, `SequenceStep`, `EffectFrame`, `ColorPalette`, `LightState`. All are
immutable: private state, static factories that validate, no setters.

Entities: `Light` (capability predicates `canBeControlled`, `supportsScenes`,
`supportsSegmentedColor`, `supportsMusicMode`, `supportsNightlight`,
`supportsGradient` — actions filter the PI light list with these), `LightGroup`,
`RgbEffect`, `ScheduledAction`, `Sequence`.

Domain services: `LightControlService`, `LightGroupService`, `ScheduleService`,
`SequenceExecutor`, `EffectPlayer`, `EffectPresets`, `ColorPaletteService`, and
the `group-fan-out` helper.

Repositories: `ILightRepository` and `ILightGroupRepository` under
`domain/repositories/`, implemented by `GoveeLightRepository` and
`StreamDeckLightGroupRepository`. Every interface method is implemented; there
are no stubs.

`SceneMapper` maps the domain `Scene` factories onto the client's `LightScene`.
`sunrise`, `sunset`, `rainbow`, `aurora` and `nightlight` are supported; `movie`
and `reading` throw with an explanatory message, which `SceneMapper.isSupported()`
lets a caller check first. `MusicModeMapper` maps mode names to Govee's official
mode ids.

**Zero-indexed ids.** Govee mode, segment and toggle instance ids can legitimately
be `0`. Never validate them with `> 0` or `if (!id)`; use
`Number.isInteger(x) && x >= 0`.

## Property Inspectors

One HTML file per action under `sdPlugin/ui/`, sharing `ui/js/setup.js` for the
API-key flow, conditional field visibility, group create/edit/delete, and
datasource status hints. `ui/js/sdpi-components.js` is Elgato's vendored bundle —
third-party, minified, excluded from lint and from security scanning.

### Datasource contract

Plugin → PI dropdown payloads go through `sendPIDatasource` in `ActionServices`,
typed as `PIDatasourceResponse` with a `status` of `ok | empty | error`. On the
PI side `attachFieldStatus` (in `setup.js`) reads that status and surfaces an
inline hint, so an empty or failed fetch never looks like an
unpopulated-but-fine dropdown. `test/e2e/sdpi-invariants.spec.ts` asserts the
structural rule across every PI: an `sdpi-select` with a `datasource` must also
carry a `setting` attribute.

## Build system

The backend builds with **Rollup** (`rollup.config.mjs`), matching Elgato's
official template. This is deliberate and should not be changed back to Vite:
Vite resolved `ws` to its browser export, which crash-looped the packaged
`.streamDeckPlugin`. The Rollup config pins `browser: false` and
`exportConditions: ["node"]`, bundles everything with no externals, minifies
unless `ROLLUP_WATCH` is set, and emits both a `{ "type": "module" }`
`package.json` and a copy of `manifest.json` into `bin/` (the SDK resolves the
manifest relative to `process.cwd()`, which is `bin/` at runtime).

There is no frontend build step.

## Testing

Vitest for unit tests, Playwright for the Property Inspector end-to-end suite.

- 771 unit tests across 48 files (`test/**/*.test.ts`), jsdom environment
- 143 E2E tests across 7 files (`test/e2e/*.spec.ts`), excluded from Vitest

```
test/
├── backend/            # actions/, actions/shared/, connectivity/, services/
├── domain/             # entities/, services/, value-objects/
├── infrastructure/     # mappers/, repositories/, utils/, SchedulerEngine
├── e2e/                # Playwright specs against sdPlugin/ui/*.html
└── setup.ts
```

The domain layer is the best-covered part of the codebase precisely because it
has no external dependencies. New business rules belong there, with their tests,
before any SDK code is touched.

Coverage is measured across **all of `src`** (`all: true`,
`include: ["src/**/*.ts"]`), not just the files a test happened to import.
Importing-only measurement reported 64.56% when the real figure was 34.75%,
flattering exactly the untested files — most action classes still sit at 0%.
The thresholds in `vitest.config.ts` (37% statements, 30% branches, 56%
functions, 37% lines) are a floor set at the measured value, to be raised as
tests are added and never lowered to make a change fit. The floor moved down
once, deliberately: deleting well-tested but unreachable modules lowered the
ratio without lowering the behaviour under test.

## Quality gates

- **Lint**: `npm run lint` is `eslint .` — the whole repository, not just
  `src/`. ESLint 10 flat config with `@typescript-eslint`; no Vue plugin. It
  ignores build output, the dev-link plugin copy, the vendored
  `sdpi-components.js`, Playwright reports, and `*.config.*`. PI scripts get a
  browser-globals block; `scripts/` gets a Node-globals block.
- **Format**: `npm run format:check` (Prettier, `src/**/*.{ts,js,json}`).
- **Tests and build**: Node 20 on Linux, plus Windows and macOS for PRs
  targeting `main`. E2E runs on Linux only.
- **nox 1.39.1** replaces Dependabot as the dependency and security gate. The CI
  job downloads a pinned, SHA256-verified binary, uploads SARIF to code
  scanning, and fails on any critical/high finding not accepted in
  **`.nox-baseline.json`**. That file — not `.nox/`, which is gitignored as a
  scan-artifact directory — holds the reviewed suppressions, each with the
  reason it was accepted. `.nox.yaml` excludes only generated or vendored
  artifacts (the Rollup bundle, `sdpi-components.js`, `package-lock.json`,
  markdown prose), never first-party source.
- **CodeQL** runs on JavaScript with `.github/codeql-config.yml`.
- `npm audit --audit-level high` and `coverctl check` run but do not gate.

There is no Dependabot config and no husky or lint-staged pre-commit hook in
use; `.husky/_` is a leftover of the removed setup. Quality is enforced in CI.

## Release

Releases are tag-triggered GitHub Actions — never `npm publish` by hand. Bump
`package.json` `version` **and** the manifest `Version` (four-part, e.g.
`2.8.0.0`) in the same commit; a manifest-less bump ships a stale build to the
store.

Every new action needs its own `imgs/actions/<name>/icon.svg` (mono) and
`key.svg` (gradient + glow). Never point a new action at another action's
artwork as a placeholder.
