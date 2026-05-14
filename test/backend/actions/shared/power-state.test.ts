import { describe, expect, it } from "vitest";
import {
  powerGlyph,
  valuePrefix,
  type GroupPowerSummary,
} from "../../../../src/backend/actions/shared/power-state";

describe("powerGlyph", () => {
  it("returns ○ for a single light that is off", () => {
    expect(powerGlyph(undefined, false)).toBe("○");
  });

  it("returns ● for a single light that is on", () => {
    expect(powerGlyph(undefined, true)).toBe("●");
  });

  it("returns ○ when no group members are on", () => {
    const summary: GroupPowerSummary = { onCount: 0, totalCount: 3 };
    expect(powerGlyph(summary, false)).toBe("○");
  });

  it("returns ● when every group member is on", () => {
    const summary: GroupPowerSummary = { onCount: 3, totalCount: 3 };
    expect(powerGlyph(summary, true)).toBe("●");
  });

  it("returns ◐ when some but not all members are on", () => {
    const summary: GroupPowerSummary = { onCount: 1, totalCount: 3 };
    expect(powerGlyph(summary, true)).toBe("◐");
  });

  it("ignores a zero-total summary and falls back to single-light state", () => {
    const summary: GroupPowerSummary = { onCount: 0, totalCount: 0 };
    expect(powerGlyph(summary, true)).toBe("●");
  });

  it("treats missing fallback as off", () => {
    expect(powerGlyph(undefined, undefined)).toBe("○");
  });
});

describe("valuePrefix", () => {
  it("returns no prefix for a single light", () => {
    expect(valuePrefix("single")).toBe("");
  });

  it("returns ≡ for a uniform group", () => {
    expect(valuePrefix("group")).toBe("≡ ");
  });

  it("returns ≠ for a value-mixed group", () => {
    expect(valuePrefix("mixed")).toBe("≠ ");
  });
});
