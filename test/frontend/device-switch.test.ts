import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const ui = "com.felixgeelhaar.govee-light-management.sdPlugin/ui";
const script = readFileSync(`${ui}/js/device-switch.js`, "utf8");

describe("device switch detection", () => {
  let isSwitch: (previous: string, next: string) => boolean;
  beforeAll(() => {
    window.eval(script);
    isSwitch = (
      window as unknown as {
        GoveeDeviceSwitch: { isSwitch: typeof isSwitch };
      }
    ).GoveeDeviceSwitch.isSwitch;
  });

  it("treats the first light an inspector sees as the saved one, not a switch (#388)", () => {
    // Reopening a key starts with no previous light; clearing the saved
    // scene/mode/snapshot here is what wiped settings on every reopen.
    expect(isSwitch("", "light:AA|H6056")).toBe(false);
    expect(isSwitch("", "")).toBe(false);
  });

  it("is a switch when the user moves to another light or clears the light", () => {
    expect(isSwitch("light:AA|H6056", "light:BB|H61B5")).toBe(true);
    expect(isSwitch("light:AA|H6056", "")).toBe(true);
  });

  it("is not a switch when the light is unchanged", () => {
    expect(isSwitch("light:AA|H6056", "light:AA|H6056")).toBe(false);
  });
});

describe("inspectors with a selection that depends on the light", () => {
  for (const page of ["music-mode", "scene", "snapshot", "recall", "toggle"]) {
    it(`${page} only clears its selection on a real light switch`, () => {
      const html = readFileSync(`${ui}/${page}.html`, "utf8");
      expect(html).toContain('src="./js/device-switch.js"');
      expect(html).toContain("GoveeDeviceSwitch.isSwitch(");
    });
  }
});
