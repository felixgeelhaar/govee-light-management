import { describe, expect, it } from "vitest";
import { DynamicSceneOption } from "../../../src/backend/domain/value-objects/DynamicSceneOption";
import { DiySceneOption } from "../../../src/backend/domain/value-objects/DiySceneOption";
import { buildSceneItems } from "../../../src/backend/actions/scene-items";

describe("buildSceneItems", () => {
  it("merges dynamic and DIY scenes with the correct kind metadata and DIY label", () => {
    const dynamicScene = DynamicSceneOption.create(101, 201, "Sunset");
    const diyScene = DiySceneOption.create(301, 301, "Custom Glow");

    expect(buildSceneItems([dynamicScene], [diyScene])).toEqual([
      {
        label: "Sunset",
        value: JSON.stringify({
          kind: "dynamic",
          id: 101,
          paramId: 201,
          name: "Sunset",
        }),
      },
      {
        label: "Custom Glow (DIY)",
        value: JSON.stringify({
          kind: "diy",
          id: 301,
          paramId: 301,
          name: "Custom Glow",
        }),
      },
    ]);
  });
});
