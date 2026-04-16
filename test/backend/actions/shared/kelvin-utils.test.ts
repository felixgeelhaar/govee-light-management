import { describe, expect, it } from "vitest";
import {
  kelvinFromPercent,
  kelvinToBarValue,
  normalizeKelvin,
  type KelvinRange,
} from "../../../../src/backend/actions/shared/kelvin-utils";

const range = (
  min: number,
  max: number,
  precision: number,
): KelvinRange => ({ min, max, precision });

describe("normalizeKelvin", () => {
  it("clamps to the range min when the value is below it", () => {
    expect(normalizeKelvin(1500, range(2700, 6500, 100))).toBe(2700);
  });

  it("clamps to the range max when the value is above it", () => {
    expect(normalizeKelvin(7200, range(2700, 6500, 100))).toBe(6500);
  });

  it("snaps to the device precision step", () => {
    // 3022 is 22K into the step beginning at 3000, below the midpoint (25K),
    // so it rounds down to 3000. 3030 is above the midpoint, so it rounds up
    // to 3050.
    expect(normalizeKelvin(3022, range(2700, 6500, 50))).toBe(3000);
    expect(normalizeKelvin(3030, range(2700, 6500, 50))).toBe(3050);
  });

  it("treats precision 0 as 1K to avoid division by zero", () => {
    expect(normalizeKelvin(3333, range(2700, 6500, 0))).toBe(3333);
  });

  it("keeps the snapped value within the clamped range", () => {
    // A snap that would overshoot max should be clamped back.
    expect(normalizeKelvin(6490, range(2700, 6500, 50))).toBe(6500);
  });
});

describe("kelvinToBarValue", () => {
  it("maps the range min to 0 and max to 100", () => {
    expect(kelvinToBarValue(2700, 2700, 6500)).toBe(0);
    expect(kelvinToBarValue(6500, 2700, 6500)).toBe(100);
  });

  it("interpolates mid-range values", () => {
    expect(kelvinToBarValue(4600, 2700, 6500)).toBe(50);
  });

  it("returns 0 for a degenerate range", () => {
    expect(kelvinToBarValue(3000, 3000, 3000)).toBe(0);
    expect(kelvinToBarValue(3000, 6500, 2700)).toBe(0);
  });
});

describe("kelvinFromPercent", () => {
  const commonRange = range(2700, 6500, 100);

  it("maps 0% to the range minimum", () => {
    expect(kelvinFromPercent(0, commonRange)).toBe(2700);
  });

  it("maps 100% to the range maximum", () => {
    expect(kelvinFromPercent(100, commonRange)).toBe(6500);
  });

  it("maps 50% to the midpoint (±1K rounding)", () => {
    expect(kelvinFromPercent(50, commonRange)).toBe(4600);
  });

  it("clamps a negative percent to 0 (minimum kelvin)", () => {
    expect(kelvinFromPercent(-25, commonRange)).toBe(2700);
  });

  it("clamps a percent > 100 to the maximum kelvin", () => {
    expect(kelvinFromPercent(150, commonRange)).toBe(6500);
  });

  it("stays inside the declared range for any percent and range", () => {
    // Regression: the pre-fix implementation used a hardcoded 2000–9000K
    // window and produced values outside many devices' actual ranges,
    // causing Govee to silently reject with "parameter value out of range".
    for (const p of [0, 10, 25, 50, 75, 90, 100]) {
      const k = kelvinFromPercent(p, commonRange);
      expect(k).toBeGreaterThanOrEqual(commonRange.min);
      expect(k).toBeLessThanOrEqual(commonRange.max);
    }
  });

  it("handles a wide range (e.g. 2000–9000K) correctly", () => {
    const wide = range(2000, 9000, 100);
    expect(kelvinFromPercent(0, wide)).toBe(2000);
    expect(kelvinFromPercent(100, wide)).toBe(9000);
  });

  it("returns min for a degenerate range (max === min)", () => {
    // Some devices could theoretically advertise a single-value range;
    // returning min keeps the contract "result is inside [min, max]" true.
    expect(kelvinFromPercent(50, range(3000, 3000, 100))).toBe(3000);
  });

  it("returns min for an inverted range (max < min) instead of interpolating outside it", () => {
    // Defensive guard: if metadata arrives malformed we must not emit a
    // kelvin below min or above max — that would reintroduce the
    // "parameter value out of range" rejection this helper exists to prevent.
    const inverted = range(6500, 2700, 100);
    const result = kelvinFromPercent(50, inverted);
    expect(result).toBe(6500);
  });
});
