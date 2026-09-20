import { describe, it, expect } from "vitest";
import { EffectFrame } from "../../../src/backend/domain/value-objects/EffectFrame";

describe("EffectFrame", () => {
  describe("Creation", () => {
    it("should create frame with all 15 segment colors", () => {
      const colors = Array.from({ length: 15 }, () => "#FF0000");
      const frame = EffectFrame.create({ timingMs: 0, segmentColors: colors });
      expect(frame.timingMs).toBe(0);
      expect(frame.segmentColors).toHaveLength(15);
    });

    it("should reject missing segment colors", () => {
      expect(() =>
        EffectFrame.create({
          timingMs: 0,
          segmentColors: ["#FF0000", "#00FF00"],
        }),
      ).toThrow("Must provide colors for all 15 segments");
    });

    it("should reject invalid hex colors", () => {
      const colors = Array.from({ length: 15 }, (_, i) =>
        i === 5 ? "not-hex" : "#FF0000",
      );
      expect(() =>
        EffectFrame.create({ timingMs: 0, segmentColors: colors }),
      ).toThrow("Invalid hex color");
    });

    it("should reject negative timing", () => {
      const colors = Array.from({ length: 15 }, () => "#FF0000");
      expect(() =>
        EffectFrame.create({ timingMs: -1, segmentColors: colors }),
      ).toThrow("Timing must be non-negative");
    });
  });

  describe("Uniform Factory", () => {
    it("should create frame where all segments are the same color", () => {
      const frame = EffectFrame.uniform(0, "#FF0000");
      expect(frame.segmentColors.every((c) => c === "#FF0000")).toBe(true);
    });
  });

  describe("Gradient Factory", () => {
    it("should create gradient frame between two colors", () => {
      const frame = EffectFrame.gradient(0, "#FF0000", "#0000FF");
      expect(frame.segmentColors[0]).toBe("#FF0000");
      expect(frame.segmentColors[14]).toBe("#0000FF");
    });

    it("should interpolate middle segments", () => {
      const frame = EffectFrame.gradient(0, "#000000", "#FFFFFF");
      // Middle segment should be somewhere gray
      const middle = frame.segmentColors[7];
      expect(middle).not.toBe("#000000");
      expect(middle).not.toBe("#FFFFFF");
    });
  });

  describe("Rainbow Factory", () => {
    it("should create rainbow frame with varied colors", () => {
      const frame = EffectFrame.rainbow(0);
      const uniqueColors = new Set(frame.segmentColors);
      expect(uniqueColors.size).toBeGreaterThan(10);
    });

    it("should support hue offset for rotation", () => {
      const frame1 = EffectFrame.rainbow(0, 0);
      const frame2 = EffectFrame.rainbow(0, 180);
      expect(frame1.segmentColors[0]).not.toBe(frame2.segmentColors[0]);
    });
  });

  describe("Serialization", () => {
    it("should round-trip JSON", () => {
      const original = EffectFrame.uniform(500, "#FF00FF");
      const restored = EffectFrame.fromJSON(original.toJSON());
      expect(restored.timingMs).toBe(500);
      expect(restored.segmentColors).toEqual(original.segmentColors);
    });
  });
});

/**
 * `EffectFrame.rainbow` converts HSV to hex, and so does the converter the
 * dial actions use. Two implementations of one colour space is a standing
 * invitation to drift — CLAUDE.md listed this duplication as resolved while
 * both copies were still in the tree. This pins them together: if they ever
 * disagree on any hue, this fails.
 */
describe("EffectFrame.rainbow agrees with the shared HSV converter", () => {
  it("produces the same colour as hsvToRgb across the wheel", async () => {
    const { hsvToRgb } =
      await import("../../../src/backend/domain/value-objects/color-conversion");
    const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();

    for (let offset = 0; offset < 360; offset += 7) {
      const frame = EffectFrame.rainbow(100, offset);
      frame.segmentColors.forEach((hex, index) => {
        const hue = (offset + (index * 360) / 15) % 360;
        const { r, g, b } = hsvToRgb(hue, 100, 100);
        expect(hex).toBe(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
      });
    }
  });
});
