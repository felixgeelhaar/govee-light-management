/**
 * Elgato plugin guidelines that can be checked statically:
 * https://docs.elgato.com/guidelines/stream-deck/plugins
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "com.felixgeelhaar.govee-light-management.sdPlugin";
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8"));

type ManifestAction = {
  Name: string;
  Icon: string;
  States: { Image: string }[];
  Encoder?: { Icon?: string; background?: string };
};
const actions = manifest.Actions as ManifestAction[];

const imageFile = (path: string) =>
  [".svg", ".png", "@2x.png"]
    .map((ext) => `${root}/${path}${ext}`)
    .find((file) => existsSync(file));

const pngSize = (file: string) => {
  const header = readFileSync(file);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
};

describe("Elgato guidelines", () => {
  it("references only images that exist", () => {
    const paths = [
      manifest.Icon,
      manifest.CategoryIcon,
      ...actions.flatMap((action) => [
        action.Icon,
        ...action.States.map((state) => state.Image),
        action.Encoder?.Icon,
        action.Encoder?.background,
      ]),
    ].filter(Boolean) as string[];
    expect(paths.filter((path) => !imageFile(path))).toEqual([]);
  });

  it("ships the plugin icon as 256 × 256 and 512 × 512 PNGs", () => {
    expect(pngSize(`${root}/${manifest.Icon}.png`)).toEqual([256, 256]);
    expect(pngSize(`${root}/${manifest.Icon}@2x.png`)).toEqual([512, 512]);
  });

  it("draws category, action-list and dial icons in white only", () => {
    const icons = [
      manifest.CategoryIcon,
      ...actions.flatMap((action) => [action.Icon, action.Encoder?.Icon]),
    ].filter(Boolean) as string[];
    for (const icon of icons) {
      const svg = readFileSync(imageFile(icon)!, "utf8");
      const colours = svg.match(/#[0-9a-f]{3,8}\b|url\(#/gi) ?? [];
      expect(
        colours.filter((colour) => !/^#f{3}(f{3})?$/i.test(colour)),
        icon,
      ).toEqual([]);
    }
  });

  it("gives every key its own key artwork, not the action-list icon", () => {
    for (const action of actions)
      for (const state of action.States)
        expect(state.Image, action.Name).not.toBe(action.Icon);
  });

  it("keeps action names to about 30 characters", () => {
    for (const action of actions)
      expect(action.Name.length, action.Name).toBeLessThanOrEqual(30);
  });

  const inspectors = readdirSync(`${root}/ui`).filter((file) =>
    file.endsWith(".html"),
  );

  it("prompts for a light instead of showing an empty or misleading device list", () => {
    for (const file of inspectors) {
      const html = readFileSync(`${root}/ui/${file}`, "utf8");
      for (const select of html.match(
        /<sdpi-select\b[^>]*datasource="getDevices"[^>]*>/g,
      ) ?? [])
        expect(select, file).toMatch(/placeholder="Select a light[^"]*"/);
    }
  });

  it("links setup help to Govee's API key page from every inspector", () => {
    for (const file of inspectors) {
      const html = readFileSync(`${root}/ui/${file}`, "utf8");
      expect(html, file).toMatch(
        /<a[^>]*href="https:\/\/developer\.govee\.com\/[^"]*"[^>]*data-open-url/,
      );
    }
  });

  it("offers the shared group manager in every inspector", () => {
    for (const file of inspectors) {
      const html = readFileSync(`${root}/ui/${file}`, "utf8");
      expect(html, file).toContain('id="groupManager"');
    }
  });

  it("saves inspector settings through the SDPI store, never by replacing them", () => {
    for (const file of inspectors) {
      const html = readFileSync(`${root}/ui/${file}`, "utf8");
      expect(html, file).not.toMatch(/\.setSettings\(/);
    }
  });
});
