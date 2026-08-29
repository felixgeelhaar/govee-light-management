import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyStatusImage,
  KEY_ART_NAMES,
  loadKeyArt,
  powerStatus,
  renderStatusKey,
  resolveArtRoot,
  resolveKeyArt,
  statusKeyDataUri,
  statusKeyImage,
  type PowerStatus,
  setStatusBadgeVisible,
  isStatusBadgeVisible,
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

/**
 * Shaped like the shipped key art, which draws everything in one three-stop
 * gradient. BASE_SVG has no gradient at all, so it cannot exercise the state
 * shift — a bare rect would silently pass any assertion about stop offsets.
 */
const GRADIENT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 288">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="288" y2="288">' +
  '<stop offset="0" stop-color="#A855F7"/>' +
  '<stop offset=".5" stop-color="#6366F1"/>' +
  '<stop offset="1" stop-color="#22D3EE"/>' +
  "</linearGradient></defs>" +
  '<rect x="14" y="14" width="260" height="260" rx="40" fill="url(#g)"/>' +
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

  it("preserves the documented ●/◐/○ vocabulary from #194", () => {
    // These were the glyphs the title used to carry. The badge shapes
    // replaced them one-for-one, so the mapping has to stay stable or
    // users relearn the shape language.
    const glyphForStatus: Record<Exclude<PowerStatus, "unknown">, string> = {
      on: "●",
      partial: "◐",
      off: "○",
    };
    const cases = [
      { summary: undefined, isOn: true, glyph: "●" },
      { summary: undefined, isOn: false, glyph: "○" },
      { summary: { onCount: 2, totalCount: 2 }, isOn: true, glyph: "●" },
      { summary: { onCount: 1, totalCount: 2 }, isOn: true, glyph: "◐" },
      { summary: { onCount: 0, totalCount: 2 }, isOn: false, glyph: "○" },
    ];
    for (const c of cases) {
      const status = powerStatus(c.summary, c.isOn) as Exclude<
        PowerStatus,
        "unknown"
      >;
      expect(glyphForStatus[status]).toBe(c.glyph);
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
    // 0.55, not the old 0.4. Grey-and-faded read as broken rather than off
    // (#339), so off now carries the gradient too and only sits back a little.
    const svg = renderStatusKey(BASE_SVG, "off");
    expect(svg).toContain('opacity="0.55"');
    // The dimming group must close before the badge group opens.
    expect(svg.indexOf("</g>")).toBeLessThan(svg.indexOf('data-status="off"'));
  });

  it("does not dim the artwork when on or partial", () => {
    // The badge's backing disc carries fill-opacity, so this has to look for
    // the artwork wrapper specifically rather than any opacity at all.
    expect(renderStatusKey(BASE_SVG, "on")).not.toContain("<g opacity=");
    expect(renderStatusKey(BASE_SVG, "partial")).not.toContain("<g opacity=");
  });

  it("shifts the gradient midpoint per state without inventing a colour", () => {
    // Only the middle stop moves. The end colours are the artwork's own, so
    // a state can never introduce a hue the key was not drawn in.
    const midpoint = (status: "on" | "partial" | "off") => {
      const svg = renderStatusKey(GRADIENT_SVG, status, false);
      const stops = [...svg.matchAll(/offset="([\d.]+)"/g)];
      return Number(stops[1]![1]);
    };

    // Cyan end dominates for on, purple end for off, authored balance between.
    expect(midpoint("on")).toBeLessThan(midpoint("partial"));
    expect(midpoint("partial")).toBeLessThan(midpoint("off"));
    // The end colours never move, so no new hue can appear.
    const ends = [
      ...renderStatusKey(GRADIENT_SVG, "off", false).matchAll(
        /stop-color="([^"]+)"/g,
      ),
    ];
    expect(ends.map((m) => m[1])).toEqual(["#A855F7", "#6366F1", "#22D3EE"]);
  });

  it("omits the badge when the dot is turned off", () => {
    // #339 asked to ditch the dot. It is opt-out rather than gone, because
    // without it partial leans toward on.
    expect(renderStatusKey(BASE_SVG, "partial", false)).not.toContain(
      "data-status=",
    );
    expect(renderStatusKey(BASE_SVG, "partial", true)).toContain(
      "data-status=",
    );
  });

  it("still separates every state when the dot is hidden", () => {
    const [on, partial, off] = (["on", "partial", "off"] as const).map((s) =>
      renderStatusKey(GRADIENT_SVG, s, false),
    );
    expect(new Set([on, partial, off]).size).toBe(3);
  });

  it("leaves artwork alone when its gradient is not three stops", () => {
    const twoStop = GRADIENT_SVG.replace(/<stop offset="\.5"[^>]*\/>/, "");
    const offsets = [
      ...renderStatusKey(twoStop, "off", false).matchAll(/offset="([^"]+)"/g),
    ];
    expect(offsets.map((m) => m[1])).toEqual(["0", "1"]);
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

/** The three states the light action ships hand-drawn artwork for (#339). */
const DRAWN_STATES = ["on", "partial", "off"] as const;

describe("resolveKeyArt", () => {
  it("ships state artwork for every drawn state of the light action", () => {
    for (const status of DRAWN_STATES) {
      const file = new URL(`light/state-${status}.svg`, REAL_ART_ROOT);
      expect(
        existsSync(fileURLToPath(file)),
        `missing light/state-${status}.svg`,
      ).toBe(true);
    }
  });

  it("prefers artwork drawn for the state", () => {
    for (const status of DRAWN_STATES) {
      const art = resolveKeyArt("light", status, REAL_ART_ROOT);
      expect(art.authoredForState).toBe(true);
      // Not merely "some svg" — it must differ from the generic key.svg,
      // or the resolver could be falling back and the test would not notice.
      expect(art.svg).not.toBe(loadKeyArt("light", REAL_ART_ROOT));
    }
  });

  it("draws off as a closed ring rather than the shipped filament", () => {
    const off = resolveKeyArt("light", "off", REAL_ART_ROOT).svg;
    // The shipped filament is a dashed circle plus a stem — the power mark.
    // The off glyph closes the dash and drops the stem, giving a plain O.
    expect(loadKeyArt("light", REAL_ART_ROOT)).toContain("stroke-dasharray");
    expect(off).not.toContain("stroke-dasharray");
  });

  it("falls back to key.svg for an action with no state artwork", () => {
    const art = resolveKeyArt("brightness", "off", REAL_ART_ROOT);
    expect(art.authoredForState).toBe(false);
    expect(art.svg).toBe(loadKeyArt("brightness", REAL_ART_ROOT));
  });

  it("falls back for an unknown status, which has no artwork of its own", () => {
    const art = resolveKeyArt("light", "unknown", REAL_ART_ROOT);
    expect(art.authoredForState).toBe(false);
    expect(art.svg).toBe(loadKeyArt("light", REAL_ART_ROOT));
  });

  it("caches both hits and misses", () => {
    expect(resolveKeyArt("light", "off", REAL_ART_ROOT)).toBe(
      resolveKeyArt("light", "off", REAL_ART_ROOT),
    );
    expect(resolveKeyArt("brightness", "off", REAL_ART_ROOT)).toBe(
      resolveKeyArt("brightness", "off", REAL_ART_ROOT),
    );
  });
});

describe("the badge and the drawn glyph never appear together", () => {
  /** Decode what the plugin actually hands to `setImage()`. */
  const rendered = (status: PowerStatus, showDot: boolean): string =>
    Buffer.from(
      statusKeyImage("light", status, REAL_ART_ROOT, showDot).split(",")[1]!,
      "base64",
    ).toString("utf-8");

  it("keeps the artwork neutral while the badge is shown", () => {
    // The drawn off state is a plain ring; the shipped filament is a dashed
    // circle plus a stem. With the badge on, the shipped one has to win.
    const svg = rendered("off", true);
    expect(svg).toContain("data-status=");
    expect(svg).toContain("stroke-dasharray");
  });

  it("hands the job to the drawn glyph once the badge is hidden", () => {
    const svg = rendered("off", false);
    expect(svg).not.toContain("data-status=");
    expect(svg).not.toContain("stroke-dasharray");
  });

  it("still dims a generated off key, but never a drawn one", () => {
    expect(rendered("off", true)).toContain("<g opacity=");
    expect(rendered("off", false)).not.toContain("<g opacity=");
  });

  it("falls back to the generated treatment where nothing is drawn", () => {
    const svg = Buffer.from(
      statusKeyImage("brightness", "off", REAL_ART_ROOT, false).split(",")[1]!,
      "base64",
    ).toString("utf-8");
    // Badge hidden and no drawn art to take over, so the generated dim is
    // the only thing left saying "off".
    expect(svg).not.toContain("data-status=");
    expect(svg).toContain("<g opacity=");
  });
});

describe("renderStatusKey with artwork drawn for the state", () => {
  /** Offset of the gradient's middle stop, which the generated shift moves. */
  const midpoints = (svg: string): string[] =>
    [...svg.matchAll(/<stop offset="([^"]+)"/g)].map((m) => m[1]);

  it("leaves the gradient where the artist put it", () => {
    // Both directions: without the flag the midpoint is driven to 0.9,
    // with it the authored .5 survives. Asserting only one would pass
    // even if the flag did nothing.
    expect(
      midpoints(renderStatusKey(GRADIENT_SVG, "off", false, false)),
    ).toEqual(["0", "0.9", "1"]);
    expect(
      midpoints(renderStatusKey(GRADIENT_SVG, "off", false, true)),
    ).toEqual(["0", ".5", "1"]);
  });

  it("does not dim an off key that was drawn as off", () => {
    expect(renderStatusKey(GRADIENT_SVG, "off", false, true)).not.toContain(
      "<g opacity=",
    );
    expect(renderStatusKey(GRADIENT_SVG, "off", false, false)).toContain(
      "<g opacity=",
    );
  });

  it("still composites the badge when the dot is on", () => {
    expect(renderStatusKey(GRADIENT_SVG, "partial", true, true)).toContain(
      'data-status="partial"',
    );
    expect(renderStatusKey(GRADIENT_SVG, "partial", false, true)).not.toContain(
      'data-status="partial"',
    );
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

describe("the global badge preference", () => {
  afterEach(() => setStatusBadgeVisible(true));

  it("defaults to visible", () => {
    expect(isStatusBadgeVisible()).toBe(true);
  });

  it("takes effect on keys rendered after it changes", async () => {
    // The cache is keyed by the preference, but the default argument is
    // resolved at call time — so a stale cache would keep painting the old
    // look until the plugin restarted. Setting it clears the cache.
    const painted: string[] = [];
    const action = {
      setImage: async (img?: string) => void painted.push(img ?? ""),
    };

    await applyStatusImage(action, "light", "on", REAL_ART_ROOT);
    setStatusBadgeVisible(false);
    await applyStatusImage(action, "light", "on", REAL_ART_ROOT);

    expect(painted).toHaveLength(2);
    expect(painted[0]).not.toBe(painted[1]);
  });

  it("ignores a set to the value it already holds", () => {
    setStatusBadgeVisible(true);
    expect(isStatusBadgeVisible()).toBe(true);
  });
});
