/**
 * Shared power-state primitives for keypad actions.
 *
 * The three-state power reading itself (all on / partial / all off,
 * see #194) lives in `status-badge.ts` as `powerStatus()`, because it
 * is now rendered as a ●/◐/○ badge on the key image rather than as
 * text in the title — Stream Deck suppresses `setTitle()` entirely
 * once the user sets a title of their own (#333).
 *
 * What remains here is value-mixing: whether group members share the
 * same brightness/colour while all on. That is orthogonal to power and
 * still belongs in the title, next to the value it qualifies.
 */
export interface GroupPowerSummary {
  onCount: number;
  totalCount: number;
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
