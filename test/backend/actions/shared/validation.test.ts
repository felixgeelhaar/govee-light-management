import { describe, expect, it } from "vitest";
import {
  clamp,
  isIgnorableLiveStateError,
  isValidApiKeyFormat,
  isValidationError,
  isValidToggleInstance,
  parseFeatureSetting,
  VALID_TOGGLE_INSTANCES,
} from "../../../../src/backend/actions/shared/validation";

describe("validation helpers", () => {
  describe("isValidationError", () => {
    it("detects errors whose constructor name is ValidationError", () => {
      class ValidationError extends Error {}
      expect(isValidationError(new ValidationError("boom"))).toBe(true);
    });

    it("detects errors whose message mentions API response validation", () => {
      expect(
        isValidationError(new Error("API response validation failed: bad")),
      ).toBe(true);
    });

    it("returns false for unrelated errors", () => {
      expect(isValidationError(new Error("network timeout"))).toBe(false);
      expect(isValidationError("not an error")).toBe(false);
      expect(isValidationError(undefined)).toBe(false);
    });
  });

  describe("isIgnorableLiveStateError", () => {
    it("recognises the malformed 0K color temperature payload", () => {
      const error = new Error(
        "Color temperature must be between 1000K and 50000K, got 0K",
      );
      expect(isIgnorableLiveStateError(error)).toBe(true);
    });

    it("recognises the invalid positive-integer ID payload", () => {
      const error = new Error("ID must be a positive integer");
      expect(isIgnorableLiveStateError(error)).toBe(true);
    });

    it("does not swallow unrelated errors", () => {
      expect(isIgnorableLiveStateError(new Error("timeout"))).toBe(false);
      expect(isIgnorableLiveStateError(new Error("rate limit"))).toBe(false);
    });

    it("returns false for non-Error values", () => {
      expect(isIgnorableLiveStateError(undefined)).toBe(false);
      expect(isIgnorableLiveStateError(null)).toBe(false);
      expect(
        isIgnorableLiveStateError(
          "Color temperature must be between 1000K and 50000K, got 0K",
        ),
      ).toBe(false);
    });
  });

  describe("clamp", () => {
    it("returns the value when it is inside the range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it("clamps to min when below the range", () => {
      expect(clamp(-3, 0, 10)).toBe(0);
    });

    it("clamps to max when above the range", () => {
      expect(clamp(11, 0, 10)).toBe(10);
    });
  });

  describe("VALID_TOGGLE_INSTANCES", () => {
    it("includes the Govee toggle instance names used by the plugin", () => {
      expect(VALID_TOGGLE_INSTANCES.has("nightlightToggle")).toBe(true);
      expect(VALID_TOGGLE_INSTANCES.has("gradientToggle")).toBe(true);
      expect(VALID_TOGGLE_INSTANCES.has("dreamViewToggle")).toBe(true);
      expect(VALID_TOGGLE_INSTANCES.has("sceneStageToggle")).toBe(true);
    });

    it("rejects unknown instances to stop arbitrary command forwarding", () => {
      expect(VALID_TOGGLE_INSTANCES.has("arbitraryCommand")).toBe(false);
    });
  });

  describe("isValidToggleInstance", () => {
    it("accepts the named lighting toggle instances", () => {
      expect(isValidToggleInstance("nightlightToggle")).toBe(true);
      expect(isValidToggleInstance("gradientToggle")).toBe(true);
      expect(isValidToggleInstance("dreamViewToggle")).toBe(true);
      expect(isValidToggleInstance("sceneStageToggle")).toBe(true);
    });

    it("accepts indexed per-socket toggle instances (multi-outlet devices)", () => {
      // HS5089 Smart Outlet Extender exposes socketToggle1, socketToggle2, …
      expect(isValidToggleInstance("socketToggle1")).toBe(true);
      expect(isValidToggleInstance("socketToggle2")).toBe(true);
      expect(isValidToggleInstance("socketToggle12")).toBe(true);
    });

    it("rejects arbitrary, non-toggle instances", () => {
      expect(isValidToggleInstance("arbitraryCommand")).toBe(false);
      expect(isValidToggleInstance("turn")).toBe(false);
      expect(isValidToggleInstance("brightness")).toBe(false);
      // A bare "Toggle" with no prefix is not a real Govee instance.
      expect(isValidToggleInstance("Toggle1")).toBe(false);
    });
  });

  describe("parseFeatureSetting", () => {
    it("parses a valid JSON feature setting", () => {
      expect(parseFeatureSetting('{"name":"Nightlight","instance":"nightlightToggle"}')).toEqual({
        name: "Nightlight",
        instance: "nightlightToggle",
      });
    });

    it("returns null for missing fields or malformed JSON", () => {
      expect(parseFeatureSetting("{}")).toBeNull();
      expect(parseFeatureSetting('{"name":"X"}')).toBeNull();
      expect(parseFeatureSetting("not-json")).toBeNull();
    });
  });

  describe("isValidApiKeyFormat", () => {
    it("accepts keys matching the Govee format", () => {
      expect(isValidApiKeyFormat("abcdef012345678901234567")).toBe(true);
    });

    it("rejects keys that are too short or have invalid characters", () => {
      expect(isValidApiKeyFormat("short")).toBe(false);
      expect(isValidApiKeyFormat("has space in it here now")).toBe(false);
    });
  });
});
