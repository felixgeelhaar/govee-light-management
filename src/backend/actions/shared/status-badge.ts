/**
 * Renders power states through the plugin's key artwork, without a corner dot.
 * Authored state assets take priority over generated colour treatments.
 * Native user images take precedence over plugin images in Stream Deck.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GroupPowerSummary } from "./power-state";

export type PowerStatus = "on" | "partial" | "off" | "unknown";

/**
 * Artwork folders under `imgs/actions/` used for power-state rendering.
 * Kept here so a test can assert every one of them actually ships a
 * `key.svg` — a missing file would silently prevent state rendering at runtime.
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

const DEFAULT_VIEWBOX = { x: 0, y: 0, width: 288, height: 288 };

const SVG_OPEN_TAG = /<svg\b([^>]*)>/i;
const VIEWBOX_ATTR = /viewBox\s*=\s*["']([^"']+)["']/i;

/** Maps sampled light/group power to artwork states; unsampled remains unknown. */
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

/** Dim off keys that have no authored state artwork. */
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
 * Render `baseSvg` with dot-free state styling. Pure — no filesystem, no SDK
 * — so the geometry is straightforward to test.
 *
 * `authoredForState` marks artwork drawn for this exact state (#339), whose
 * gradient is then left exactly as the artist set it.
 *
 * @throws if `baseSvg` has no `<svg>` root element.
 */
export function renderStatusKey(
  baseSvg: string,
  status: PowerStatus,
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
  // Authored off artwork already carries the state; otherwise dim the key.
  const needsDim = status === "off" && !authoredForState;
  const artwork = needsDim
    ? `<g opacity="${n(OFF_OPACITY)}">${shifted}</g>`
    : shifted;
  const viewBox = `${n(box.x)} ${n(box.y)} ${n(box.width)} ${n(box.height)}`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
    artwork +
    "</svg>"
  );
}

const DATA_URI_PREFIX = "data:image/svg+xml;base64,";

/** Encode a composited key for `setImage()`. */
export function statusKeyDataUri(
  baseSvg: string,
  status: PowerStatus,
  authoredForState = false,
): string {
  return (
    DATA_URI_PREFIX +
    Buffer.from(renderStatusKey(baseSvg, status, authoredForState)).toString(
      "base64",
    )
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

/** Composited data URI for an action's artwork in a given power state. */
export function statusKeyImage(
  artName: string,
  status: PowerStatus,
  root: URL | string = defaultArtRoot,
): string {
  const key = `${String(root)}|${artName}|${status}`;
  const cached = imageCache.get(key);
  if (cached !== undefined) return cached;

  const art = resolveKeyArt(artName, status, root);
  const uri = statusKeyDataUri(art.svg, status, art.authoredForState);
  imageCache.set(key, uri);
  return uri;
}

export interface ImageCapableAction {
  setImage?: (image?: string) => Promise<void>;
}

/**
 * Push dot-free state artwork to a key.
 *
 * A `"unknown"` status resets the key to its manifest artwork instead:
 * `setImage()` sticks until it is explicitly cleared, so a key that
 * stops displaying state — retargeted, or switched from a toggle to a
 * plain on/off command — has to reset the artwork rather than keep showing
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
): Promise<void> {
  if (typeof action.setImage !== "function") return;

  let image: string | undefined;
  if (status !== "unknown") {
    try {
      image = statusKeyImage(artName, status, root);
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
