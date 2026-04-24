# Elgato Marketplace Store Listing — v2.4.0

Use this content when submitting v2.4.0 to the Elgato Maker Console.
This is a cumulative rollup of every improvement shipped since the
currently-approved marketplace version (v2.1.3).

---

## Short Description (manifest)

Control your Govee smart lights from Stream Deck

---

## Full Description (Maker Console, max 4000 chars)

Control your Govee smart lights directly from Stream Deck — no phone, no app switching, no delay.

Govee Light Management gives you **17 purpose-built actions** across keypads and Stream Deck+ dials. Toggle power, set brightness, pick colors, apply scenes, schedule automations, chain sequences, play custom RGB effects, activate music-reactive lighting, and paint individual segments on your RGB IC strips. Every action syncs live state so the display always matches reality. Full group support means control entire rooms with a single button or dial.

### Keypad Actions (12)

- **On / Off** — Toggle power with a single tap. Shows a filled or empty dot so you always know the current state. Supports toggle, force-on, and force-off modes. Works with individual lights and light groups.
- **Brightness** — Set brightness from 0 to 100%. Treats 0% as "turn off" so a single button can dim to black.
- **Color** _(enhanced)_ — Set any RGB color using the built-in picker, or tap preset palettes (Warm, Cool, Pastel, Vivid) and recent colors for one-click access to your favorites.
- **Color Temperature** — Switch between warm white (2000K) and cool daylight (9000K). Choose a preset temperature and apply with one tap.
- **Segment Color** — Paint rainbow, solid, or gradient patterns across your RGB IC light strip. Choose the start and end segments (1–15) and the hue range.
- **Scene** — Apply dynamic scenes like Sunrise, Aurora, Rainbow, and more. Scenes are fetched live from each device so you only see what your light actually supports.
- **Snapshot** — Recall saved light presets on a Govee light. Perfect for quickly restoring your favorite configurations.
- **Music Mode** — Activate audio-reactive lighting. Choose from device-specific modes (Rhythm, Energic, Spectrum, Rolling) with adjustable sensitivity. Your lights pulse and change color in sync with sound.
- **Feature Toggle** — One-tap control for Nightlight, Gradient, DreamView, and Scene Stage. Features are auto-filtered by device capability so you never see options your light doesn't support.
- **Schedule** _(new)_ — Time-based automation for any light or group. Daily at a specific time, weekly on selected days, or delayed triggers. Press to enable/disable. Persistent across plugin restarts.
- **Sequence** _(new)_ — Chain multiple light commands with configurable delays between steps. Build complex workflows like "turn on → wait 2s → dim to 50% → set color blue". Press to run, press again to cancel.
- **Custom Effect** _(new)_ — Play animated RGB effects on your IC strips. 4 built-in presets: Rainbow Wave, Pulse, Fade, and Strobe. Live preview in the property inspector.

### Stream Deck+ Dial Actions (5)

- **Brightness Dial** — Rotate to scrub brightness from 0 to 100%. Press to toggle power. The touchscreen bar shows your current level with a purple-to-blue gradient.
- **Color Hue Dial** — Rotate through the full 360° color wheel. Press to toggle power. A rainbow gradient bar tracks your position with a white indicator dot.
- **Color Temperature Dial** — Rotate from warm amber (2000K) to cool blue (9000K). Press to toggle power. The warm-to-cool gradient bar shows exactly where you are.
- **Saturation Dial** — Rotate to control color intensity from pure white (0%) to full saturation (100%). Press to toggle power. Perfect companion to the Hue dial for precise color control.
- **Segment Color Dial** — Rotate to select a hue, then the color is applied to your chosen segment. Press to toggle power. Ideal for fine-tuning individual segments on RGB IC strips.

All dial actions feature **live state sync on appear**, deferred API calls (so the display updates instantly while the light catches up), **visual flash feedback** (green for success, red for error), and **full group support** (control entire light groups with a single dial).

### Setup

1. Install the plugin from the Elgato Marketplace
2. Get a free API key from the Govee app (Settings → Apply for API Key)
3. Drag an action onto a button, paste the key once, pick a light

The API key is entered once and shared across all actions. No accounts, no servers, no configuration files.

### Requirements

- Stream Deck app 6.9 or later
- macOS 12+ or Windows 10+
- A Govee developer API key (free, from the Govee mobile app)
- Govee smart lights connected to your Govee account

### Compatibility

Works with all Govee lights that support the Govee Developer API, including LED strips, bulbs, light bars, floor lamps, and RGB IC strip lights. Supports Stream Deck, Stream Deck MK.2, Stream Deck XL, Stream Deck Mini, Stream Deck Neo, Stream Deck Pedal, and Stream Deck+.

---

## What's New / Release Notes (v2.4.0)

**Cumulative rollup: 6 new actions, dozens of fixes, and the quality infrastructure to keep them working**

v2.4.0 bundles every improvement shipped since the v2.1.3 marketplace version into one coherent release.

### New Actions (6)

- **Snapshot** — Recall your Govee-app-saved light presets with one button press. The dropdown auto-populates from each device's available snapshots.
- **Schedule** — Time-based automation for any light or group. Three trigger modes: daily at HH:MM, weekly on selected days, or delay-after-press. Schedules persist across plugin restarts.
- **Sequence** — Chain multiple light commands with configurable delays between steps (in seconds now, not milliseconds). Visual step builder with device names and friendly command labels. Press to run, press again to cancel mid-sequence.
- **Custom Effect** — Play animated RGB effects on your IC strips. Four built-in presets — Rainbow Wave, Pulse, Fade, Strobe — with live preview in the Property Inspector.
- **Saturation Dial** — Stream Deck+ encoder for color intensity. Rotate to scrub from pure white (0%) to full saturation (100%); press to toggle power. Ideal companion to the Hue Dial.
- **DIY Scene support inside the Scene action** — Your custom DIY scenes created in the Govee mobile app now appear alongside built-in dynamic scenes, in the same dropdown, labeled `(DIY)` so they're easy to spot.

### New Feature Panel

- **Device Metadata Panel in Property Inspectors** — A new debug section shows the selected device's ID, model, capabilities, and supported commands in a clean structured layout. Click to copy IDs for troubleshooting.

### Major Fixes

- **Property Inspector dropdowns now explain themselves.** Empty dropdowns used to show a misleading "Select a device first" placeholder forever. They now display context-aware messages: "No snapshots found — create one in the Govee mobile app", "This device has no dynamic scenes", "Couldn't load music modes, check your connection", etc. Backend errors are visually distinct from genuine empty states.
- **Sequence step Device dropdown now populates** (was empty with no way to pick a device).
- **Custom Effect presets actually load** (dropdown was non-functional on first ship).
- **DIY scenes reach the correct Govee endpoint** — the underlying API client was querying the wrong path, so DIY dropdowns returned empty for nearly every user.
- **Accurate offline detection** — `DeviceState.online` now reflects Govee's actual offline capability value instead of always reporting online.
- **dreamViewToggle and other RGB IC toggles read correct live state** — button title on/off indicators match reality.
- **Color temperature respects each device's advertised Kelvin range** (was hardcoded 2000–9000K, causing silent rejections on narrow-range devices).
- **Cloud pseudo-groups filtered out** — entries like `BaseGroup`, `SameModelGroup`, `SameModeGroup` are not controllable through the public API; they used to appear as selectable lights and silently fail every command.
- **Gradient/nightlight overlays cleared** before solid-color commands so effects don't fight user input.
- **Full group support** across Music Mode, Feature Toggle, Scene, Snapshot, and all five Stream Deck+ dials.

### Quality Infrastructure

- Typed `sendPIDatasource` response contract makes silent empty-dropdown bugs a compile-time error going forward.
- E2E test suite expanded from 33 to 118 tests across all 17 Property Inspectors.
- SDPI invariant tests catch a full class of regression in CI.
- PR template requires concrete hardware-dogfood descriptions.
- Weekly stale-review workflow surfaces overdue PRs and issues.

### Upgrade

Transparent upgrade — no settings migration. All existing actions, groups, and saved scenes continue to work exactly as configured. Five new actions appear in the Stream Deck action panel.

---

## What's New / Release Notes (v2.3.1)

**Feature delivery + reliability fixes that finish what v2.3.0 started**

### Fixed in v2.3.1

- **DIY scenes actually populate now.** v2.3.0 advertised DIY scene support, but the underlying API client was querying the wrong Govee endpoint. Dropdowns silently returned empty. Bumping the client library fixes it — DIY scenes fetched directly from Govee's dedicated endpoint, matching how the Govee mobile app sees them.
- **Snapshots load for more device models.** Devices like the H61E5 expose their snapshot presets through a different API path than standard lights. The client now falls back to that path when the primary one returns empty.
- **Accurate offline detection.** Device online state is read from the actual Govee capability instead of being optimistically assumed. When a light is unreachable, the plugin knows — no more silent command failures.

## What's New / Release Notes (v2.3.0)

**DIY scenes, device metadata panel, and a quality-guardrail overhaul**

### New Features

- **DIY Scenes in the Scene action** — Your custom scenes created in the Govee mobile app now appear alongside the built-in dynamic scenes, all in one dropdown. Labeled with `(DIY)` so you can tell them apart at a glance.
- **Device Metadata Panel in Property Inspectors** — A new debug section shows the selected device's ID, model, capabilities, and supported commands in a clean structured layout. Click to copy IDs when you need them for troubleshooting.

### Fixed

- **Property Inspector dropdowns now explain themselves.** When a device has no scenes, no snapshots, no music modes, or no toggleable features, the dropdown shows a clear message instead of the misleading "Select a device first" placeholder. Backend errors (bad API key, network failure) show a distinct error hint. Covers Scene, Snapshot, Music Mode, Toggle, Device, and the Custom Effect dropdown.
- **Custom Effect dropdown now loads its presets.** A datasource wiring mismatch shipped in v2.2.0 prevented the effect list from populating — Custom Effect was essentially unusable. Fixed.
- **Sequence step Device dropdown populates.** The step builder's Device dropdown was missing the binding SDPI needs to fire its datasource subscription, so it rendered empty with no way to pick a device.
- **Govee cloud pseudo-groups filtered out.** Entries like `BaseGroup`, `SameModelGroup`, and `SameModeGroup` are not controllable through the public API — they used to appear as selectable lights that silently failed every command. Now they're filtered during discovery and a clear error hint is shown if a stale selection points at one.
- **Snapshot & Music Mode dropdowns for capability-driven devices.** Devices that expose their options through nested capability fields (not simple datasource enumeration) now populate correctly.

### Sequence Builder Polish

- Delay steps now use **seconds** instead of milliseconds for readability
- Step list shows friendly device names and command labels instead of raw IDs
- Properly styled dropdowns matching the rest of the plugin

### Under the Hood

- Typed `sendPIDatasource` contract makes it a compile-time error to ship a PI datasource response without `status: "ok" | "empty" | "error"` — the bug class behind the v2.2.0 regressions can't silently recur
- E2E test suite expanded from 33 to 118 tests across all 17 Property Inspectors
- PR template now requires concrete hardware-dogfood descriptions; weekly stale-review workflow surfaces unanswered issues

## What's New / Release Notes (v2.2.0)

**3 powerful new actions and major enhancements across the plugin**

### New Actions

- **Schedule** — Time-based automation for lights and groups. Three trigger types:
  - **Daily** — fires at HH:MM every day
  - **Weekly** — fires on selected days (chip-based day picker)
  - **Delay** — fires N seconds after button press
  - Press the button to enable/disable; schedules persist across plugin restarts
- **Sequence** — Chain multiple light commands with configurable delays (up to 5 minutes per delay). Build step-by-step workflows with the visual step builder — add actions, insert delays, reorder with up/down controls. Press to run, press again to cancel mid-sequence.
- **Custom Effect** — Play animated RGB effects on IC light strips. 4 built-in presets (Rainbow Wave, Pulse, Fade, Strobe) with live color preview in the property inspector. Different effects can run on different lights simultaneously.

### Color Picker Enhancements

- **Preset Palettes** — 4 curated palettes (Warm, Cool, Pastel, Vivid) with 20 colors total, one click to apply
- **Recent Colors** — Auto-tracks the last 10 colors you applied, persists across sessions
- **Clear all** — One-click reset for recent colors

### Smarter Device Detection

- **Device Classifier** — Automatic detection of Bulb, LED Strip, Light Bar, or Floor Lamp from Govee model numbers
- **Better error messages** — "My Light (LED Strip) doesn't support music mode. Music mode is available on most RGB-capable lights with a built-in microphone."
- **Capability hints** — Helpful descriptions when a feature isn't supported

### Performance Improvements

- **Expanded device cache** — Device discovery cache doubled from 15s to 30s, reducing API calls by 50%
- **Improved response times** — Faster property inspector loading

### Under the Hood

- 177 new tests (488 total, up from 311)
- 3 new domain entities, 5 new value objects, 8 new services
- Full backward compatibility with v2.1.x
- Zero regressions — all existing actions unchanged

---

## What's New / Release Notes (v2.1.3)

**Comprehensive group support and Saturation dial — now all dials work with groups**

### New Features

- **Saturation Dial** — New Stream Deck+ encoder action. Rotate to control color intensity from pure white (0%) to full saturation (100%). Perfect companion to the Hue dial for precise color control.
- **Full Group Support for Dials** — All 5 dial actions now work seamlessly with light groups:
  - Select a group in the property inspector
  - Dial reads and controls the combined group state
  - Live state sync works for groups (shows average brightness, etc.)
  - Press to toggle power on entire group
- **Group Support for Music Mode** — Music mode actions now work with light groups
- **Group Support for Feature Toggle** — Feature toggle actions now work with light groups (toggle nightlight, gradient, dreamview, scene stage on entire groups)

### Improvements

- **Enhanced group compatibility** — All group-capable actions now consistently handle both individual lights and light groups
- **Consistent UI/UX** — Same intuitive property inspector workflow whether controlling single light or group
- **Better state reporting** — Group state indicators more accurately reflect combined light states

---

## What's New / Release Notes (v2.1.0)

**Three powerful new actions and smarter dials**

### New Actions

- **Scenes** — Apply dynamic scenes like Sunrise, Aurora, and Rainbow with a single tap. Scenes are fetched live from each device so you only see what your light actually supports.
- **Music Mode** — Turn your room into a light show. Activate audio-reactive lighting with device-specific modes (Rhythm, Energic, Spectrum, Rolling) and adjustable sensitivity.
- **Feature Toggle** — One-tap control for Nightlight, Gradient, DreamView, and Scene Stage. Features are auto-filtered by device capability — no guessing what works.

### Smarter Dials

- **Live state sync** — Dials now read the actual state of your lights when they appear. No more starting at default values.
- **Power toggle on press** — Press any dial to toggle power on/off, matching the keypad experience.
- **Visual flash feedback** — Green flash on success, red on error. You always know if the command landed.
- **Smooth rotation** — Deferred API calls mean the display updates instantly while the light catches up. No lag, no jitter.

### Improvements

- **Fixed segment numbering** — Segment indices now display 1–15 in the UI, matching user expectations.
- Updated all dependencies to latest stable versions.

---

## What's New / Release Notes (v2.1.1)

**Critical bug fix for accounts with device groups**

- **Fixed crash with Govee group entries** — Accounts with device groups (BaseGroup, SameModeGroup, DreamViewScenic) no longer crash the plugin. The Govee API returns group objects that lack required fields, which caused strict schema validation to reject the entire response and crash the plugin process. Discovery now gracefully skips invalid entries.
- **Resilient transport layer** — Individual transport failures no longer block device discovery from other transports.
- **Cached fallback** — If discovery fails, the plugin falls back to cached device data instead of showing an empty dropdown.

---

## Gallery Images

Upload from `docs/gallery/` (all 1920x1080):

| File                 | Slide                                           |
| -------------------- | ----------------------------------------------- |
| `1-hero.png`         | Hero — "Tactile smart light control"            |
| `2-actions.png`      | All 12 keypad actions grid                      |
| `3-dials.png`        | Stream Deck+ dial layouts (5 dials)             |
| `4-setup.png`        | 3-step setup walkthrough                        |
| `5-v21-features.png` | New in v2.1 — Scene, Music Mode, Feature Toggle |
| `6-v22-features.png` | New in v2.2 — Schedule, Sequence, Custom Effect |

---

## Category

Lighting

## Tags

govee, smart lights, led, rgb, home automation, iot, color, brightness, scenes, music mode
