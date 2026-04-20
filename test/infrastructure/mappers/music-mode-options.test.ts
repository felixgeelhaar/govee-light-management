import { describe, expect, it } from "vitest";
import { parseMusicModeOptions } from "../../../src/backend/infrastructure/mappers/music-mode-options";

describe("parseMusicModeOptions", () => {
  it("returns empty when no music_setting capability is present", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.on_off",
        instance: "powerSwitch",
        parameters: { options: [{ name: "on", value: 1 }] },
      },
    ]);
    expect(result).toEqual([]);
  });

  it("extracts flat options shape (parameters.options)", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          options: [
            { name: "Rhythm", value: 3 },
            { name: "Spectrum", value: 4 },
          ],
        },
      },
    ]);
    expect(result).toEqual([
      { name: "Rhythm", value: 3 },
      { name: "Spectrum", value: 4 },
    ]);
  });

  it("extracts from a named STRUCT field (parameters.fields[musicMode].options)", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          fields: [
            {
              fieldName: "musicMode",
              options: [{ name: "Energic", value: 5 }],
            },
            {
              fieldName: "sensitivity",
              // range field, not a mode-options carrier
            },
          ],
        },
      },
    ]);
    expect(result).toEqual([{ name: "Energic", value: 5 }]);
  });

  it("accepts modeId and id field-name aliases (case-insensitive)", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          fields: [
            {
              fieldName: "MODEID",
              options: [{ name: "Rolling", value: 6 }],
            },
          ],
        },
      },
    ]);
    expect(result).toEqual([{ name: "Rolling", value: 6 }]);
  });

  it("unwraps object values like { musicMode: N } / { modeId: N } / { id: N }", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          options: [
            { name: "A", value: { musicMode: 3 } },
            { name: "B", value: { modeId: 5 } },
            { name: "C", value: { id: 7 } },
          ],
        },
      },
    ]);
    expect(result).toEqual([
      { name: "A", value: 3 },
      { name: "B", value: 5 },
      { name: "C", value: 7 },
    ]);
  });

  it("dedupes the same value across flat + field shapes", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          options: [{ name: "Rhythm", value: 3 }],
          fields: [
            {
              fieldName: "musicMode",
              options: [
                { name: "Rhythm", value: 3 },
                { name: "Spectrum", value: 4 },
              ],
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.value).sort()).toEqual([3, 4]);
  });

  it("skips malformed entries (missing name, non-integer, zero, negative)", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          options: [
            { name: "", value: 3 }, // empty name
            { name: "Valid", value: 4 },
            { name: "Zero", value: 0 }, // not positive
            { name: "Negative", value: -1 },
            { name: "Float", value: 3.5 }, // not integer
            { name: "String", value: "5" }, // wrong type
            { name: "Null", value: null },
            { name: "NoValue" }, // missing value
          ],
        },
      },
    ]);
    expect(result).toEqual([{ name: "Valid", value: 4 }]);
  });

  it("falls back to any enumerable field when no known fieldName matches", () => {
    // Devices in the wild have been seen using renamed fields; we
    // accept them after the preferred lookup as a defensive fallback.
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          fields: [
            {
              fieldName: "completelyUnexpected",
              options: [{ name: "Rhythm", value: 3 }],
            },
          ],
        },
      },
    ]);
    expect(result).toEqual([{ name: "Rhythm", value: 3 }]);
  });

  it("trims surrounding whitespace from option names", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicMode",
        parameters: {
          options: [{ name: "  Rhythm  ", value: 3 }],
        },
      },
    ]);
    expect(result[0].name).toBe("Rhythm");
  });

  it("ignores capabilities with the right type but wrong instance", () => {
    const result = parseMusicModeOptions([
      {
        type: "devices.capabilities.music_setting",
        instance: "musicBass", // not musicMode
        parameters: {
          options: [{ name: "Boom", value: 99 }],
        },
      },
    ]);
    expect(result).toEqual([]);
  });
});
