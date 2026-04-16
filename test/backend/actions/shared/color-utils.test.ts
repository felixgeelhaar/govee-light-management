import { describe, expect, it } from "vitest";
import { ColorRgb } from "@felixgeelhaar/govee-api-client";
import {
  hsvToRgb,
  rgbToHue,
  rgbToSaturation,
} from "../../../../src/backend/actions/shared/color-utils";

const rgb = (r: number, g: number, b: number) => new ColorRgb(r, g, b);

describe("rgbToHue", () => {
  it("returns 0 for pure red", () => {
    expect(rgbToHue(rgb(255, 0, 0))).toBe(0);
  });

  it("returns 60 for yellow", () => {
    expect(rgbToHue(rgb(255, 255, 0))).toBe(60);
  });

  it("returns 120 for pure green", () => {
    expect(rgbToHue(rgb(0, 255, 0))).toBe(120);
  });

  it("returns 240 for pure blue", () => {
    expect(rgbToHue(rgb(0, 0, 255))).toBe(240);
  });

  it("returns 0 for grey / achromatic colors", () => {
    expect(rgbToHue(rgb(128, 128, 128))).toBe(0);
    expect(rgbToHue(rgb(255, 255, 255))).toBe(0);
    expect(rgbToHue(rgb(0, 0, 0))).toBe(0);
  });
});

describe("rgbToSaturation", () => {
  it("returns 100 for fully saturated primary colors", () => {
    expect(rgbToSaturation(rgb(255, 0, 0))).toBe(100);
    expect(rgbToSaturation(rgb(0, 255, 0))).toBe(100);
    expect(rgbToSaturation(rgb(0, 0, 255))).toBe(100);
  });

  it("returns 0 for pure black (V = 0)", () => {
    expect(rgbToSaturation(rgb(0, 0, 0))).toBe(0);
  });

  it("returns 0 for pure white and any gray (S = 0)", () => {
    expect(rgbToSaturation(rgb(255, 255, 255))).toBe(0);
    expect(rgbToSaturation(rgb(128, 128, 128))).toBe(0);
    expect(rgbToSaturation(rgb(64, 64, 64))).toBe(0);
  });

  it("returns a value near 50% for pale red (mid-saturation)", () => {
    // hsv(0, 50, 100) → rgb(255, 128, 128); the round-trip through our
    // hsvToRgb produces integer RGB, so tolerate a ±1% rounding error.
    const paleRed = hsvToRgb(0, 50, 100);
    const s = rgbToSaturation(paleRed);
    expect(Math.abs(s - 50)).toBeLessThanOrEqual(1);
  });

  it("round-trips saturation values produced by hsvToRgb within 1%", () => {
    for (const targetSat of [25, 40, 60, 75, 80, 95]) {
      const color = hsvToRgb(180, targetSat, 100);
      const measured = rgbToSaturation(color);
      expect(
        Math.abs(measured - targetSat),
        `hue=180 sat=${targetSat}% measured=${measured}%`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("reports the correct saturation for Govee's sample pastel (198, 255, 112)", () => {
    // The live-diagnostic capture during #168 testing showed this exact
    // triple arriving at the Backlight. Reverse-engineered to ~56%.
    expect(rgbToSaturation(rgb(198, 255, 112))).toBe(56);
  });
});
