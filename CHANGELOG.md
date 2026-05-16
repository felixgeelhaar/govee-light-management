# Changelog

All notable changes to this project are documented below. This project adheres to [Semantic Versioning](https://semver.org/).

---

## [2.7.5] - 2026-05-16

### Fixed

- **Feature Toggle no longer reports success when Govee silently no-ops the write** ([#237](https://github.com/felixgeelhaar/govee-light-management/issues/237)). Govee's cloud API returns `200 OK` for `dreamViewToggle` writes on devices that advertise the capability but cannot apply it — most commonly an RGB IC strip (e.g. H6056) without a paired DreamView Sync Box / TV Backlight Kit configured in the Govee app. The plugin previously trusted the 200 and showed a green check while the light strip did nothing. The Toggle action now re-reads the toggle's live state after every write; if the device keeps reporting the opposite of what was requested across three short retries, the optimistic title is reverted, an alert is shown, and a `toggle.verify.mismatch` warning is logged with a hint about the likely cause.

### Changed

- **DreamView feature label clarified** from "DreamView (requires equipment)" to "DreamView (needs paired Sync Box)" so users understand the prerequisite is a specific companion device configured in the Govee app, not just any peripheral.

### Internal

- All `throw new Error(...)` rethrows in `GoveeLightRepository` now attach the original error via `{ cause }`. Preserves the stack chain across the API client boundary, making device-control failures inspectable in logs instead of opaque "Failed to set X: ..." strings.

### Tests

- 4 new unit tests pin `ActionServices.verifyToggleStateApplied`: matched (live state agrees), mismatched (live state stays opposite — the #237 case), unknown (Govee never reports a value), and lag-tolerant (one mismatched read followed by matched reads still returns matched, so normal cloud propagation delay doesn't false-alert).
- 612 unit tests passing, zero TypeScript errors, zero lint errors.

---

## [2.7.4] - 2026-05-14

### Security

- **fast-uri bumped to ≥3.1.2** to close two high-severity advisories pulled in transitively through `@elgato/cli` → `ajv@8.18.0` → `fast-uri@3.1.0` ([GHSA path traversal](https://github.com/advisories) via percent-encoded dot segments, [GHSA host confusion](https://github.com/advisories) via percent-encoded authority delimiters). Both upstream packages are already at their latest versions, so an `overrides` entry in `package.json` pins the patched fast-uri across every transitive path. `npm audit` reports zero vulnerabilities post-fix.

---

## [2.7.3] - 2026-05-14

### Fixed

- **Custom Effect silently rejected group selections.** The Custom Effect Property Inspector exposed groups through the shared `getDevices` datasource, but `EffectService` only renders per-segment frames to a single RGB IC light. Picking a group flashed a runtime alert with no on-screen explanation. The PI now omits the Groups section for Custom Effect, and the runtime guard additionally sets a `⚠ Pick light` title (with alert) for any existing settings that still reference a `group:*` id.
- **Stale API-key cache hid every device on first connect.** Frontend stores the key directly via `setGlobalSettings()`, so the backend's 30-second cache could miss a freshly-connected key. `handleGetDevices` now invalidates and retries once before reporting a missing key.

### Changed

- **Unified power-state glyph across every state-reflective action.** `●` all on, `◐` partial, `○` all off — same shape language for OnOff, Brightness, Color, Color Temperature, Saturation, Segment Color. Previously each action derived the glyph from a mix of power and value-mixing signals, so a group with everyone on at different brightness levels could render `◐` (looked like partial power). Now the glyph is bound strictly to controllable-member power counts.
- **Value-mixed indicator now matches the glyph vocabulary.** Legacy `🔀` (values differ) and `👥` (uniform group) emoji prefixes replaced with `≠ ` and `≡ `, so the LCD value line and the keypad status glyph share a single monochrome geometric language.

### Internal

- New `src/backend/actions/shared/power-state.ts` centralizes `powerGlyph()`, `valuePrefix()`, and the `GroupPowerSummary` type. Every action's `syncLiveState` now writes the same shape, and `BaseDialAction.togglePower` updates the optimistic summary on every group toggle.
- `ActionServices.handleGetDevices` accepts `{ includeGroups: boolean }`. Actions that cannot target a group (currently Custom Effect) opt out of the Groups section at the datasource layer rather than alerting at runtime.

### Dependencies

- chore(deps): bump zod from 4.3.6 to 4.4.3.
- chore(deps-dev): bump @typescript-eslint/eslint-plugin and @typescript-eslint/parser from 8.59.0 to 8.59.1.
- chore(deps-dev): bump eslint from 10.2.1 to 10.3.0.
- chore(deps-dev): bump jsdom from 29.1.0 to 29.1.1.
- ci(deps): bump github/codeql-action from 4.35.2 to 4.35.3.
- ci(dependabot): grant explicit write permissions for auto-merge.

### Tests

- 608 unit tests passing (was 578 in 2.6.1), zero TypeScript errors, zero lint errors.
- New tests: `powerGlyph` + `valuePrefix` cover all three power states and three value-display modes; `handleGetDevices` invariants cover the `includeGroups` filter (default-on + opt-out).

---

## [2.6.1] - 2026-04-29

### Fixed

- **Cross-action power state sync** ([#228](https://github.com/felixgeelhaar/govee-light-management/issues/228)). When Brightness, Color, Color Temperature, Scene, Snapshot, Segment Color, or Music Mode commands turned a light on, the repository only updated the specific property (e.g. `brightness`) but left `isOn` unchanged. The OnOff button and dials still saw `isOn: false` from their shared snapshot, so they showed the wrong indicator (○ instead of ●). Every display/control command now correctly marks `isOn: true` so state propagates across all actions.
- **`verifyLivePowerState` false-negative** ([#228](https://github.com/felixgeelhaar/govee-light-management/issues/228)). After sending a power command, the code polled the API up to 3×200ms to verify the state changed. If Govee's cloud hadn't updated yet (very common), it threw an error which caused a red alert on the Stream Deck key and reverted the cached state to the old value — leaving the title out of sync. Now logs a warning and trusts the optimistic state; periodic live-sync corrects any drift.
- **Property Inspector alignment** — "Change API Key" button and "Metadata" dropdown were not filling the SDPI value column, causing them to appear misaligned with their labels. Added dedicated CSS so both span the full value width and stay centered.

### Tests

- 11 new regression tests covering all repository control commands that should set `isOn=true` after success, plus verification that feature toggles (nightlight, gradient) do not touch `isOn`.
- 578 unit tests passing, zero TypeScript errors, zero lint errors.

---

## [2.6.0] - 2026-04-25

### Added

- **Sequence step builder now supports the full command palette** ([#199](https://github.com/felixgeelhaar/govee-light-management/issues/199)). The Sequence action shipped with only four step commands (On / Off / Toggle / Brightness), so users couldn't compose a "set my default preset" button when wrapped inside Stream Deck's Button Logic action — Button Logic can't nest a Multi-Action, so the Sequence had to stand alone. The step builder now exposes 12 commands matching the keypad action set: Color (hex picker), Color Temperature (Kelvin), Apply Scene (dynamic + DIY, queried per-light), Apply Snapshot, Music Mode (mode + sensitivity), Feature Toggle (gradient / nightlight / DreamView with on/off), Segment Color (per-segment hex), and Play Effect (Rainbow Wave, Pulse, Fade, Strobe, etc.). Each step targets its own light or group, and the Property Inspector refreshes scene/snapshot/music/toggle dropdowns when the step's selected light changes. Existing Sequence settings deserialize unchanged — full backward compatibility.

### Fixed

- **Active RGB effects now stop when any control action fires.** When a Custom Effect (Pulse, Rainbow Wave, Strobe, …) was looping on a light and the user pressed e.g. their On/Off button, the effect kept running — each new frame would re-wake the just-turned-off light because the effect player had no awareness of unrelated commands targeting the same device. The cancel-and-drain hook now runs at every user-command chokepoint (`controlTarget`, `setSegmentColors`, `applyDynamicScene`, `applyDiyScene`, `applySnapshot`, `toggleFeatureRaw`, `applyMusicModeRaw`) so the last in-flight effect frame fully drains before the follow-up command lands. "Off" really turns the light off now.
- **Marketing gallery assets aligned with the gradient key icon design.** Seven gallery SVGs (scene, snapshot, music-mode, toggle, schedule, sequence, custom-effect) shipped as plain monochrome white while the rest of the set used the gradient + glow + dark-rounded-rect key style. Half the keypad grid in `2-actions.png` sparkled and half looked flat — fixed by converting the white SVGs to the established design and regenerating the affected PNGs at 1920×1080. Also fixes one upstream design-system violation: `imgs/actions/snapshot/key.svg` was identical to its monochrome `icon.svg` (every other action's `key.svg` ships the gradient variant).

### Dependencies

- Bumped `@felixgeelhaar/govee-api-client` from 3.3.3 to **3.3.4**, which picks up two upstream fixes:
  - Segmented capability state was silently dropped for every device — `'segment_color_setting'.includes('color_setting')` matched the wrong branch in the cloud-state parser, so `getSegmentColors()` and `getSegmentBrightness()` always returned undefined. RGB IC strips now report their per-segment state correctly.
  - Defensive parsing for malformed capability payloads ([govee-api-client#27](https://github.com/felixgeelhaar/govee-api-client/pull/27), thanks @JoArchie). When Govee returns valid power/brightness alongside fields like `colorTemperatureK: 0` or `lightScene: {}`, the rest of the state response no longer gets rejected — partial-state recovery surfaces the valid fields to actions instead of leaving them blank.

### Tests

- 16 new domain unit tests for the four new Sequence step types (factory validation + JSON round-trip + backward-compat).
- 14 new E2E invariants for the Sequence Property Inspector — locks in the full 12-command palette and the 12 per-command input rows so a regression that breaks the builder UI can't ship silently. Backend would still accept the payload; it's the builder that becomes unreachable.
- 10 new tests around effect auto-cancel: drain semantics on `EffectPlayer.cancelAndWait()` and cancel-before-dispatch invocation order at every chokepoint.
- 567 unit tests passing (was 539 in 2.5.0), 30 feature-PI E2E tests passing, zero TypeScript errors, zero lint errors.

---

## [2.5.0] - 2026-04-24

### Internal refactor — Clean Architecture alignment

No user-facing changes. Groundwork for future features and easier maintenance.

- **Domain now owns its own value objects.** `Brightness`, `ColorRgb`, and `ColorTemperature` are defined inside `src/backend/domain/value-objects/` instead of leaking `@felixgeelhaar/govee-api-client` types throughout the domain and action layers. A new `LightValueMapper` (`src/backend/infrastructure/mappers/LightValueMapper.ts`) handles the domain ↔ API translation at the infrastructure boundary.
- **DeviceService moved to the application layer.** `DeviceService` relocated from `domain/services/` to `application/services/` — it's an application service (orchestrates transports + caching + telemetry), not a domain service, and now sits in the correct layer of the architecture.
- **Datasource option value objects.** New `DiySceneOption`, `DynamicSceneOption`, `MusicModeOption`, and `SnapshotOption` value objects standardize how Property-Inspector dropdown options are modeled across actions.
- **Mapper consolidation.** `SegmentColorMapper` was deleted; its trivial passthrough is now inlined at the single call site. Unused static helpers trimmed from `SceneMapper` and `MusicModeMapper`.

### Testing

- 59 new unit tests for the new value objects and the `LightValueMapper` bidirectional round-trip (480 → **539 unit tests**). E2E suite unchanged at 128 tests.

### Compatibility

- Fully backward-compatible with 2.4.3. No settings migration. All existing actions, groups, schedules, scenes, and custom effects continue to work identically.

---

## [2.4.3] - 2026-04-20

### Fixed

- **DreamView toggle command routing.** DreamView toggle commands were being sent to Govee with the wrong capability type (`devices.capabilities.dreamViewToggle` instead of `devices.capabilities.toggle`), so the command never applied on-device. Fix lands upstream in `@felixgeelhaar/govee-api-client` 3.3.3, which now maps `dreamViewToggle` explicitly and adds a suffix-based fallback (`*Toggle` → `toggle`, `*Scene` → `mode`) so future Govee toggle/mode instances route correctly with no further client patches.

### Dependencies

- Bumped `@felixgeelhaar/govee-api-client` from 3.3.2 to **3.3.3**.

### Release notes

Marketplace stays on 2.4.0 (in review); 2.4.3 is the GitHub patch for users affected by the DreamView command-route bug. Also rolls up the internal quality refactors from #204 (shared cloud-group constant, extracted music-mode parser, Property-Inspector fetch timeouts).

---

## [2.4.2] - 2026-04-20

### Added

- **Number input alongside sliders for direct value entry** ([#200](https://github.com/felixgeelhaar/govee-light-management/issues/200)). Property Inspectors can now opt in via `data-number-input`; a compact number input appears next to the slider and stays in sync with it. Values are clamped to min/max and snapped to step on commit. Opted-in PIs: Brightness (0–100%), Color Temperature (0–100% mapped to device range), Saturation Dial stepSize (1–25%).

### Testing

- 10 new E2E tests: input presence, min/max/step inheritance, slider/input sync, clamping, and confirmation that PIs without `data-number-input` are unaffected (118 → **128 E2E tests**).

### Compatibility

- Fully non-breaking. Dial PIs, music-mode sensitivity, schedule duration, and any PI that doesn't opt in behave identically to 2.4.1.

---

## [2.4.1] - 2026-04-20

### Fixed

- **Snapshot buttons now actually change light state** ([#198](https://github.com/felixgeelhaar/govee-light-management/issues/198)). Snapshot actions showed the green confirmation mark but never applied the snapshot on-device. Fix lands upstream in `@felixgeelhaar/govee-api-client` 3.3.2, which sends `SnapshotCommand` as a bare numeric ID (matching the DIY scene fix pattern from 3.3.0). `CommandFactory` accepts both shapes on deserialization so existing configured snapshot buttons continue to load without migration.

### Dependencies

- Bumped `@felixgeelhaar/govee-api-client` from 3.3.1 to **3.3.2**.

### Release notes

Marketplace stays on 2.4.0 (in review); 2.4.1 is the GitHub patch for users affected by #198.

---

## [2.4.0] - 2026-04-19

### Release type

Cumulative marketplace rollup. No new code versus 2.3.2 — this is a single coherent version bundling everything shipped since the marketplace-approved 2.1.3, so the Elgato Maker Console review happens once instead of seven times.

### Bundled since 2.1.3

- **From 2.1.4**: dial state sync, overlay-mode clearing before solid-color commands.
- **From 2.2.0**: Schedule, Sequence, and Custom Effect actions; color palettes and recent-colors tracking; device classifier and capability registry.
- **From 2.3.0**: DIY scenes in the Scene action; device metadata panel in every PI; typed `sendPIDatasource` datasource contract; E2E suite expanded from 33 to 118 tests across all 17 PIs.
- **From 2.3.1**: DIY-endpoint fix and online-capability parsing in `@felixgeelhaar/govee-api-client` 3.3.0.
- **From 2.3.2**: generic `DeviceState.getToggle(instance)` fix so DreamView toggle live state reads correctly.

### Test counts

- **Plugin**: 492 unit + 118 E2E tests.
- **Client** (`@felixgeelhaar/govee-api-client`): 691 tests (up from 677 at the start of the cycle).

### Dependencies

- `@felixgeelhaar/govee-api-client` on **3.3.1**.

### Upgrade notes

Coming from 2.1.3 (marketplace): no settings migration required. Six new actions appear in the Stream Deck action panel; existing actions, groups, schedules, and saved scenes carry over. Coming from an intermediate 2.3.x on GitHub: transparent upgrade.

---

## [2.3.2] - 2026-04-18

### Fixed

- **DreamView toggle live state reads correctly** ([#197](https://github.com/felixgeelhaar/govee-light-management/pull/197)). `GoveeLightRepository.getToggleState` had a switch that hardcoded `nightlightToggle` / `gradientToggle` / `sceneStageToggle`; the default branch returned undefined, so the Toggle action's button title always showed the wrong on/off indicator for `dreamViewToggle` (the RGB IC DreamView feature). `@felixgeelhaar/govee-api-client` 3.3.1 exposes every toggle instance via a generic `DeviceState.getToggle(instance)`; the repository now uses that single call so DreamView reads correctly and any future toggle instance Govee adds works with zero plugin changes.

### Dependencies

- Bumped `@felixgeelhaar/govee-api-client` from 3.3.0 to **3.3.1**.

---

## [2.3.1] - 2026-04-18

### Fixed

- **DIY scenes actually load** ([#194](https://github.com/felixgeelhaar/govee-light-management/pull/194)). 2.3.0 advertised DIY scene support, but the installed client (3.2.0) hit `/router/api/v1/device/scenes` — the wrong endpoint for DIY. For most users, DIY scene dropdowns in 2.3.0 silently returned empty. `@felixgeelhaar/govee-api-client` 3.3.0 fixes the DIY endpoint (`/router/api/v1/device/diy-scenes`), tolerates mixed scene value shapes, adds a capability-based snapshot fallback for H61E5-class devices, and starts parsing the Govee `online` capability so `DeviceState.online` reflects the actual reported state instead of being hardcoded to `true`.

### Dependencies

- Bumped `@felixgeelhaar/govee-api-client` from 3.2.0 to **3.3.0**.

### Release notes

Version bumps and dep upgrade only — no plugin code changes. 492 unit + 118 E2E tests pass.

---

## [2.3.0] - 2026-04-18

### Added

- **DIY scenes in the Scene action** ([#181](https://github.com/felixgeelhaar/govee-light-management/pull/181)). Govee-app DIY scene creations now appear in the Scene action dropdown alongside built-in dynamic scenes, labeled with `(DIY)` so they're easy to spot.
- **Device metadata panel** ([#175](https://github.com/felixgeelhaar/govee-light-management/pull/175)). New debug section in every Property Inspector with click-to-copy device IDs, capability lists, and raw model strings — makes it much easier to file useful bug reports.

### Fixed

- **Property Inspector dropdowns surface real status** ([#182](https://github.com/felixgeelhaar/govee-light-management/pull/182), [#185](https://github.com/felixgeelhaar/govee-light-management/pull/185)). Dropdowns now explain _why_ a list is empty (no device selected vs. device has no options vs. API error) instead of the misleading "Select a device first" placeholder. Covers Scene, Snapshot, Music Mode, Toggle, Device, and Custom Effect dropdowns.
- **Sequence builder polish and Custom Effect fix** ([#184](https://github.com/felixgeelhaar/govee-light-management/pull/184)). Custom Effect presets now load (datasource wiring mismatch fixed). Sequence delay steps use seconds instead of milliseconds; step list shows friendly device names and command labels instead of raw IDs; dropdowns match plugin styling.
- **Cloud pseudo-groups filtered from discovery** ([#189](https://github.com/felixgeelhaar/govee-light-management/pull/189), closes [#186](https://github.com/felixgeelhaar/govee-light-management/issues/186), [#188](https://github.com/felixgeelhaar/govee-light-management/issues/188)). `BaseGroup`, `SameModelGroup`, and `SameModeGroup` entries were selectable as lights but silently failed every command. Removed from discovery; clear error hint if a stale selection still points at one.
- **Snapshot and Music Mode dropdowns on capability-driven devices** ([#187](https://github.com/felixgeelhaar/govee-light-management/pull/187)). Devices like the H61E5 expose options through nested capability fields rather than the simpler scenes endpoint.
- **Sequence step Device dropdown populates** ([#193](https://github.com/felixgeelhaar/govee-light-management/pull/193), closes [#190](https://github.com/felixgeelhaar/govee-light-management/issues/190)). Was missing the `setting` binding SDPI needs to fire its datasource subscription.

### Quality & process

- **Typed `sendPIDatasource` contract** ([#191](https://github.com/felixgeelhaar/govee-light-management/pull/191)). Every Property-Inspector datasource response must include an explicit `status: "ok" | "empty" | "error"` — it's now a compile-time error to ship one without. E2E suite expanded from 33 to **118 tests across all 17 PIs**, including SDPI invariants (every `sdpi-select` with a datasource has a `setting` attribute).
- **PR template hardware-dogfood section + weekly stale-review sweep workflow** ([#192](https://github.com/felixgeelhaar/govee-light-management/pull/192)). Contributors now describe concrete end-to-end testing on real Govee hardware; a weekly workflow flags PRs/issues where a maintainer response is overdue by 7+ days.

### Housekeeping

- `package-lock.json` version synced from a stale 2.1.3 to match `package.json`.

---

## [2.2.0] - 2026-04-17

### Major Features — 5 new capabilities across 3 new actions

#### Enhanced Color Picker

- **Color Palettes** — 4 preset palettes (Warm, Cool, Pastel, Vivid) with 20 curated colors
- **Recent Colors** — Auto-tracks the last 10 colors you applied, persists across sessions
- **Click-to-Apply** — Swatches in the Color action property inspector
- **Clear Recent** — One-click reset for recent colors

#### Scheduling System

- **New Schedule Action** — Time-based automation for any light or group
- **3 schedule types**:
  - **Daily** — Fire at HH:MM every day
  - **Weekly** — Fire on selected days (Mon-Sun chip selector)
  - **Delay** — Fire N seconds after button press
- **Press to toggle** — Press the Stream Deck button to enable/disable
- **Background scheduler** — 30-second polling loop fires scheduled actions automatically
- **Persistent** — Schedules survive plugin restarts via global settings

#### Multi-Action Sequences

- **New Sequence Action** — Chain multiple light commands with delays
- **Step Builder UI** — Add action steps or timing delays (up to 5 min)
- **Commands supported**: on, off, toggle, brightness
- **Reorder** — Up/down controls for step arrangement
- **Press to run** — Press again to cancel mid-sequence
- **Error-resilient** — Continues through individual step failures

#### Custom RGB Effects

- **New Custom Effect Action** — Play animated lighting effects on RGB IC strips
- **4 built-in presets**:
  - **Rainbow Wave** — 36-frame looping hue rotation
  - **Pulse** — Fading brightness loop
  - **Fade** — 20-step color transition
  - **Strobe** — On/off flashing
- **Live preview** — Property inspector shows 15-segment color strip
- **Concurrent playback** — Different effects on different lights simultaneously
- **Once/Loop modes** — Effects auto-loop or play once

#### Device Capability Improvements

- **Device Classifier** — Automatic detection of Bulb, LED Strip, Light Bar, or Floor Lamp from model number
- **Capability Registry** — Centralized metadata with helpful descriptions for all 8 capabilities
- **Better error messages** — "My Light (LED Strip) doesn't support music mode. Music mode is available on most RGB-capable lights with a built-in microphone."
- **Extended cache TTL** — Device discovery cache doubled from 15s to 30s, reducing API calls

### Technical Improvements

- **Domain-Driven Design** — 3 new entities, 5 new value objects, 8 new domain services
- **Test Coverage** — 177 new tests (56% increase: 311 → 488)
- **Clean Architecture** — Phase-based development with independent PRs
- **Zero regressions** — All existing functionality preserved

### Stream Deck Action Count

- **v2.1.4**: 14 actions (9 keypad + 5 dial)
- **v2.2.0**: 17 actions (12 keypad + 5 dial)
- New actions: Schedule, Sequence, Custom Effect

### Compatibility

- Fully backward-compatible with v2.1.x
- Existing settings preserved
- Same API key, same devices, same workflows

---

## [2.1.4] - 2026-04-17

### Bug Fixes

- **Fixed dial state sync** — Dials now properly detect and read current light state on first appear
  - Resolves issue where dial values would default to 50% even if light was off
  - `syncLightState()` now returns boolean to indicate successful sync
  - Better handling of offline devices during initial state loading
- **Improved brightness dial display** — Shows "Off" when light is powered off instead of brightness percentage
- **Fixed overlay mode clearing** — Brightness and other actions now properly clear gradient/nightlight overlays before setting solid colors (issue #170)

### Performance

- Reduced state sync failures by adding fallback to cached state data
- Better offline device handling prevents timeout delays

---

## [2.1.3] - 2026-04-17

### Major Features

#### Stream Deck+ Encoder Enhancements

- **New: Saturation Dial** — Control color intensity from pure white (0%) to full saturation (100%)
  - Perfect companion to the Color Hue dial for precise color control
  - Configurable sensitivity (1-10% per tick)
  - Live state sync shows current saturation level
  - Works with both individual lights and light groups

#### Comprehensive Group Support

- **Full Dial Support for Groups** — All 5 Stream Deck+ dials now work seamlessly with light groups:
  - Select a group in any dial's property inspector
  - Live state sync reflects the combined group state
  - Press dial to toggle power on entire group
  - Rotate to control all lights simultaneously
- **Music Mode Groups** — `MusicModeAction` now supports light groups
  - Apply music-reactive lighting to entire rooms
  - All lights in group respond together
  - Same device-specific mode and sensitivity configuration

- **Feature Toggle Groups** — `ToggleAction` now supports light groups
  - Toggle Nightlight, Gradient, DreamView, Scene Stage on entire groups
  - Auto-filtered features based on group capabilities
  - Same one-tap simplicity as individual light toggles

### Improvements

- Enhanced group state handling for more accurate reflected status
- Improved compatibility across all actions with groups
- Better error reporting for group operations

### Fixes

- Fixed group state reading for mixed-capability lights (some support brightness, others don't)
- Improved fallback behavior when some lights in group are offline
- Better handling of capability differences within a group

### Dependencies

- Updated `@felixgeelhaar/govee-api-client` to v3.2.0
- All development dependencies kept current

---

## [2.1.2] - 2026-04-10

### Fixes

- Fixed dialAction state sync to properly read current saturation and hue from device
- Improved error handling when lights report incomplete capability data
- Better handling of stale device cache during rapid actions

### Performance

- Reduced API calls during dial state sync by 20%
- Improved caching strategy for device discovery

---

## [2.1.1] - 2026-04-03

### Critical Fixes

#### Govee Group Entry Crash

- **Fixed crash with Govee group entries** — Accounts with device groups (BaseGroup, SameModeGroup, DreamViewScenic) no longer crash the plugin
  - The Govee API returns group objects that lack required device capability fields
  - Strict schema validation was rejecting entire discovery responses
  - Plugin now gracefully skips invalid group entries
  - Discovery continues from other transports instead of failing completely

### Infrastructure Improvements

- **Resilient Transport Layer** — Individual transport failures no longer block discovery
- **Cached Fallback** — If discovery fails, plugin falls back to cached device data instead of showing empty dropdowns
- **Better Error Recovery** — More graceful degradation when API is temporarily unavailable

### Testing

- Added tests for Govee group entry handling
- Improved discovery failure recovery tests

---

## [2.1.0] - 2026-03-28

### Major Features

#### Three New Keypad Actions

- **Scene Action** — Apply dynamic scenes to lights with device-specific scene discovery
  - Sunrise, Sunset, Rainbow, Aurora, Nightlight, and more
  - Scenes are fetched live from each device
  - Only shows scenes that the selected light actually supports
  - Beautiful property inspector with emoji-enhanced scene names

- **Music Mode Action** — Activate audio-reactive lighting
  - 4 device-specific music modes: Rhythm, Energic, Spectrum, Rolling
  - Adjustable audio sensitivity (0-100%)
  - Auto-color toggle for automatic color cycling
  - Perfect for parties and entertainment

- **Feature Toggle Action** — One-tap control for light features
  - Nightlight mode (soft ambient lighting)
  - Gradient mode (color gradient effects)
  - DreamView mode (voice-controlled scenes)
  - Scene Stage mode (synchronized scenes)
  - Features auto-filtered by device capability

#### Stream Deck+ Dial Improvements

- **Live State Sync** — Dials now read the actual state of your lights when they appear
  - No more starting at default values
  - Shows true brightness, color temperature, hue, and saturation
  - Perfect for switching between devices mid-session

- **Power Toggle on Press** — Press any dial to toggle power on/off
  - Consistent with keypad On/Off action
  - Same visual feedback system

- **Visual Feedback System** — All dials provide clear status indicators
  - Green flash = command succeeded
  - Red flash = error (check API key, network, light status)
  - Smooth visual response to every action

- **Deferred Updates** — Display updates instantly while light catches up
  - Zero lag, responsive feel
  - Rotation feels buttery smooth even at 100ms latency

### Action Enhancements

- **Enhanced LightControlAction** — Added 4 new control modes
  - `nightlight-on` / `nightlight-off` — Toggle nightlight mode
  - `gradient-on` / `gradient-off` — Toggle gradient effect
  - Total of 10 supported control modes
  - Better title generation for new modes

### Property Inspector Improvements

- New Vue 3 components: `SceneControlView`, `MusicModeView`, `SegmentColorDialView`
- Improved light filtering by capability
- Real-time settings persistence via WebSocket
- Better form validation and user feedback

### Repository Interface Expansion

Extended `ILightRepository` with new methods:

- `applyScene(light, scene)` — Apply a dynamic scene
- `setMusicMode(light, config)` — Set music-reactive mode
- `toggleNightlight(light, enabled)` — Toggle nightlight
- `toggleGradient(light, enabled)` — Toggle gradient
- `getDynamicScenes(light)` — Get device-specific scenes
- `setSegmentColors(light, segments)` — Set RGB segment colors
- `setLightScene(light, scene)` — Apply preset scene

All methods fully implemented using govee-api-client v3.1.13.

### Domain Layer Expansion

New domain value objects for advanced features:

- **Scene** — Immutable scene configuration with factory methods
- **SegmentColor** — RGB IC light segment configuration
- **MusicModeConfig** — Music mode settings with 4 supported modes

New domain services:

- **SceneService** — Manage scene application and capability checking
- **DeviceService** — High-level device operations with caching and capability normalization

New infrastructure mappers:

- **SceneMapper** — Domain Scene to API LightScene conversion
- **MusicModeMapper** — MusicModeConfig to API MusicMode mapping
- **SegmentColorMapper** — Bidirectional segment color mapping

### Testing

- Added 172 new tests for v2.1.0 features (160 → 332 total)
  - Domain value objects: 85 tests (Scene, SegmentColor, MusicModeConfig)
  - Domain services: 15 tests (SceneService)
  - Stream Deck actions: 72 tests (Scene, Music, SegmentDial, LightControl enhancements)
- 100% test passing rate with comprehensive coverage

### Documentation

- Created comprehensive guides for all new features
- Updated README with new action descriptions
- Added advanced features documentation
- Property inspector help sections for each new action

### Deprecations

- Old template files removed (govee-api.ts, increment-counter.ts, open-product-page.ts)

---

## [2.0.0] - 2026-02-20

### Breaking Changes

- **Backend Build System Migration** — Switched from Vite to Rollup for backend bundling
  - Fixes packaged `.streamDeckPlugin` files crash-loop issue
  - Correct Node.js module resolution (browser: false)
  - Single bundled output with no external dependencies
  - ESM output with proper export handling

### Major Features

#### Stream Deck+ Encoder Support

- **Brightness Dial** — Rotate to adjust brightness (1-100%), press to toggle power
  - Configurable step size (1-25% per tick)
  - Purple-to-blue gradient feedback bar
  - Live brightness percentage display

- **Color Temperature Dial** — Rotate to adjust warmth (2000K-9000K), press to toggle power
  - Configurable step size (50-500K per tick)
  - Warm amber-to-cool blue gradient feedback
  - Live temperature in Kelvin display

- **Color Hue Dial** — Rotate through full spectrum (0-360°), press to toggle power
  - Configurable step size (1-90° per tick)
  - Configurable saturation (0-100%)
  - Rainbow gradient feedback bar
  - Full HSV color space support

- **Segment Color Dial** — Rotate for hue, press to apply to segment
  - Target specific RGB IC light segments (1-15)
  - Configurable hue sensitivity
  - Live color preview
  - Per-segment color control

### Action Improvements

- All keypad actions now have consistent property inspector UI
- Better light discovery with capability filtering
- Improved error messages and validation

### Architecture

- Complete Domain-Driven Design implementation
- Clean separation: Domain → Infrastructure → Application layers
- Pluggable transport abstraction for future connectivity options
- DeviceService with intelligent caching (15s TTL)
- TelemetryService for metrics and observability

### Infrastructure

- Govee API integration via `@felixgeelhaar/govee-api-client`
- Rate limiting and exponential backoff
- Circuit breaker pattern for API resilience
- Health monitoring with periodic checks

### Frontend

- Vue 3 with Composition API
- XState machines for complex workflows
- WebSocket communication
- DiagnosticsPanel component for system health
- Real-time state management

### Testing

- 160+ unit and integration tests
- Vitest with jsdom environment
- Playwright end-to-end tests
- 80%+ code coverage target
- Red-Green-Refactor TDD approach

### CI/CD

- GitHub Actions workflow
- Automated testing on every push
- CodeQL security scanning
- Dependabot for dependency management

---

## [1.0.0] - 2026-01-15

### Initial Release

#### Core Features

- **On/Off Action** — Toggle lights with state indicators (● on, ○ off, ◐ mixed)
- **Brightness Action** — Set brightness 0-100% (0% = off)
- **Color Action** — Set RGB color via hex picker
- **Color Temperature Action** — Set warmth 2000K-9000K
- **Segment Color Action** — Rainbow, solid, or gradient patterns on RGB IC strips

#### Group Management

- **Create Groups** — Custom light groups with intuitive interface
- **Edit Groups** — Modify names and included lights
- **Delete Groups** — With confirmation prompts
- **Visual Indicators** — ●/○/◐ for group states

#### Architecture

- Enterprise-grade SOLID principles
- TypeScript for type safety
- Comprehensive error handling
- Stream Deck SDK integration

#### Developer Experience

- `npm run watch` for hot reload
- Comprehensive test suite
- ESLint + Prettier formatting
- Husky pre-commit hooks

---

## Format Notes

- **[MAJOR]** indicates breaking changes
- **[MINOR]** indicates new backwards-compatible features
- **[PATCH]** indicates backwards-compatible bug fixes
- **[Deprecated]** indicates features being phased out

For questions about releases, check the [GitHub Releases](https://github.com/felixgeelhaar/govee-light-management/releases) page.
