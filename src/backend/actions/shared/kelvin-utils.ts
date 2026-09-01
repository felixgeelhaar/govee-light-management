import { clamp } from "./validation";

/**
 * Color temperature range as reported by a Govee device capability.
 * `precision` is the smallest increment the device accepts (in Kelvin).
 */
export interface KelvinRange {
  min: number;
  max: number;
  precision: number;
}

/**
 * Conservative Kelvin window used when no device has advertised a range.
 *
 * Every Govee colour-temperature device we've seen accepts 2700-6500K, so
 * this is safe to send blind. The previous 2000-9000K default was a guess
 * that no real device honoured: values outside a device's true range are
 * rejected by the API with "parameter value out of range" (see #167).
 */
export const SAFE_KELVIN_RANGE: KelvinRange = {
  min: 2700,
  max: 6500,
  precision: 100,
};

/**
 * Narrow a set of device ranges to the window that ALL of them accept.
 *
 * A group applies one Kelvin value to every member, so the only safe
 * window is the intersection: the highest minimum, the lowest maximum and
 * the coarsest precision. A group of a 2200-6500K lamp and a 2700-6500K
 * lamp can only be driven across 2700-6500K — anything lower is rejected
 * by the second lamp.
 *
 * Returns `undefined` when no ranges were supplied or when the members
 * have no overlap at all, leaving the caller to fall back.
 */
export function intersectKelvinRanges(
  ranges: readonly KelvinRange[],
): KelvinRange | undefined {
  if (ranges.length === 0) {
    return undefined;
  }

  const min = Math.max(...ranges.map((range) => range.min));
  const max = Math.min(...ranges.map((range) => range.max));
  if (min > max) {
    // Disjoint members — no single value can satisfy every light.
    return undefined;
  }

  return {
    min,
    max,
    precision: Math.max(1, ...ranges.map((range) => range.precision)),
  };
}

/**
 * Clamp a kelvin value to a device's advertised range and snap it to
 * the device's precision step.
 *
 * Some Govee devices only accept kelvin in multiples of 50 or 100; a
 * free-running dial would otherwise send commands the API rejects as
 * "parameter value out of range". Snapping on the client side lets the
 * dial feel smooth while still producing valid commands.
 */
export function normalizeKelvin(
  kelvin: number,
  { min, max, precision }: KelvinRange,
): number {
  const clamped = clamp(kelvin, min, max);
  const step = Math.max(1, precision);
  const snapped = min + Math.round((clamped - min) / step) * step;
  return clamp(snapped, min, max);
}

/**
 * Convert a kelvin value into a 0–100 progress value suitable for a
 * Stream Deck dial feedback bar. Returns 0 if the range is degenerate.
 */
export function kelvinToBarValue(
  kelvin: number,
  min: number,
  max: number,
): number {
  if (max <= min) {
    return 0;
  }
  return Math.round(((kelvin - min) / (max - min)) * 100);
}

/**
 * Map a 0–100 percentage slider value to an absolute kelvin value within
 * the device's advertised range.
 *
 * This is the inverse of `kelvinToBarValue`. The returned kelvin is
 * guaranteed to be inside `[min, max]` even when the input percent is
 * out of bounds. For degenerate or inverted ranges (`max <= min`) the
 * function returns `min`, matching the defensive behavior of
 * `kelvinToBarValue` and ensuring callers never receive a value outside
 * the declared window.
 *
 * The result is NOT yet snapped to the device's precision step — callers
 * that need the snapped value should wrap this in `normalizeKelvin`.
 *
 * Used by keypad actions that expose a 0–100% slider in the Property
 * Inspector (e.g. the Color Temperature keypad action) so that sliding
 * to 0% gives the device's minimum and 100% gives its maximum, instead of
 * a hardcoded window that may fall outside the device's accepted range.
 */
export function kelvinFromPercent(
  percent: number,
  { min, max }: Pick<KelvinRange, "min" | "max">,
): number {
  if (max <= min) {
    return min;
  }
  const bounded = clamp(percent, 0, 100);
  return Math.round(min + (bounded / 100) * (max - min));
}
