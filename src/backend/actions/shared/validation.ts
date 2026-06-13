/**
 * Shared validation utilities for actions and repositories.
 */

/**
 * Check if an error is a Zod ValidationError from the govee-api-client library.
 * The client has strict Zod schemas that sometimes reject valid Govee API
 * responses. Commands still execute successfully in these cases.
 */
export function isValidationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.constructor.name === "ValidationError" ||
      error.message.includes("API response validation failed"))
  );
}

/**
 * Some devices return malformed state payloads for specific fields.
 * Those failures should not be treated as fatal for UI refresh loops.
 *
 * Maintained list (each entry tied to an upstream issue or device class):
 *   - 0K color temperature on certain RGB IC strips.
 *   - Negative or non-integer scene/snapshot IDs in DIY responses.
 *   - `e.map is not a function` raised by govee-api-client when a
 *     non-array value reaches `mapCapabilitiesToStateProperties`'s
 *     `segmentedColorRgb` / `segmentedBrightness` branch (seen on
 *     non-IC devices that still advertise the capability descriptor).
 *     Tracked in govee-api-client; until that ships, treat as ignorable
 *     so the refresh loop backs off instead of error-spamming.
 */
export function isIgnorableLiveStateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const msg = error.message;
  return (
    msg.includes(
      "Color temperature must be between 1000K and 50000K, got 0K",
    ) ||
    msg.includes("ID must be a positive integer") ||
    msg.includes(".map is not a function") ||
    msg.includes("is not iterable")
  );
}

/**
 * Valid toggle instance names accepted by the Govee API.
 * Only these are forwarded to the API — all others are rejected.
 */
export const VALID_TOGGLE_INSTANCES = new Set([
  "nightlightToggle",
  "gradientToggle",
  "dreamViewToggle",
  "sceneStageToggle",
]);

/**
 * Shape of a Govee toggle-capability instance. Govee names every toggle in
 * camelCase ending in `Toggle`, optionally with a trailing index for
 * per-socket / per-zone devices, e.g. `nightlightToggle`, `socketToggle1`
 * (HS5089 Smart Outlet Extender), `rippleLightToggle` / `sideLightToggle` /
 * `bottomLightToggle` (H60B0 Uplighter Floor Lamp).
 *
 * Instances are sourced from each device's own advertised `toggle`
 * capabilities, so the count and names are not known ahead of time. Matching
 * by shape — rather than a fixed enumeration — lets every toggle a device
 * reports work, including ones Govee adds later, while still rejecting
 * arbitrary command names. Requiring a leading lowercase letter rejects a
 * bare `Toggle1` (no real instance prefix).
 */
const TOGGLE_INSTANCE_SHAPE = /^[a-z][a-zA-Z]*Toggle\d*$/;

/**
 * Whether a toggle instance name is safe to forward to the Govee API. Accepts
 * any device-advertised toggle instance matching the Govee `*Toggle` shape;
 * everything else is rejected to stop arbitrary command forwarding.
 */
export function isValidToggleInstance(instance: string): boolean {
  return (
    VALID_TOGGLE_INSTANCES.has(instance) || TOGGLE_INSTANCE_SHAPE.test(instance)
  );
}

/**
 * Human-friendly label for a toggle instance with no curated name, derived
 * generically from the instance shape so any device-advertised toggle reads
 * well in the picker:
 *   `socketToggle1`     → `Socket 1`
 *   `rippleLightToggle` → `Ripple Light`
 *   `bottomLightToggle` → `Bottom Light`
 * Returns the raw instance unchanged when it is not a `*Toggle` instance, so
 * callers can fall back to it directly.
 */
export function toggleInstanceFallbackLabel(instance: string): string {
  const match = /^([a-z][a-zA-Z]*)Toggle(\d*)$/.exec(instance);
  if (!match) return instance;
  const [, prefix, index] = match;
  const words = prefix
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
  return index ? `${words} ${index}` : words;
}

/**
 * Parse and validate a JSON feature setting string.
 * Returns null if the string is malformed or missing required fields.
 */
export function parseFeatureSetting(
  raw: string,
): { name: string; instance: string } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      "instance" in parsed &&
      typeof (parsed as Record<string, unknown>).name === "string" &&
      typeof (parsed as Record<string, unknown>).instance === "string"
    ) {
      return parsed as { name: string; instance: string };
    }
    return null;
  } catch {
    return null;
  }
}

/** Govee API keys are UUID-like or hex strings, typically 20-64 characters. */
const GOVEE_KEY_PATTERN = /^[A-Za-z0-9-]{20,64}$/;

/**
 * Validate that a string looks like a Govee API key.
 */
export function isValidApiKeyFormat(key: string): boolean {
  return GOVEE_KEY_PATTERN.test(key.trim());
}

/**
 * Clamp a number to a range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
