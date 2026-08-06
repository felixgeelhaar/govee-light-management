import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { powerGlyph } from "../../../../src/backend/actions/shared/power-state";
import {
  applyStatusImage,
  KEY_ART_NAMES,
  loadKeyArt,
  powerStatus,
  renderStatusKey,
  resolveArtRoot,
  statusKeyDataUri,
  statusKeyImage,
  type PowerStatus,
} from "../../../../src/backend/actions/shared/status-badge";

/**
 * The real plugin art directory, used to prove the loader wiring works.
 * Resolved from the repo root rather than `import.meta.url` — Vitest
 * does not always hand modules a `file:` URL.
 */
const REAL_ART_ROOT = new URL(
  "com.felixgeelhaar.govee-light-management.sdPlugin/imgs/actions/",
  pathToFileURL(`${process.cwd()}/`),
);

const BASE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 288">' +
  '<rect x="14" y="14" width="260" height="260" rx="40" fill="#0B0E1A"/>' +
  "</svg>";

describe("powerStatus", () => {
  it("reports unknown when nothing has been sampled yet", () => {
    expect(powerStatus(undefined, undefined)).toBe("unknown");
  });

  it("reports on for a single light that is on", () => {
    expect(powerStatus(undefined, true)).toBe("on");
  });

  it("reports off for a single light that is off", () => {
    expect(powerStatus(undefined, false)).toBe("off");
  });

  it("reports on when every group member is on", () => {
    expect(powerStatus({ onCount: 3, totalCount: 3 }, true)).toBe("on");
  });

  it("reports partial when some but not all members are on", () => {
    expect(powerStatus({ onCount: 1, totalCount: 3 }, true)).toBe("partial");
  });

  it("reports off when no group member is on", () => {
    expect(powerStatus({ onCount: 0, totalCount: 3 }, false)).toBe("off");
  });

  it("ignores a zero-total summary and falls back to single-light state", () => {
    expect(powerStatus({ onCount: 0, totalCount: 0 }, true)).toBe("on");
  });

  it("agrees with the title's powerGlyph on every three-state case", () => {
    // The badge stands in for the title glyph when a user title has
    // hidden it, so the two must describe the same state — a key must
    // never read as on in the title and off on the artwork.
    const glyphForStatus: Record<Exclude<PowerStatus, "unknown">, string> = {
      on: "●",
      partial: "◐",
      off: "○",
    };
    const cases: Array<{
      summary: { onCount: number; totalCount: number } | undefined;
      isOn: boolean;
    }> = [
      { summary: undefined, isOn: true },
      { summary: undefined, isOn: false },
      { summary: { onCount: 2, totalCount: 2 }, isOn: true },
      { summary: { onCount: 1, totalCount: 2 }, isOn: true },
      { summary: { onCount: 0, totalCount: 2 }, isOn: false },
    ];
    for (const c of cases) {
      const status = powerStatus(c.summary, c.isOn) as Exclude<
        PowerStatus,
        "unknown"
      >;
      expect(glyphForStatus[status]).toBe(powerGlyph(c.summary, c.isOn));
    }
  });
});

describe("renderStatusKey", () => {
  it("returns the artwork untouched when the state is unknown", () => {
    expect(renderStatusKey(BASE_SVG, "unknown")).toBe(BASE_SVG);
  });

  it("keeps the original artwork inside the composited key", () => {
    const svg = renderStatusKey(BASE_SVG, "on");
    expect(svg).toContain('<rect x="14" y="14"');
    expect(svg).toContain('viewBox="0 0 288 288"');
  });

  it("emits exactly one root svg element", () => {
    const svg = renderStatusKey(BASE_SVG, "on");
    expect(svg.match(/<svg\b/g)).toHaveLength(1);
    expect(svg.match(/<\/svg>/g)).toHaveLength(1);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("declares the svg namespace so Stream Deck can rasterise it", () => {
    expect(renderStatusKey(BASE_SVG, "on")).toContain(
      'xmlns="http://www.w3.org/2000/svg"',
    );
  });

  it("draws a filled badge when everything is on", () => {
    const svg = renderStatusKey(BASE_SVG, "on");
    expect(svg).toContain('data-status="on"');
    expect(svg).toContain('fill="#22D3EE"');
  });

  it("draws a half-filled badge when a group is partially on", () => {
    const svg = renderStatusKey(BASE_SVG, "partial");
    expect(svg).toContain('data-status="partial"');
    // The half disc is an arc path, not a plain circle fill.
    expect(svg).toMatch(/<path d="M [\d.]+ [\d.]+ A /);
  });

  it("draws a hollow badge when everything is off", () => {
    const svg = renderStatusKey(BASE_SVG, "off");
    expect(svg).toContain('data-status="off"');
    expect(svg).toContain('stroke="#64748B"');
    expect(svg).not.toContain('fill="#22D3EE"');
  });

  it("dims the artwork when off but leaves the badge at full strength", () => {
    const svg = renderStatusKey(BASE_SVG, "off");
    expect(svg).toContain('opacity="0.4"');
    // The dimming group must close before the badge group opens.
    expect(svg.indexOf("</g>")).toBeLessThan(svg.indexOf('data-status="off"'));
  });

  it("does not dim the artwork when on or partial", () => {
    expect(renderStatusKey(BASE_SVG, "on")).not.toContain('opacity="0.4"');
    expect(renderStatusKey(BASE_SVG, "partial")).not.toContain('opacity="0.4"');
  });

  it("places the badge in the top-right quadrant, clear of a bottom title", () => {
    const svg = renderStatusKey(BASE_SVG, "on");
    const badge = /<circle cx="([\d.]+)" cy="([\d.]+)"/.exec(
      svg.slice(svg.indexOf('data-status="on"')),
    );
    expect(badge).not.toBeNull();
    const cx = Number(badge![1]);
    const cy = Number(badge![2]);
    expect(cx).toBeGreaterThan(144);
    expect(cy).toBeLessThan(144);
    // Inside the 14..274 rounded card so it never clips at the key edge.
    expect(cx).toBeLessThan(274);
    expect(cy).toBeGreaterThan(14);
  });

  it("scales the badge to a non-288 viewBox", () => {
    const small = renderStatusKey(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144"><rect/></svg>',
      "on",
    );
    expect(small).toContain('viewBox="0 0 144 144"');
    const badge = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(
      small.slice(small.indexOf('data-status="on"')),
    );
    expect(Number(badge![1])).toBeLessThan(144);
    expect(Number(badge![3])).toBeLessThan(144 / 2);
  });

  it("honours a viewBox with a non-zero origin", () => {
    const shifted = renderStatusKey(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 200 288 288"><rect/></svg>',
      "on",
    );
    const badge = /<circle cx="([\d.]+)" cy="([\d.]+)"/.exec(
      shifted.slice(shifted.indexOf('data-status="on"')),
    );
    expect(Number(badge![1])).toBeGreaterThan(100);
    expect(Number(badge![2])).toBeGreaterThan(200);
  });

  it("assumes a 288 square when the artwork omits a viewBox", () => {
    const svg = renderStatusKey(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
      "on",
    );
    expect(svg).toContain('viewBox="0 0 288 288"');
  });

  it("throws on input that is not an svg document", () => {
    expect(() => renderStatusKey("<html></html>", "on")).toThrow(/not an svg/i);
  });
});

describe("statusKeyDataUri", () => {
  it("encodes the composited key as a base64 svg data uri", () => {
    const uri = statusKeyDataUri(BASE_SVG, "on");
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = Buffer.from(
      uri.slice("data:image/svg+xml;base64,".length),
      "base64",
    ).toString("utf-8");
    expect(decoded).toBe(renderStatusKey(BASE_SVG, "on"));
  });
});

describe("resolveArtRoot", () => {
  it("resolves art relative to the bundled plugin in bin/", () => {
    const root = resolveArtRoot(
      "file:///Applications/plugins/govee.sdPlugin/bin/plugin.js",
    );
    expect(root.href).toBe(
      "file:///Applications/plugins/govee.sdPlugin/imgs/actions/",
    );
  });
});

describe("loadKeyArt", () => {
  it("loads real key artwork from the plugin folder", () => {
    const art = loadKeyArt("light", REAL_ART_ROOT);
    expect(art).toContain("<svg");
    expect(art).toContain("viewBox");
  });

  it("caches repeated reads of the same artwork", () => {
    expect(loadKeyArt("light", REAL_ART_ROOT)).toBe(
      loadKeyArt("light", REAL_ART_ROOT),
    );
  });

  it("throws for artwork that does not exist", () => {
    expect(() => loadKeyArt("no-such-action", REAL_ART_ROOT)).toThrow();
  });

  it("ships key.svg for every action the badge is wired into", () => {
    for (const name of KEY_ART_NAMES) {
      const file = new URL(`${name}/key.svg`, REAL_ART_ROOT);
      expect(
        existsSync(fileURLToPath(file)),
        `missing key art for "${name}"`,
      ).toBe(true);
    }
  });

  it("renders a badge onto every shipped action artwork", () => {
    for (const name of KEY_ART_NAMES) {
      const uri = statusKeyImage(name, "partial", REAL_ART_ROOT);
      expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    }
  });
});

describe("applyStatusImage", () => {
  it("pushes the composited key to the action", async () => {
    const setImage = vi.fn().mockResolvedValue(undefined);
    await applyStatusImage({ setImage }, "light", "on", REAL_ART_ROOT);
    expect(setImage).toHaveBeenCalledTimes(1);
    expect(setImage.mock.calls[0][0]).toBe(
      statusKeyImage("light", "on", REAL_ART_ROOT),
    );
  });

  it("skips actions with no setImage, such as encoders on old firmware", async () => {
    await expect(
      applyStatusImage({}, "light", "on", REAL_ART_ROOT),
    ).resolves.toBeUndefined();
  });

  it("leaves the manifest image in place when the artwork is missing", async () => {
    const setImage = vi.fn().mockResolvedValue(undefined);
    await applyStatusImage({ setImage }, "no-such-action", "on", REAL_ART_ROOT);
    expect(setImage).not.toHaveBeenCalled();
  });

  it("swallows a setImage rejection from an action that disappeared", async () => {
    const setImage = vi.fn().mockRejectedValue(new Error("gone"));
    await expect(
      applyStatusImage({ setImage }, "light", "on", REAL_ART_ROOT),
    ).resolves.toBeUndefined();
  });

  it("resets to the manifest image when the state is unknown", async () => {
    // setImage sticks until it is cleared, so a key that stops showing
    // state — retargeted, or switched to a plain on/off command — has
    // to drop back to its manifest artwork rather than keep a stale badge.
    const setImage = vi.fn().mockResolvedValue(undefined);
    await applyStatusImage({ setImage }, "light", "unknown", REAL_ART_ROOT);
    expect(setImage).toHaveBeenCalledWith();
  });
});
