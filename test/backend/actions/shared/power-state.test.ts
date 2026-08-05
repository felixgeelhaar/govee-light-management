import { describe, expect, it } from "vitest";
import { valuePrefix } from "../../../../src/backend/actions/shared/power-state";

describe("valuePrefix", () => {
  it("returns no prefix for a single light", () => {
    expect(valuePrefix("single")).toBe("");
  });

  it("returns ≡ for a uniform group", () => {
    expect(valuePrefix("group")).toBe("≡ ");
  });

  it("returns ≠ for a value-mixed group", () => {
    expect(valuePrefix("mixed")).toBe("≠ ");
  });
});
