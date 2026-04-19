# Govee Light Management — v2.4.0

**Release date:** 2026-04-19

v2.4.0 is a cumulative rollup of every improvement shipped since the
marketplace-approved v2.1.3. Marketplace users jumping from v2.1.3 → v2.4.0
get six new actions, one new feature panel, a dozen user-reported bug fixes,
and a complete quality-guardrail infrastructure — all in a single coherent
submission.

---

## ⭐ Highlights

- **6 new actions** — Schedule, Sequence, Custom Effect (new this cycle) plus Snapshot, Saturation Dial, and the Scene action's DIY scene support
- **Device Metadata Panel** — new debug section in every Property Inspector with click-to-copy device IDs
- **Silent failures are a thing of the past** — Property Inspector dropdowns now explain _why_ a list is empty (no device selected vs. device has no options vs. API error) instead of showing a misleading placeholder
- **DIY scenes actually work** — your Govee-app DIY creations now appear in the Scene action dropdown
- **dreamViewToggle and other RGB IC features read correct live state** — button title on/off indicators are accurate
- **Smarter offline detection** — the plugin now knows when a light is genuinely unreachable instead of assuming it's online
- **Sequence builder overhaul** — seconds instead of milliseconds, friendly device names in step rows, proper dropdowns
- **Color palette & recent colors** — preset palettes (Warm, Cool, Pastel, Vivid) plus an auto-tracked recent-colors strip
- **Extensive quality infrastructure** — typed PI datasource contract, 118 E2E tests across all 17 PIs, SDPI invariant checks, weekly stale-review workflow

---

## 🆕 New Actions

### Keypad actions

- **Snapshot** (v2.1.4) — Recall saved light presets from your Govee app with a single press. Dropdown auto-populates from your device's available snapshots.
- **Schedule** (v2.2.0) — Time-based automation: daily at HH:MM, weekly on selected days, or delayed triggers. Press to enable/disable; schedules persist across plugin restarts.
- **Sequence** (v2.2.0) — Chain multiple light commands with configurable delays (step builder with visual ordering). Press to run, press again to cancel.
- **Custom Effect** (v2.2.0) — Play animated RGB effects on IC strips. Four built-in presets (Rainbow Wave, Pulse, Fade, Strobe) with live preview in the Property Inspector.

### Stream Deck+ dial actions

- **Saturation Dial** (v2.1.3) — Rotate to control color intensity from pure white to full saturation. Perfect companion to the Hue dial for precise color tuning.

### Enhanced existing actions

- **Scene action** now shows **DIY scenes** alongside built-in dynamic scenes in a single dropdown, labeled with `(DIY)` so they're easy to spot.
- **Color action** gained **preset palettes** (Warm, Cool, Pastel, Vivid — 20 colors) and a **recent-colors strip** that auto-tracks your last 10 picks with a one-click clear.

---

## 🔧 Fixes

### Property Inspector reliability

- **Dropdowns explain themselves.** When a device has no scenes / snapshots / music modes / toggleable features, the dropdown shows a clear message instead of the misleading "Select a device first" placeholder. Backend errors (bad API key, network down) show a distinct error hint. Covers Scene, Snapshot, Music Mode, Toggle, Device, and Custom Effect dropdowns.
- **Custom Effect presets now load.** v2.2.0 shipped with a datasource wiring mismatch that prevented the effect list from populating.
- **Sequence step Device dropdown populates.** Was missing the binding SDPI needs to fire its datasource subscription.
- **Snapshot and Music Mode work on capability-driven devices.** Devices like the H61E5 expose options through nested capability fields rather than the simpler scenes endpoint.

### Device control

- **DIY scenes reach the correct Govee endpoint.** v2.3.0 advertised DIY scene support but the underlying API call was hitting the wrong path; DIY dropdowns silently returned empty for nearly every user.
- **dreamViewToggle live state reads correctly.** Button title state indicator (`●`/`○`) now matches reality for RGB IC DreamView, along with any other toggle instance exposed by newer firmware.
- **Accurate offline detection.** `DeviceState.online` now reflects the actual Govee capability value instead of being hardcoded to true whenever a response came back.
- **Cloud pseudo-groups filtered out.** Entries like `BaseGroup`, `SameModelGroup`, and `SameModeGroup` were selectable as lights but silently failed every command. Now removed from discovery, with a clear error hint if a stale selection still points at one.
- **Color temperature mapped to device capability range.** Slider 0-100% now maps to each device's advertised Kelvin range (read from the cloud) instead of a hardcoded 2000-9000K window, fixing silent "parameter value out of range" rejections on narrower-range devices.
- **Overlay modes cleared before solid-color commands.** Gradient and nightlight overlays are cleared so a color or brightness command doesn't fight an active effect.
- **Group support across the board.** Music Mode, Feature Toggle, Scene, Snapshot, and all five Stream Deck+ dials now work with plugin-managed light groups the same way they work with individual lights.

### Sequence builder polish

- Delay steps use **seconds** instead of milliseconds for readability
- Step list shows **friendly device names and command labels** instead of raw IDs
- Dropdowns styled consistently with the rest of the plugin

---

## 🏗️ Under the hood

This release ships more than features — it ships the infrastructure to keep future features reliable.

- **Typed `sendPIDatasource` contract** makes it a **compile-time error** to ship a Property Inspector datasource response without an explicit `status: "ok" | "empty" | "error"`. The entire class of silent-empty-dropdown bugs that reached v2.2.0 users cannot recur.
- **E2E test suite** expanded from 33 to **118 tests across all 17 Property Inspectors**. Covers DOM wiring, datasource attribute correctness, SDPI invariants (every `sdpi-select` with a datasource has a `setting` attribute), and behavior tests that dispatch mock backend responses to assert the field-hint UI renders correctly.
- **sdpi-invariants test** catches a full class of regression: if anyone ships a PI dropdown with a `datasource` but no `setting` attribute, CI fails (the pattern that broke the Sequence step Device dropdown).
- **PR template enforces hardware dogfooding.** Contributors now describe concrete end-to-end testing on real Govee hardware rather than checking a generic "works" box.
- **Weekly stale-review sweep workflow** flags PRs and issues where a maintainer response is overdue by 7+ days, preventing contributor PRs from going cold.

### Test counts

- **Plugin:** 492 unit tests + 118 E2E tests
- **Dependency (`@felixgeelhaar/govee-api-client`):** 691 tests (up from 677 at the start of the cycle)

---

## 📦 Dependencies

- `@felixgeelhaar/govee-api-client` bumped to **3.3.1** with the DIY-endpoint fix, online capability parsing, snapshot fallback for capability-driven devices, mixed-scene-value tolerance, and generic toggle/mode state accessors

---

## 🙏 Credits

Meaningful contributions in this cycle from **@JoArchie** — Sequence builder overhaul, DIY scenes, device metadata panel, cloud pseudo-group filtering, capability-driven snapshot/music mode support. Bug reports that drove fixes: **@warlikcookie82** (SameModelGroup handling, sequence dropdown, color temperature range), **@PnnnG** (snapshot empty states), **@StevenTender** (v2.1.3 loading diagnostics that informed capability parsing).

---

## 🔄 Upgrade notes

**Coming from v2.1.3 (marketplace):** No settings migration required. All existing actions continue to work exactly as configured. The Snapshot, Schedule, Sequence, Custom Effect, and Saturation Dial actions appear as new options in the Stream Deck action panel. Existing groups, scheduled tasks, and saved scenes carry over.

**Coming from an intermediate v2.3.x on GitHub:** Transparent upgrade. The v2.3.1 DIY-endpoint fix and v2.3.2 dreamViewToggle fix are included; no user action required.
