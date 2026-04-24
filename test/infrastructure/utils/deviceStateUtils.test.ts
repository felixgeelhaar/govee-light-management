import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColorTemperature } from "@/backend/domain/value-objects/ColorTemperature";
import { streamDeck } from "@elgato/streamdeck";
import {
  __resetSafeGetColorTemperatureLogGate,
  safeGetColorTemperature,
} from "../../../src/backend/infrastructure/utils/deviceStateUtils";

describe("safeGetColorTemperature", () => {
  beforeEach(() => {
    __resetSafeGetColorTemperatureLogGate();
  });

  it("returns the color temperature when the reader succeeds", () => {
    const expected = new ColorTemperature(4000);
    const reader = { getColorTemperature: () => expected };

    expect(safeGetColorTemperature(reader, "Living Room")).toBe(expected);
  });

  it("returns undefined when the underlying reader throws on malformed data", () => {
    const reader = {
      getColorTemperature: () => {
        throw new Error("Color temperature must be between 1000K and 50000K, got 0K");
      },
    };

    const result = safeGetColorTemperature(reader, "Hallway");

    expect(result).toBeUndefined();
  });

  it("tolerates readers that do not implement the method at all", () => {
    expect(safeGetColorTemperature({}, "Unknown Light")).toBeUndefined();
  });

  it("passes context into the warning log without throwing", () => {
    const reader = {
      getColorTemperature: () => {
        throw new Error("boom");
      },
    };

    // Should not propagate — we just want to ensure the helper swallows the error.
    expect(() => safeGetColorTemperature(reader, "Bedroom")).not.toThrow();
    // Reader function should have been invoked.
    const spy = vi.fn().mockImplementation(() => {
      throw new Error("still boom");
    });
    safeGetColorTemperature({ getColorTemperature: spy }, "Bedroom");
    expect(spy).toHaveBeenCalled();
  });

  it("only warns once per context to avoid spamming the log from the 3s refresh loop", () => {
    const reader = {
      getColorTemperature: () => {
        throw new Error("Color temperature must be between 1000K and 50000K, got 0K");
      },
    };

    // Spies — the streamDeck mock in setup.ts provides vi.fn() for these.
    const warn = vi.mocked(streamDeck.logger.warn);
    const debug = vi.mocked(streamDeck.logger.debug);
    warn.mockClear();
    debug.mockClear();

    safeGetColorTemperature(reader, "Desk");
    safeGetColorTemperature(reader, "Desk");
    safeGetColorTemperature(reader, "Desk");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledTimes(2);
  });

  it("logs a warning independently per context", () => {
    const reader = {
      getColorTemperature: () => {
        throw new Error("bad");
      },
    };

    const warn = vi.mocked(streamDeck.logger.warn);
    warn.mockClear();

    safeGetColorTemperature(reader, "Desk");
    safeGetColorTemperature(reader, "Hallway");
    safeGetColorTemperature(reader, "Desk"); // already warned

    expect(warn).toHaveBeenCalledTimes(2);
  });
});
