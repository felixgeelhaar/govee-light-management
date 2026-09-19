/**
 * Renders the power-state indicator into the *key image* rather than the
 * key title.
 *
 * Stream Deck applies a strict precedence when drawing a key:
 * user-defined title > plugin `setTitle()` > manifest default. So the
 * moment a user types anything into the Title field, every `setTitle()`
 * call is silently dropped — and with it the ●/◐/○ status glyph the
 * plugin had been drawing there (#333). Images have no such override:
 * `setImage()` only yields to an image the user picked deliberately,
 * which is a separate opt-in almost nobody uses.
 *
 * So the glyph moves onto the artwork. This module takes an action's
 * shipped `key.svg`, shifts the artwork's own gradient toward one end to
 * signal the state, optionally composites a status badge into the top-right
 * corner (clear of the bottom-aligned title), and hands back a data URI
 * ready for `setImage()`.
 *
 * The badge can be turned off globally (#339). The gradient shift cannot:
 * it replaced a desaturate-to-grey treatment that was hard to read across
 * a room, and there is no user for whom grey is preferable.
 *
 * The badge shapes mirror `powerGlyph()` in `power-state.ts` one-for-one
 * so users learn a single shape language:
 *   ● filled  — every controllable member is on
 *   ◐ half    — at least one but not all members are on
 *   ○ hollow  — every controllable member is off
 * plus a fourth "unknown" case that draws no badge at all, for the
 * frames before the first state sync lands.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GroupPowerSummary } from "./power-state";

export type PowerStatus = "on" | "partial" | "off" | "unknown";

/**
 * Artwork folders under `imgs/actions/` that the badge is wired into.
 * Kept here so a test can assert every one of them actually ships a
 * `key.svg` — a missing file would silently cost the badge at runtime.
 */
export const KEY_ART_NAMES = [
  "light",
  "brightness",
  "color",
  "colortemp",
  "segment-color",
  "saturation-dial",
  "toggle",
  "recall",
] as const;

export type KeyArtName = (typeof KEY_ART_NAMES)[number];

/** Brand cyan, shared with the gradient in the shipped artwork. */
const ON_COLOR = "#22D3EE";
/** Muted slate for the off ring — visible, but clearly inactive. */
const OFF_COLOR = "#64748B";
/** Key background, used as a backing disc so the badge reads over art. */
const BACKING_COLOR = "#0B0E1A";

const DEFAULT_VIEWBOX = { x: 0, y: 0, width: 288, height: 288 };

const SVG_OPEN_TAG = /<svg\b([^>]*)>/i;
const VIEWBOX_ATTR = /viewBox\s*=\s*["']([^"']+)["']/i;

/**
 * Maps the same inputs `powerGlyph()` takes onto the badge's four-state
 * vocabulary. Unlike `powerGlyph()`, "nothing sampled yet" is
 * distinguishable from "off" — the badge omits itself rather than
 * claiming the light is off before the first sync lands.
 */
export function powerStatus(
  summary: GroupPowerSummary | undefined,
  fallbackIsOn: boolean | undefined,
): PowerStatus {
  if (summary && summary.totalCount > 0) {
    if (summary.onCount === 0) return "off";
    if (summary.onCount === summary.totalCount) return "on";
    return "partial";
  }
  if (fallbackIsOn === undefined) return "unknown";
  return fallbackIsOn ? "on" : "off";
}

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseViewBox(attrs: string): ViewBox {
  const match = VIEWBOX_ATTR.exec(attrs);
  if (!match) return DEFAULT_VIEWBOX;

  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return DEFAULT_VIEWBOX;
  }
  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) return DEFAULT_VIEWBOX;
  return { x, y, width, height };
}

/** Trim to 3 decimals and drop the trailing zeros, keeping the SVG terse. */
function n(value: number): string {
  return String(Number(value.toFixed(3)));
}

/**
 * The status mark itself, drawn on a backing disc so it stays legible
 * over whatever the artwork puts underneath it.
 */
function renderBadge(
  status: Exclude<PowerStatus, "unknown">,
  box: ViewBox,
): string {
  const unit = Math.min(box.width, box.height);
  const radius = unit * 0.105;
  // Sit the badge on the centre of the artwork's rounded corner arc
  // (inset 14 + radius 40 on the shared 288 template). Any closer to
  // the edge and the disc spills past the rounded border.
  const inset = unit * 0.1875;
  const cx = box.x + box.width - inset;
  const cy = box.y + inset;
  const mark = radius * 0.72;
  const stroke = radius * 0.26;

  const backing =
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius)}" ` +
    `fill="${BACKING_COLOR}" fill-opacity="0.85"/>`;

  let shape: string;
  if (status === "on") {
    shape = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(mark)}" fill="${ON_COLOR}"/>`;
  } else if (status === "off") {
    shape =
      `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(mark)}" fill="none" ` +
      `stroke="${OFF_COLOR}" stroke-width="${n(stroke)}"/>`;
  } else {
    // Half disc: sweep 0 from top to bottom traces the left semicircle,
    // matching the ◐ glyph. The ring around it keeps the full extent
    // readable at Stream Deck's 72 px key size.
    shape =
      `<path d="M ${n(cx)} ${n(cy - mark)} A ${n(mark)} ${n(mark)} 0 0 0 ` +
      `${n(cx)} ${n(cy + mark)} Z" fill="${ON_COLOR}"/>` +
      `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(mark)}" fill="none" ` +
      `stroke="${ON_COLOR}" stroke-width="${n(stroke)}"/>`;
  }

  return `<g data-status="${status}">${backing}${shape}</g>`;
}

/**
 * Where the artwork's own gradient is pushed for each state.
 *
 * The shipped key art is drawn in one linear gradient running purple →
 * indigo → cyan. Rather than introducing a second colour language, each
 * state slides that gradient's midpoint so one end dominates: purple for
 * off, cyan for on, and the authored balance for partial.
 *
 * This replaces a desaturate-and-fade treatment. Greying the artwork is
 * the one change guaranteed to cost legibility at a distance, which is
 * what #339 reported — an off key was hard to tell from a lit one across
 * a room. A hue shift keeps the mark bright and still reads as plainly
 * different.
 */
const GRADIENT_MIDPOINT: Record<Exclude<PowerStatus, "unknown">, number> = {
  // Cyan reaches almost to the start, so the key reads as lit.
  on: 0.1,
  // The artwork's own balance, so a mixed group sits visibly between the two.
  partial: 0.5,
  // Purple holds almost the whole sweep, so the key reads as cold.
  off: 0.9,
};

/**
 * Last-resort dim for an off key, used only when nothing else marks it.
 *
 * Hue is one axis, and on its own it cannot carry three states: wherever
 * `partial` sits it is adjacent to a neighbour. So a key always needs a
 * second axis, and there are three candidates in order of preference —
 * the corner badge, a glyph drawn into the artwork, and finally this dim.
 *
 * The first two are better because they say "off" rather than merely
 * "less". This is reached only with the badge hidden and no drawn state
 * art, which is every action but `light` today. It matters most for the
 * artwork the gradient barely touches: the colour wheel, the segment bars
 * and the saturation dial are drawn in their own fixed colours, so
 * shifting the gradient leaves `on` and `partial` nearly identical.
 */
const OFF_OPACITY = 0.55;

const GRADIENT_STOP = /<stop\b[^>]*offset\s*=\s*["']([^"']+)["'][^>]*>/gi;

/**
 * Slides the midpoint of the artwork's gradient toward one end.
 *
 * Only a three-stop gradient is touched, and only its middle stop moves —
 * the end colours stay exactly as authored, so this cannot introduce a
 * colour the artwork does not already use. Artwork with any other number
 * of stops is returned untouched rather than guessed at.
 */
function shiftGradient(
  body: string,
  status: Exclude<PowerStatus, "unknown">,
): string {
  const stops = [...body.matchAll(GRADIENT_STOP)];
  const middle = stops.length === 3 ? stops[1] : undefined;
  if (!middle || middle.index === undefined) {
    return body;
  }

  const shifted = middle[0].replace(
    /offset\s*=\s*["'][^"']+["']/i,
    `offset="${n(GRADIENT_MIDPOINT[status])}"`,
  );

  return (
    body.slice(0, middle.index) +
    shifted +
    body.slice(middle.index + middle[0].length)
  );
}

/**
 * Composite `baseSvg` with a status badge. Pure — no filesystem, no SDK
 * — so the geometry is straightforward to test.
 *
 * `authoredForState` marks artwork drawn for this exact state (#339), whose
 * gradient is then left exactly as the artist set it.
 *
 * A key carries hue plus exactly one more axis, and `showDot` and
 * `authoredForState` between them say which: the badge, the drawn glyph, or
 * — when neither is present — the off dim. Off is left at full colour
 * whenever something better is already marking it.
 *
 * @throws if `baseSvg` has no `<svg>` root element.
 */
export function renderStatusKey(
  baseSvg: string,
  status: PowerStatus,
  showDot = true,
  authoredForState = false,
): string {
  if (status === "unknown") return baseSvg;

  const open = SVG_OPEN_TAG.exec(baseSvg);
  const close = baseSvg.lastIndexOf("</svg>");
  if (!open || close < 0) {
    throw new Error("Key artwork is not an svg document");
  }

  const box = parseViewBox(open[1]);
  const body = baseSvg.slice(open.index + open[0].length, close);
  const shifted = authoredForState ? body : shiftGradient(body, status);
  // Dim only when nothing else marks the key as off — no badge above it and
  // no glyph drawn into it. See OFF_OPACITY for the ordering.
  const needsDim = status === "off" && !authoredForState && !showDot;
  const artwork = needsDim
    ? `<g opacity="${n(OFF_OPACITY)}">${shifted}</g>`
    : shifted;
  const viewBox = `${n(box.x)} ${n(box.y)} ${n(box.width)} ${n(box.height)}`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
    artwork +
    (showDot ? renderBadge(status, box) : "") +
    "</svg>"
  );
}

const DATA_URI_PREFIX = "data:image/svg+xml;base64,";

/** Encode a composited key for `setImage()`. */
export function statusKeyDataUri(
  baseSvg: string,
  status: PowerStatus,
  showDot = true,
  authoredForState = false,
): string {
  return (
    DATA_URI_PREFIX +
    Buffer.from(
      renderStatusKey(baseSvg, status, showDot, authoredForState),
    ).toString("base64")
  );
}

/**
 * Where the artwork lives relative to the running module. Rollup bundles
 * the plugin to `<plugin>.sdPlugin/bin/plugin.js`, and Stream Deck sets
 * CWD to that `bin/` directory — so resolving against the module URL
 * rather than `process.cwd()` keeps this correct either way.
 */
export function resolveArtRoot(moduleUrl: string): URL {
  return new URL("../imgs/actions/", moduleUrl);
}

const defaultArtRoot = resolveArtRoot(import.meta.url);
const artCache = new Map<string, string>();

/** Read `<artName>/key.svg`, memoised — the files never change at runtime. */
export function loadKeyArt(
  artName: string,
  root: URL | string = defaultArtRoot,
): string {
  const file = new URL(`${artName}/key.svg`, root);
  const cached = artCache.get(file.href);
  if (cached !== undefined) return cached;

  const svg = readFileSync(fileURLToPath(file), "utf-8");
  artCache.set(file.href, svg);
  return svg;
}

/** Artwork for one state, and whether it was drawn for that state. */
export interface KeyArt {
  svg: string;
  /**
   * True when the file was authored for this exact state, so the generated
   * gradient shift and the `off` dim must not be layered on top of it.
   */
  authoredForState: boolean;
}

/**
 * Resolved art per `(root, artName, status)`. Misses are cached too: an
 * action with no state art would otherwise attempt — and fail — a
 * filesystem read on every single repaint.
 */
const stateArtCache = new Map<string, KeyArt>();

/**
 * Pick the artwork for a state, preferring art drawn for it.
 *
 * `<artName>/state-<status>.svg` wins when it exists; otherwise the shipped
 * `<artName>/key.svg` is used and the generated treatment applies. This is
 * what lets hand-drawn states (#339) land one action at a time without
 * every other action needing artwork drawn for it.
 *
 * Consulted only while the corner badge is hidden — see `statusKeyImage()`.
 * With the badge on, the artwork deliberately stays neutral so the key does
 * not report the same state twice.
 *
 * Deliberately not `key-<status>.svg`: `key-off.svg` is already taken. Five
 * actions declare one as their manifest State 1 image, and those files are
 * the desaturate-to-grey treatment this feature exists to replace. Matching
 * that name would silently adopt the old look as though an artist had
 * chosen it.
 */
export function resolveKeyArt(
  artName: string,
  status: PowerStatus,
  root: URL | string = defaultArtRoot,
): KeyArt {
  if (status === "unknown") {
    return { svg: loadKeyArt(artName, root), authoredForState: false };
  }

  const cacheKey = `${String(root)}|${artName}|${status}`;
  const cached = stateArtCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let art: KeyArt;
  try {
    const file = new URL(`${artName}/state-${status}.svg`, root);
    art = {
      svg: readFileSync(fileURLToPath(file), "utf-8"),
      authoredForState: true,
    };
  } catch {
    // No state art for this action — fall back to the generated treatment.
    art = { svg: loadKeyArt(artName, root), authoredForState: false };
  }

  stateArtCache.set(cacheKey, art);
  return art;
}

const imageCache = new Map<string, string>();

/**
 * Whether the corner badge is drawn, globally.
 *
 * #339 asked to be rid of the dot now that the artwork itself carries the
 * state. It is opt-out rather than removed: without it `partial` leans
 * toward `on`, and it is the one cue that survives for someone who cannot
 * separate the colours.
 *
 * Held here rather than read from settings on every render. This module
 * stays free of the SDK and the settings service — which is what makes it
 * cheap to test — and the plugin pushes the value in at startup and
 * whenever global settings change.
 */
let badgeVisible = true;

/**
 * Sets the global badge preference.
 *
 * Clears the image cache, because entries rendered under the previous
 * preference are keyed by it but the *default* argument resolves at call
 * time — without this, keys already painted would keep their old look until
 * the plugin restarted.
 */
export function setStatusBadgeVisible(visible: boolean): void {
  if (visible === badgeVisible) return;
  badgeVisible = visible;
  imageCache.clear();
}

/** The current global badge preference. */
export function isStatusBadgeVisible(): boolean {
  return badgeVisible;
}

/** Composited data URI for an action's artwork in a given power state. */
export function statusKeyImage(
  artName: string,
  status: PowerStatus,
  root: URL | string = defaultArtRoot,
  showDot = true,
): string {
  // `showDot` is part of the key: the same art and status render two
  // different images depending on it, and a cache that ignored it would
  // serve whichever was asked for first until the plugin restarted.
  const key = `${String(root)}|${artName}|${status}|${showDot ? "dot" : "nodot"}`;
  const cached = imageCache.get(key);
  if (cached !== undefined) return cached;

  // One indicator at a time (#339). The corner badge and a glyph drawn
  // inside the bulb carry the same fact, so showing both states it twice.
  // The badge wins while it is on and the artwork stays neutral; switch the
  // badge off and the drawn states take the job over, which is the whole
  // reason the preference is worth having rather than just losing a dot.
  const art = showDot
    ? { svg: loadKeyArt(artName, root), authoredForState: false }
    : resolveKeyArt(artName, status, root);
  const uri = statusKeyDataUri(art.svg, status, showDot, art.authoredForState);
  imageCache.set(key, uri);
  return uri;
}

export interface ImageCapableAction {
  setImage?: (image?: string) => Promise<void>;
}

/**
 * Push the badged artwork to a key.
 *
 * A `"unknown"` status resets the key to its manifest artwork instead:
 * `setImage()` sticks until it is explicitly cleared, so a key that
 * stops displaying state — retargeted, or switched from a toggle to a
 * plain on/off command — has to drop the badge rather than keep showing
 * a state it no longer tracks.
 *
 * Every failure mode is non-fatal: an encoder has no `setImage`,
 * artwork could be missing from a botched package, and the action may
 * vanish mid-render. In each case the key simply keeps its manifest
 * image rather than the action throwing.
 */
export async function applyStatusImage(
  action: ImageCapableAction,
  artName: string,
  status: PowerStatus,
  root: URL | string = defaultArtRoot,
  showDot = badgeVisible,
): Promise<void> {
  if (typeof action.setImage !== "function") return;

  let image: string | undefined;
  if (status !== "unknown") {
    try {
      image = statusKeyImage(artName, status, root, showDot);
    } catch {
      return;
    }
  }

  try {
    // Called with no argument at all when resetting — Stream Deck
    // restores the manifest image only for a genuinely absent value.
    await (image === undefined ? action.setImage() : action.setImage(image));
  } catch {
    // Action disappeared mid-render.
  }
}
