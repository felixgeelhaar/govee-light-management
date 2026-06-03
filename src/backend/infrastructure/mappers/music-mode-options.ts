/**
 * Pure parser that extracts music-mode options from a Govee device's
 * capability list.
 *
 * Govee's `/router/api/v1/user/devices` response exposes music modes in
 * at least three observed shapes:
 *
 *  1. Flat: `parameters.options = [{ name, value: <number> }]`
 *  2. Nested: `parameters.fields = [{ fieldName: "musicMode", options: [...] }]`
 *  3. Object values: `option.value = { musicMode: N }` or `{ modeId: N }`
 *     or `{ id: N }`
 *
 * This parser handles all three without the repository having to know
 * the shape. Extracted from `GoveeLightRepository.getMusicModes` so the
 * repository can focus on device lookup and the parser can grow
 * independently as new device variants appear.
 *
 * Returns a deduplicated list of `{ name, value }` where `value` is the
 * numeric mode id Govee expects on the control endpoint.
 */

export interface MusicModeOption {
  name: string;
  value: number;
}

interface CapabilityOptionLike {
  name?: unknown;
  value?: unknown;
}

interface CapabilityFieldLike {
  fieldName?: unknown;
  options?: unknown[];
}

interface CapabilityLike {
  type: string;
  instance: string;
  parameters?: {
    options?: unknown[];
    fields?: CapabilityFieldLike[];
  };
}

/** Field names Govee has used for the music-mode option list inside a STRUCT. */
const PREFERRED_FIELD_NAMES = new Set(["musicmode", "modeid", "mode"]);

function extractNumericModeValue(value: unknown): number | null {
  // Mode ids are non-negative integers. Some devices (e.g. Curtain Lights
  // Pro H70B6) are 0-indexed — "Floating Mist" is mode 0 — so 0 is valid.
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of ["musicMode", "modeId", "id"]) {
      const candidate = record[key];
      if (
        typeof candidate === "number" &&
        Number.isInteger(candidate) &&
        candidate >= 0
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function collect(
  options: unknown[] | undefined,
  dedupe: Map<number, MusicModeOption>,
): void {
  if (!Array.isArray(options)) return;
  for (const option of options) {
    if (typeof option !== "object" || option === null) continue;
    const record = option as CapabilityOptionLike;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const value = extractNumericModeValue(record.value);
    if (!name || value === null) continue;
    dedupe.set(value, { name, value });
  }
}

/**
 * Walk a device's capability list and return every `music_setting` /
 * `musicMode` option as `{ name, value: modeId }`. Dedupes by value so
 * the same mode appearing in both `parameters.options` and
 * `parameters.fields[*].options` collapses to one entry.
 */
export function parseMusicModeOptions(
  capabilities: ReadonlyArray<CapabilityLike>,
): MusicModeOption[] {
  const dedupe = new Map<number, MusicModeOption>();

  for (const cap of capabilities) {
    if (!cap.type.includes("music_setting") || cap.instance !== "musicMode") {
      continue;
    }

    const params = cap.parameters;
    if (!params) continue;

    // Shape 1: flat options directly on parameters.
    collect(params.options, dedupe);

    if (Array.isArray(params.fields)) {
      // Shape 2a: fields whose fieldName matches a known mode-option field.
      let matchedPreferredField = false;
      for (const field of params.fields) {
        const fieldName =
          typeof field?.fieldName === "string"
            ? field.fieldName.toLowerCase()
            : "";
        if (PREFERRED_FIELD_NAMES.has(fieldName)) {
          collect(field.options, dedupe);
          matchedPreferredField = true;
        }
      }

      // Shape 2b: only when NO preferred field was found, fall back to any
      // enumerable field for devices that rename the mode field. We must
      // NOT do this when a proper `musicMode` field exists — sibling STRUCT
      // fields like `autoColor` (on=1/off=0) would otherwise collide on
      // value with real modes and overwrite them (e.g. Spectrum=1). See #250.
      if (!matchedPreferredField) {
        for (const field of params.fields) {
          collect(field?.options, dedupe);
        }
      }
    }
  }

  return Array.from(dedupe.values());
}
