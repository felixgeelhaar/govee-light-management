# Govee Light Management — v2.7.0

**Release date:** 2026-05-01

v2.7.0 is the "groups actually work" release. Cross-action state sync,
three-state titles, partial-failure feedback, automatic recovery from
offline members, and dependency upgrade to a patched
`@felixgeelhaar/govee-api-client` v3.3.5 that stops `findState` from
crashing on non-IC devices that advertise the segment-color descriptor
with a non-array value.

---

## ⭐ Highlights

- **Three-state group title on On/Off keys** — `●` all on, `◐` mixed, `○` all off, with an `N/M` count below. Mixed groups no longer lie about their state.
- **Persistent partial-failure banner** — when a group apply (Music Mode, Scene, Toggle, Snapshot, Segment Color) succeeds for some members and fails for others, the key title shows `⚠ N/M failed` for 30 seconds instead of a misleading 1-second `showOk` flash.
- **Group offline recovery** — power-cycling a group member used to require a plugin restart to update the title denominator. Now the next periodic tick (≤30 s) busts the discover cache and the recovery shows up automatically.
- **Cross-action state sync for groups** — toggling a group from one action now updates the shared snapshot for every member, so dials and other keys pointed at the same lights see the new state immediately.
- **Cloud-group transparency** — Govee `BaseGroup` / `SameModelGroup` / `SameModeGroup` entries are surfaced in the device dropdown as a disabled optgroup with a count hint, instead of being silently filtered. Users no longer wonder why their Govee app groups don't appear.
- **`findState` no longer crashes** on devices that report segmented-color capabilities with non-array values (H6056 and others).
- **Sidebar reorder for serial-position discoverability** — Quick Control (On/Off, Brightness, Color, Color Temperature) at the top, automation (Schedule, Sequence) at the bottom, dials grouped together.
- **Direct numeric input next to range sliders** — type `42` instead of dragging — wired into Music Mode sensitivity, Color Hue saturation/step, Color Temp dial step, Brightness dial step, Saturation dial step, Segment Color hues, Schedule brightness.
- **PI dropdowns reuse the 30 s discover cache** — opening a Property Inspector no longer blocks for 6–10 s on a fresh `/user/devices` round-trip.

---

## 🐛 Bug Fixes

### Group-aware actions

- **Music Mode, Scene, Toggle, Segment Color, Snapshot now show alerts when group applies fail entirely.** Before: every member failed → `showOk` flash. After: zero members succeeded → `showAlert`. Toggle additionally reverts its optimistic state when nothing changed.
- **Segment Color (keypad) now supports groups.** Previously hard-rejected with an alert when a group was selected; iterates controllable members.
- **Segment Color Dial now supports groups.** Previously hard-rejected; applies the same segment update to every controllable, segmented-color-capable member.
- **OnOff group toggle fetches live state for every member** before deciding direction. Previously sampled cached snapshot only and could toggle from stale state.
- **Custom Effect now alerts on group selection** instead of silently dropping every animation frame.
- **Snapshot iterates `getControllableLights()`** instead of all members; offline lights no longer get pointless commands.

### State and consistency

- **Cross-action state snapshot now persists for group members.** `controlTarget` was only calling `rememberLightState` on single-light commands; group toggles left snapshots stale and other actions saw old state.
- **Group member online state hydrates from device cache before filtering.** `getControllableLights()` returned everything by default after deserialization; offline lights and lights deleted from the user's Govee account were getting commanded and racking up failure counters.
- **OnOff keypad now has a 30 s periodic refresh timer** to catch out-of-band state changes (light toggled from Govee app or another action). Previously only refreshed on first appear and on settings change.

### UI

- **Group "Name" input is now an `<sdpi-textfield>`** — matches the styling of every other SDPI form field instead of looking like a raw `<input>`.
- **Metadata details summary vertically aligns with the row label** and the disclosure ▶ marker is preserved (an earlier fix had hidden it via `display: flex` on summary).
- **Stale numeric input clamping** — typing out-of-range values into a range slider's number input now clamps to min/max instead of silently committing.

### Reliability

- **`findState` no longer crashes** with `e.map is not a function` when a device advertises the segment-color descriptor with a non-array `state.value`. Patched in `govee-api-client` v3.3.5; the plugin's `isIgnorableLiveStateError` also catches this class of error defensively in case of future regressions.

---

## 🔧 Under the Hood

- **`BaseDialAction` shared offline-recovery infrastructure** — `hasOfflineMember` flag set by subclass `syncLiveState`, throttled cache-bust (≥30 s gap) in the live-sync loop. All five dial actions (Brightness, Color Hue, Color Temperature, Saturation, Segment Color) participate.
- **`ActionServices.showPartialFailureBanner` / `clearPartialFailureBanner`** — generic per-context banner with auto-revert; reused by the five group-aware keypad actions.
- **`DeviceDiscoveryResult.unsupportedDevices`** — new optional field carries cloud-group descriptors through the transport layer; `DeviceService.getCachedUnsupportedDevices()` exposes them to the PI handler.
- **`PIDatasourceItem.disabled`** — SDPI dropdown items can now be rendered disabled; used by the cloud-group optgroup.
- **`@felixgeelhaar/govee-api-client` bumped to v3.3.5** with `Array.isArray` guards on segmented-color/-brightness branches.

---

## 🧪 Tests

- 578 unit tests + 142 e2e tests passing.
- Every group-aware action has a unit-tested `anySucceeded` failure path and a unit-tested partial-failure banner trigger.
- Govee API client adds 2 integration tests covering the segmented-capability `Array.isArray` guard against `null`, `{}`, and scalar values.

---

## ⬆️ Upgrading

No breaking changes. Existing key bindings, plugin groups, and saved
settings are preserved.

If you previously bound a key to a Govee cloud group (`SameModelGroup`,
`BaseGroup`, `SameModeGroup`) — those entries now appear _disabled_ in
the device dropdown with an explanation, and any key still pointed at
one will continue to surface the existing "control unsupported" hint.
Re-bind to a plugin group to control multiple lights together.

---

## Acknowledgements

Bug reports that drove this release: #161, #162, #167, #182, #183,
#186, #188, #190, #198, #199, #200.
