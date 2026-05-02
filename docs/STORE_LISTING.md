# Elgato Marketplace Store Listing — v2.7.0

Use this content when submitting v2.7.0 to the Elgato Maker Console.
The v2.6.0 archive lives at `docs/STORE_LISTING_v2.6.0_archive.md`.

---

## Short Description (manifest)

One press for a saved look. One rotation for the perfect setting.
Govee lights, controlled from Stream Deck.

---

## Full Description (Maker Console, max 4000 chars)

**Control your room's Govee lighting without ever leaving what you're working on.**

v2.7.0 collapses what used to be 17 separate controls into a focused, jobs-to-be-done surface — five hybrid actions that work on both Stream Deck keys and Stream Deck+ dials, plus a brand-new **Recall** action that turns any saved scene or snapshot into a single press.

### What's new in v2.7.0

- **Recall — one button per look.** Pick from every Govee dynamic scene, DIY scene, and snapshot the device exposes — in a single dropdown. Drag onto a key, pick "Sunset" / your custom DIY mood / a saved snapshot → press to apply. Replaces juggling separate Scene + Snapshot actions for the same job.
- **Five hybrid keypad + dial actions.** Brightness, Color, Color Temperature, Segment Color, and Saturation each ship as a single action that works on both controller types. Drag onto a Stream Deck key for a fixed-value press; drag onto a Stream Deck+ dial to rotate-adjust + press-to-toggle. One action, one configuration, status indicator stays consistent across both controllers.
- **Group state that finally tells the truth.** The On/Off action's title shows `●` when every member is on, `○` when every member is off, and `◐` for mixed groups, with an `N/M` count below. Mixed groups no longer pretend to be uniform.
- **Persistent partial-failure feedback.** When a group apply succeeds for some members and fails for others, the key title shows `⚠ N/M failed` for 30 seconds — no more silent green checkmarks lying about half-failures.
- **Multi-state keypad icons.** Vibrant when the light is on, desaturated when it's off, switched automatically. The key reflects power state without you needing to read the title.
- **Automatic group offline recovery.** Power-cycling a member used to require a plugin restart. The next live-sync (≤30 s) now busts the cache and the recovery shows up on its own.

### The full surface (12 actions)

**Five hybrid keypad + dial actions** — work on both controller types from a single configuration:

- **On / Off** — Toggle, force-on, or force-off. Three-state title for groups (●/◐/○ + N/M).
- **Brightness** — Press for fixed %; rotate ±step on dial; press dial to toggle power.
- **Color** — Press for fixed RGB or palette pick; rotate hue on dial with configurable saturation; press dial to toggle.
- **Color Temperature** — Press for fixed Kelvin; rotate warm/cool on dial; press dial to toggle.
- **Segment Color** — Press to apply rainbow / solid / gradient preset across a segment range; rotate single-segment hue on dial.
- **Saturation** — Press for fixed %; rotate ±step on dial; press dial to toggle.

**Plus seven specialised keypad actions:**

- **Recall** _(new)_ — Apply any saved scene or snapshot in one press.
- **Scene** — Apply Govee dynamic scenes (Sunrise, Aurora, Rainbow, etc.) — auto-filtered by device support.
- **Snapshot** — Recall a saved Govee app preset.
- **Music Mode** — Audio-reactive lighting with adjustable sensitivity.
- **Feature Toggle** — Nightlight, Gradient, DreamView, Scene Stage — auto-filtered by device capability.
- **Schedule** — Daily / weekly / delayed automation, persistent across restarts.
- **Sequence** — Chain commands with delays.
- **Custom Effect** — Animated RGB effects on IC strips (Rainbow Wave, Pulse, Fade, Strobe).

> The standalone `*-Dial` entries from v2.6.0 are kept as `(legacy)` so existing user bindings still work — re-binding to the unified actions is optional.

### Setup

1. Install the plugin from the Elgato Marketplace
2. Get a free API key from the Govee app (Settings → Apply for API Key)
3. Drag an action onto a button, paste the key once, pick a light

The API key is entered once and shared across every action. No accounts, no servers, no configuration files.

### Requirements

- Stream Deck app 6.9 or later
- macOS 12+ or Windows 10+
- A Govee developer API key (free, from the Govee mobile app)
- Govee smart lights connected to your Govee account
- _Stream Deck+ optional — the hybrid actions work on standard Stream Decks too_

---

## Marketplace reviewer notes

For the Elgato review team — what to focus on for a v2.7.0 re-approval:

- **Backwards-compatible.** The five legacy `*-Dial` UUIDs (`brightness-dial`, `colorhue-dial`, `colortemp-dial`, `segment-color-dial`, plus the renamed `saturation-dial`) stay registered with the original behaviour. No user binding from v2.6.x breaks.
- **No new permissions.** Same Govee cloud API surface as v2.6.x. No new outbound endpoints, no new local capabilities.
- **No telemetry changes.** TelemetryService logs the same in-memory metrics as v2.6.x; nothing leaves the user's machine.
- **Quality gates green.** 593 unit tests + 143 e2e tests + ESLint + `tsc --noEmit` pass on commit `4114ca5`. CI release pipeline runs on tag push.
- **Dependency upgrade.** `@felixgeelhaar/govee-api-client` v3.3.4 → v3.3.5 (defensive `Array.isArray` guard on `findState`'s segment-color branch — non-IC devices that advertise the descriptor with a non-array value no longer crash).

---

## Tagline (one line, social/email)

> One press for a saved look. One rotation for the perfect setting. Status visible at a glance. Govee lights, your Stream Deck way.

## Hero image headline (gallery 1)

> Tactile **smart light** control — without leaving your work.

## Subheadline

> Recall any scene, dial in any colour, or rotate the brightness — directly from your Stream Deck. The phone stays in your pocket.
