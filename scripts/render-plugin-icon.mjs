// Renders docs/brand/plugin-icon.svg to the manifest's plugin icon PNGs:
// 256×256 (<Icon>.png) and 512×512 (the high-DPI variant), per Elgato's
// plugin guidelines. Run: node scripts/render-plugin-icon.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const plugin = "com.felixgeelhaar.govee-light-management.sdPlugin";
const { Icon } = JSON.parse(readFileSync(`${plugin}/manifest.json`, "utf8"));
const svg = readFileSync("docs/brand/plugin-icon.svg", "utf8");
const browser = await chromium.launch();
for (const [size, suffix] of [
  [256, ""],
  [512, "@2x"],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({
    path: `${plugin}/${Icon}${suffix}.png`,
    omitBackground: true,
  });
  await page.close();
}
await browser.close();
