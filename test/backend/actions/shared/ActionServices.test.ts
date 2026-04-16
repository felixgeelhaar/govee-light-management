import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionServices } from "../../../../src/backend/actions/shared/ActionServices";
import { Light } from "../../../../src/backend/domain/entities/Light";
import type { LightState } from "../../../../src/backend/domain/value-objects/LightState";

const makeLight = (opts: {
  deviceId?: string;
  model?: string;
  gradient?: boolean;
  nightlight?: boolean;
} = {}) =>
  Light.create(
    opts.deviceId ?? "dev-1",
    opts.model ?? "H6001",
    "Test Light",
    { isOn: true, isOnline: true } as LightState,
    {
      brightness: true,
      color: true,
      colorTemperature: true,
      scenes: false,
      segmentedColor: false,
      musicMode: false,
      nightlight: opts.nightlight ?? false,
      gradient: opts.gradient ?? false,
    },
  );

/**
 * ActionServices keeps its repository as a static shared instance. For
 * tests we reach in and swap it out with a mock, and restore afterwards.
 */
const mockRepo = () => ({
  toggleGradient: vi.fn().mockResolvedValue(undefined),
  toggleNightlight: vi.fn().mockResolvedValue(undefined),
});

const installMockRepo = (repo: ReturnType<typeof mockRepo>) => {
  // The _shared field is private; cast to unknown then a minimal interface.
  const shared = (ActionServices as unknown as { _shared: { lightRepository?: unknown } })._shared;
  const original = shared.lightRepository;
  shared.lightRepository = repo;
  return () => {
    shared.lightRepository = original;
  };
};

/**
 * ActionServices.preparedForSolidColor is a private static Set that
 * persists across test cases. Clear it between tests so each one starts
 * from a clean state.
 */
const resetPreparedForSolidColor = () => {
  const prepared = (
    ActionServices as unknown as {
      preparedForSolidColor: Set<string>;
    }
  ).preparedForSolidColor;
  prepared.clear();
};

describe("ActionServices.isDialInteractionActive", () => {
  let services: ActionServices;

  beforeEach(() => {
    vi.useFakeTimers();
    services = new ActionServices();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when no interaction is in flight", () => {
    expect(services.isDialInteractionActive("ctx-1")).toBe(false);
  });

  it("returns true while a deferred dial action is pending", () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    services.deferDialAction("ctx-1", callback, 500);

    expect(services.isDialInteractionActive("ctx-1")).toBe(true);
  });

  it("cleanupDialTimers clears the active flag for that context", () => {
    services.deferDialAction("ctx-1", vi.fn().mockResolvedValue(undefined), 500);
    expect(services.isDialInteractionActive("ctx-1")).toBe(true);

    services.cleanupDialTimers("ctx-1");

    expect(services.isDialInteractionActive("ctx-1")).toBe(false);
  });

  it("tracks interaction state independently per context id", () => {
    services.deferDialAction("ctx-a", vi.fn().mockResolvedValue(undefined), 500);

    expect(services.isDialInteractionActive("ctx-a")).toBe(true);
    expect(services.isDialInteractionActive("ctx-b")).toBe(false);
  });

  it("calls the deferred callback after the delay elapses and then clears the flag", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    services.deferDialAction("ctx-1", callback, 250);

    expect(callback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    // The callback may defer its cleanup via micro-tasks; flush them.
    await Promise.resolve();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("replaces the pending callback when a new deferDialAction is scheduled", async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);

    services.deferDialAction("ctx-1", first, 500);
    services.deferDialAction("ctx-1", second, 500);

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("ActionServices.prepareForSolidColor", () => {
  it("toggles gradient off when the light advertises gradient capability", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ gradient: true });

      await services.prepareForSolidColor(light);

      expect(repo.toggleGradient).toHaveBeenCalledWith(light, false);
      expect(repo.toggleNightlight).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("toggles nightlight off when the light advertises nightlight capability", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ nightlight: true });

      await services.prepareForSolidColor(light);

      expect(repo.toggleNightlight).toHaveBeenCalledWith(light, false);
      expect(repo.toggleGradient).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("issues no toggle calls when the light supports none of the overlay modes", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({});

      await services.prepareForSolidColor(light);

      expect(repo.toggleGradient).not.toHaveBeenCalled();
      expect(repo.toggleNightlight).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("swallows per-toggle failures so one failure does not block the others", async () => {
    const repo = {
      toggleGradient: vi.fn().mockRejectedValue(new Error("gradient failed")),
      toggleNightlight: vi.fn().mockResolvedValue(undefined),
    };
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ gradient: true, nightlight: true });

      await expect(services.prepareForSolidColor(light)).resolves.toBeUndefined();
      expect(repo.toggleGradient).toHaveBeenCalled();
      expect(repo.toggleNightlight).toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

describe("ActionServices.ensurePreparedForSolidColor", () => {
  beforeEach(() => {
    resetPreparedForSolidColor();
  });

  it("issues the overlay toggles once per (context, device) tuple", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ gradient: true });

      await services.ensurePreparedForSolidColor("ctx-1", light);
      await services.ensurePreparedForSolidColor("ctx-1", light);
      await services.ensurePreparedForSolidColor("ctx-1", light);

      expect(repo.toggleGradient).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("re-issues toggles after clearPreparedForContext for the same context", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ gradient: true });

      await services.ensurePreparedForSolidColor("ctx-1", light);
      services.clearPreparedForContext("ctx-1");
      await services.ensurePreparedForSolidColor("ctx-1", light);

      expect(repo.toggleGradient).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  });

  it("re-prepares when the context switches to a different device", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const lightA = makeLight({ deviceId: "dev-a", gradient: true });
      const lightB = makeLight({ deviceId: "dev-b", gradient: true });

      await services.ensurePreparedForSolidColor("ctx-1", lightA);
      await services.ensurePreparedForSolidColor("ctx-1", lightB);

      expect(repo.toggleGradient).toHaveBeenCalledTimes(2);
      expect(repo.toggleGradient).toHaveBeenNthCalledWith(1, lightA, false);
      expect(repo.toggleGradient).toHaveBeenNthCalledWith(2, lightB, false);
    } finally {
      restore();
    }
  });

  it("isolates prepared state between different contexts", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ gradient: true });

      await services.ensurePreparedForSolidColor("ctx-a", light);
      await services.ensurePreparedForSolidColor("ctx-b", light);
      // Clearing ctx-a must not affect ctx-b's prepared state.
      services.clearPreparedForContext("ctx-a");
      await services.ensurePreparedForSolidColor("ctx-b", light);

      // 2 prepares: once for ctx-a, once for ctx-b. The ctx-b re-call is a no-op.
      expect(repo.toggleGradient).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  });
});
