/**
 * Shared power-state primitives used by every state-reflective action to
 * render the keypad status glyph (○ / ◐ / ●). Centralising this guarantees
 * that Brightness, Color, ColorTemperature, Saturation, SegmentColor, and
 * OnOff all interpret "all on / partial / all off" identically.
 *
 * Rules (matches OnOff three-state, see #194):
 *   ● — every controllable group member is on (or single light is on)
 *   ◐ — at least one but not all controllable members are on
 *   ○ — every controllable member is off (or single light is off)
 *
 * Value-mixing (different brightness/colour across members while all are
 * on) is communicated by a separate prefix glyph from `valuePrefix()`.
 * The glyph stays bound to power state only so users learn one shape
 * language across the plugin.
 */
export interface GroupPowerSummary {
  onCount: number;
  totalCount: number;
}

export function powerGlyph(
  summary: GroupPowerSummary | undefined,
  fallbackIsOn: boolean | undefined,
): string {
  if (summary && summary.totalCount > 0) {
    if (summary.onCount === 0) return "○";
    if (summary.onCount === summary.totalCount) return "●";
    return "◐";
  }
  return fallbackIsOn ? "●" : "○";
}

/**
 * Display mode for the value line on group-targeted actions. Mirrors the
 * `displayModeMap` tracked by every state-reflective action.
 */
export type ValueDisplayMode = "single" | "group" | "mixed";

/**
 * Prefix glyph for the value line. Replaces the legacy 🔀 / 👥 emoji pair
 * with monochrome geometric glyphs so the value line and power-state
 * glyph share a single visual language:
 *
 *   `≠ ` — group members have differing values (or partial power)
 *   `≡ ` — group, every controllable member shares the same value
 *   ``   — single-light target (no prefix)
 *
 * Returned strings include a trailing space when non-empty so callers
 * can concatenate them directly: `${valuePrefix(mode)}${value}`.
 */
export function valuePrefix(mode: ValueDisplayMode): string {
  if (mode === "mixed") return "≠ ";
  if (mode === "group") return "≡ ";
  return "";
}
