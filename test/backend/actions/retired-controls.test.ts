import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { renderStatusKey } from "../../../src/backend/actions/shared/status-badge";

it("offers only the unified dial actions, without retired UUIDs", () => {
  const manifest = JSON.parse(
    readFileSync(
      "com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json",
      "utf8",
    ),
  );
  expect(manifest.Actions).toHaveLength(14);
  for (const suffix of [
    "brightness-dial",
    "colorhue-dial",
    "colortemp-dial",
    "segment-color-dial",
  ]) {
    expect(
      manifest.Actions.some((action: { UUID: string }) =>
        action.UUID.endsWith(`.${suffix}`),
      ),
    ).toBe(false);
  }
  for (const suffix of [
    "brightness",
    "color",
    "colortemp",
    "segment-color",
    "saturation-dial",
  ]) {
    const action = manifest.Actions.find((action: { UUID: string }) =>
      action.UUID.endsWith(`.${suffix}`),
    );
    expect(action.Controllers).toEqual(["Keypad", "Encoder"]);
  }
});

it("never renders the retired corner dot", () => {
  const svg = '<svg viewBox="0 0 288 288"><rect/></svg>';
  for (const state of ["on", "off", "partial"] as const) {
    expect(renderStatusKey(svg, state)).not.toContain("data-status=");
  }
});
