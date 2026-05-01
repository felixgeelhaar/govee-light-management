# Recall Action — Design Brief

Status: Draft · Author: Felix Geelhaar (paired with Claude) · Last updated: 2026-05-01

## Problem

Users want one tactile button that returns a Govee light or group to a _named room state_ (mood, scene, snapshot, "movie", "work"). The plugin today exposes that capability across three atomic actions: **Scene** (dynamic / DIY), **Snapshot**, and the implicit "turn on with this brightness/color/temp" combo. None of them composes; users either bind multiple keys per mood (high cost) or accept that one tap doesn't fully capture the state.

GitHub issue #199 articulates the exact reframe in user words:

> I would like to be able to use the "Sequence" feature in a way that is similar to the "Tap-To-Run" feature in the Govee Home app. Add more control options to the select action menu for each "step" — color, temperature, scenes, or other functionalities that other buttons have.

#174 / #182 reinforce this for snapshot recall as a job, not a feature.

## Evidence

| Source                        | Signal                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Issue #199                    | "Tap-To-Run"-style composition explicitly requested                                      |
| Issue #174                    | Snapshot scene support requested, ~3 thumbs-up at the time of merging                    |
| Issue #182                    | Snapshot recall confusion ("Select a device first") — user expected one-tap recall       |
| UX review (this session)      | 65% of tracker issues land in Quick Control + Looks buckets — the composite covers Looks |
| Product review (this session) | 17 atomic actions = API surface, not job surface; composite collapses 3-4 into 1         |
| Govee mobile app              | Tap-To-Run is the most-used surface in the app, confirming category demand               |

## Desired outcome

A user binds **one** Stream Deck key per "look" they care about (Movie, Work, Sunset, Off). Pressing it puts the target into that state regardless of what the light is currently doing. Time to configure a new mood drops from N keys to 1.

Measurable: post-launch, % of plugin installs with at least one Recall action ≥ 25% within 60 days. Tracker issues containing the word "scene" or "snapshot" trend down.

## Non-goals

- Replace Sequence (Sequence is _steps over time_; Recall is _single state at one moment_).
- Multi-device automation (one action targets one light or group, same as today).
- Editing the underlying Govee scene/snapshot definitions (still managed in Govee mobile app).

## Proposal — fat-marker sketch

A single new action `recall` that bundles the existing primitives behind a typed mode picker.

### Action settings

```ts
type RecallSettings = BaseSettings & {
  mode:
    | "scene-dynamic" // existing dynamic scene
    | "scene-diy" // existing DIY scene
    | "snapshot" // existing user snapshot
    | "preset"; // power + brightness + color/temp combo
  // populated based on `mode`:
  selectedSceneId?: string; // JSON {id, paramId, name}
  selectedSnapshotId?: string; // JSON {id, paramId, name}
  preset?: {
    power: "on" | "off" | "preserve";
    brightness?: number; // 0–100
    color?: { r: number; g: number; b: number };
    colorTemperature?: number; // kelvin
  };
};
```

Title: `{LightOrGroupName}\n{ModeLabel}` (e.g. "Living Room\n🎬 Movie").

### Apply order (preset mode)

When `mode === "preset"`, commands sent in this order so the device ends up in the intended state without overlay tinting:

1. `prepareForSolidColor` (existing — clears gradient/nightlight).
2. `setColor` _or_ `setColorTemperature` (mutually exclusive, last-write-wins).
3. `setBrightness`.
4. `setPower(power)` if `power !== "preserve"`.

For `scene-dynamic` / `scene-diy` / `snapshot`: delegate to existing `applyDynamicScene` / `applyDiyScene` / `applySnapshot` respectively. Preserves existing rate-limit and effect-cancel guards.

### Group support

First-class. Reuses the patterns shipped this session:

- `controlTarget` for power / preset values.
- Per-member loop with `anySucceeded` + `failedCount`.
- `showPartialFailureBanner` on partial group failure.

### Property Inspector

Single `recall.html` PI with progressive disclosure:

- `mode` radio at top (4 options).
- `selectedSceneId` / `selectedSnapshotId` / preset block — each visible only when its mode is selected. Reuse the existing conditional-visibility `updateConditionalVisibility` pattern from `setup.js`.
- For preset mode: re-use `<sdpi-color>`, `<sdpi-range>` with `data-number-input`, kelvin slider — all already implemented.
- Capability filtering: device dropdown still shows everything; mode picker disables modes the device cannot satisfy (e.g. "Scene" disabled if light has no scene capability — message: "Pick a different light or use Preset.").

## Key assumptions (in priority order)

1. **Riskiest:** users want one-action-per-mood, not a multi-step builder. If they actually want a builder, this is just a worse Sequence. Test by interviewing 3 users post-release: "show me how you set up your favourite button — what would you change?"
2. Preset mode delivers enough value without scene/snapshot — i.e. users without scene-capable lights still adopt Recall. If false, preset is dead weight; collapse to scene/snapshot only.
3. Existing primitives (`applyDynamicScene`, `applySnapshot`, `controlTarget`) are stable enough to compose without surfacing new bugs. Failure mode: composite hits a primitive edge case the atomic action never exercised.
4. Title slot on a 72×72 px key is enough to disambiguate "Living Room\n🎬 Movie" from "Bedroom\n🎬 Movie" without users misclicking. If false, surface mode-icon as glyph-only with name-on-hover.

## Migration / coexistence

Atomic Scene / Snapshot actions stay shipped. Do **not** deprecate on launch. Re-evaluate after one release cycle (~60 days) using:

- adoption rate of Recall vs. Scene + Snapshot
- tracker issues mentioning "scene" / "snapshot" delta
- support DM volume

If Recall absorbs ≥ 60% of new bindings, hide atomic Scene/Snapshot from picker (keep handlers for existing keys), surface a one-line "→ Recall" prompt in their PI.

## Exit criteria

Ship if:

- 3 internal personas (light streamer, work-from-home, ambient-lighting) each bind one Recall key in dogfood.
- Group preset apply: 0 silent failures across a 5-member mixed-capability group test.
- Type-check + lint + tests green; ≥ 5 new unit tests covering each mode branch.

Stop / reframe if:

- Users in dogfood interview say "I'd rather just bind 4 atomic keys" — then the build trap is real and we shipped a solution to a non-problem.

## Appetite

**6-day cycle** (Shape Up). Scope cut order if appetite blown:

1. Drop `colorTemperature` from preset mode (color-only). Re-add later.
2. Drop `preset` mode entirely on launch — ship scene + snapshot composite first; preset in v2.
3. Drop group support — single-light only on launch. Add groups in v2 (would _not_ recommend since group bugs are the recent dominant failure mode).

## Open questions

- Should "Off" be a fourth mode, or is `preset { power: "off" }` enough?
- Snapshot-capable lights can also have scenes — should the picker collapse them or keep them separate? Default: separate (matches Govee app mental model).
- Per-action icon: same `key.svg` for all Recall actions, or per-mode? Matches feedback memory `feedback_icon_design_system.md` — likely per-mode glyph in the title is enough, single shared icon.

## Recommended next step

Pre-mortem before writing code. 30 minutes — assume Recall shipped and adoption was 5%. Write down five reasons why. Surfaces the assumptions that need to be tested first; cheap-wins are usually a discovery interview before a sprint.

---

## Appendix — implementation checklist (post-design-approval)

- [ ] `RecallAction.ts` — `@action` UUID `com.felixgeelhaar.govee-light-management.recall`.
- [ ] `recall.html` PI + `recall.ts` entry (Vite input).
- [ ] `manifest.json` — new action entry + Property Inspector path + icons (`icon.svg` mono + `key.svg` gradient/glow per `feedback_icon_design_system.md`).
- [ ] Unit tests: 4 mode branches × (single-light, group, partial-fail) = ~12 tests.
- [ ] E2E invariant test (per `feedback_quality_guardrails.md`): preset apply order doesn't change brightness before clearing overlay mode.
- [ ] Update `STORE_LISTING.md` and add to gallery.
- [ ] Add to `RELEASE_NOTES_*.md` for the version that ships it.
