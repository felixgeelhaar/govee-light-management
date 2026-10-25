// Renders docs/brand/plugin-icon.svg to the manifest's plugin icon PNGs:
// 256×256 (marketplace.png) and 512×512 (marketplace@2x.png), per Elgato's
// plugin guidelines. Run: node scripts/render-plugin-icon.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync("docs/brand/plugin-icon.svg", "utf8");
const out = "com.felixgeelhaar.govee-light-management.sdPlugin/imgs/plugin";
const browser = await chromium.launch();
for (const [size, file] of [
  [256, "marketplace.png"],
  [512, "marketplace@2x.png"],
]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({ path: `${out}/${file}`, omitBackground: true });
  await page.close();
}
await browser.close();
