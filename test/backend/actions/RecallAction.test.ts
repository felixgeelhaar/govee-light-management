/**
 * Recall composite action — unit-level coverage of the parse + dispatch
 * helpers. The class itself isn't unit-imported (vitest's transform
 * pipeline trips on stage-3 decorators in test imports — same reason
 * no other action class has direct unit tests).
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyRecallToLight,
  parseRecallPayload,
  type RecallApplyServices,
} from "../../../src/backend/actions/recall-payload";
import { Light } from "../../../src/backend/domain/entities/Light";
import type { LightState } from "../../../src/backend/domain/value-objects/LightState";

const makeLight = () =>
  Light.create(
    "dev-1",
    "H6001",
    "Test Light",
    { isOn: true, isOnline: true } as LightState,
    {
      brightness: true,
      color: true,
      colorTemperature: true,
      scenes: true,
      segmentedColor: false,
      musicMode: false,
      nightlight: false,
      gradient: false,
    },
  );

const makeServices = (): RecallApplyServices & {
  applyDynamicScene: ReturnType<typeof vi.fn>;
  applyDiyScene: ReturnType<typeof vi.fn>;
  applySnapshot: ReturnType<typeof vi.fn>;
} => ({
  applyDynamicScene: vi.fn().mockResolvedValue(undefined),
  applyDiyScene: vi.fn().mockResolvedValue(undefined),
  applySnapshot: vi.fn().mockResolvedValue(undefined),
});

describe("parseRecallPayload", () => {
  it("parses a dynamic-scene payload", () => {
    const raw = JSON.stringify({
      kind: "scene",
      sceneKind: "dynamic",
      id: 42,
      paramId: 7,
      name: "Sunrise",
    });
    expect(parseRecallPayload(raw)).toEqual({
      kind: "scene",
      sceneKind: "dynamic",
      id: 42,
      paramId: 7,
      name: "Sunrise",
    });
  });

  it("parses a DIY-scene payload", () => {
    const raw = JSON.stringify({
      kind: "scene",
      sceneKind: "diy",
      id: 11,
      paramId: 3,
      name: "Movie Night",
    });
    expect(parseRecallPayload(raw)).toEqual({
      kind: "scene",
      sceneKind: "diy",
      id: 11,
      paramId: 3,
      name: "Movie Night",
    });
  });

  it("parses a snapshot payload", () => {
    const raw = JSON.stringify({
      kind: "snapshot",
      id: 99,
      paramId: 1,
      name: "Reading",
    });
    expect(parseRecallPayload(raw)).toEqual({
      kind: "snapshot",
      id: 99,
      paramId: 1,
      name: "Reading",
    });
  });

  it("defaults sceneKind to dynamic when missing or unknown", () => {
    const raw = JSON.stringify({
      kind: "scene",
      id: 1,
      paramId: 2,
      name: "x",
    });
    const parsed = parseRecallPayload(raw);
    expect(parsed?.kind).toBe("scene");
    if (parsed?.kind === "scene") {
      expect(parsed.sceneKind).toBe("dynamic");
    }
  });

  it("returns null for non-JSON input", () => {
    expect(parseRecallPayload("not json")).toBeNull();
  });

  it("returns null when required fields are missing or wrong-typed", () => {
    expect(
      parseRecallPayload(
        JSON.stringify({ kind: "snapshot", id: "x", paramId: 1, name: "n" }),
      ),
    ).toBeNull();
    expect(
      parseRecallPayload(
        JSON.stringify({ kind: "snapshot", id: 1, paramId: 1 }),
      ),
    ).toBeNull();
    expect(
      parseRecallPayload(JSON.stringify({ kind: "unknown", id: 1, paramId: 1, name: "n" })),
    ).toBeNull();
  });
});

describe("applyRecallToLight — dispatch", () => {
  it("routes a dynamic scene to applyDynamicScene", async () => {
    const services = makeServices();
    const light = makeLight();

    await applyRecallToLight(services, light, {
      kind: "scene",
      sceneKind: "dynamic",
      id: 42,
      paramId: 7,
      name: "Sunrise",
    });

    expect(services.applyDynamicScene).toHaveBeenCalledTimes(1);
    expect(services.applyDynamicScene).toHaveBeenCalledWith(
      light,
      expect.objectContaining({ id: 42, paramId: 7, name: "Sunrise" }),
    );
    expect(services.applyDiyScene).not.toHaveBeenCalled();
    expect(services.applySnapshot).not.toHaveBeenCalled();
  });

  it("routes a DIY scene to applyDiyScene", async () => {
    const services = makeServices();
    const light = makeLight();

    await applyRecallToLight(services, light, {
      kind: "scene",
      sceneKind: "diy",
      id: 11,
      paramId: 3,
      name: "Movie Night",
    });

    expect(services.applyDiyScene).toHaveBeenCalledTimes(1);
    expect(services.applyDynamicScene).not.toHaveBeenCalled();
    expect(services.applySnapshot).not.toHaveBeenCalled();
  });

  it("routes a snapshot to applySnapshot", async () => {
    const services = makeServices();
    const light = makeLight();

    await applyRecallToLight(services, light, {
      kind: "snapshot",
      id: 99,
      paramId: 1,
      name: "Reading",
    });

    expect(services.applySnapshot).toHaveBeenCalledTimes(1);
    expect(services.applyDynamicScene).not.toHaveBeenCalled();
    expect(services.applyDiyScene).not.toHaveBeenCalled();
  });

  it("propagates errors from the underlying apply call", async () => {
    const services = makeServices();
    services.applyDynamicScene.mockRejectedValueOnce(
      new Error("upstream timeout"),
    );
    const light = makeLight();

    await expect(
      applyRecallToLight(services, light, {
        kind: "scene",
        sceneKind: "dynamic",
        id: 1,
        paramId: 1,
        name: "x",
      }),
    ).rejects.toThrow("upstream timeout");
  });
});
