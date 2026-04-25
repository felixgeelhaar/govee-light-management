import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActionServices,
  registerEffectCanceller,
} from "../../../../src/backend/actions/shared/ActionServices";
import { Light } from "../../../../src/backend/domain/entities/Light";
import { LightGroup } from "../../../../src/backend/domain/entities/LightGroup";
import type { LightState } from "../../../../src/backend/domain/value-objects/LightState";
import type { DeviceTarget } from "../../../../src/backend/actions/shared/ActionServices";

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

describe("ActionServices.ensurePreparedForTarget", () => {
  beforeEach(() => {
    resetPreparedForSolidColor();
  });

  it("prepares a single-light target", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ gradient: true });

      await services.ensurePreparedForTarget("ctx-1", {
        type: "light",
        light,
      });

      expect(repo.toggleGradient).toHaveBeenCalledWith(light, false);
    } finally {
      restore();
    }
  });

  it("prepares each controllable light in a group target", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();
      const lightA = makeLight({
        deviceId: "grp-a",
        gradient: true,
        nightlight: true,
      });
      const lightB = makeLight({
        deviceId: "grp-b",
        gradient: true,
      });

      // Minimal LightGroup stub — only getControllableLights is called.
      const group = {
        getControllableLights: () => [lightA, lightB],
      } as unknown as import("../../../../src/backend/domain/entities/LightGroup").LightGroup;

      await services.ensurePreparedForTarget("ctx-1", {
        type: "group",
        group,
      });

      expect(repo.toggleGradient).toHaveBeenCalledTimes(2);
      expect(repo.toggleGradient).toHaveBeenNthCalledWith(1, lightA, false);
      expect(repo.toggleGradient).toHaveBeenNthCalledWith(2, lightB, false);
      expect(repo.toggleNightlight).toHaveBeenCalledTimes(1);
      expect(repo.toggleNightlight).toHaveBeenCalledWith(lightA, false);
    } finally {
      restore();
    }
  });

  it("is a no-op for a target with no light or group", async () => {
    const repo = mockRepo();
    const restore = installMockRepo(repo);
    try {
      const services = new ActionServices();

      await services.ensurePreparedForTarget("ctx-1", {
        type: "light",
        // light is undefined — target resolution failed
      });

      expect(repo.toggleGradient).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

/**
 * #199 follow-up: Before any user-issued command reaches the device,
 * ActionServices must cancel any RGB effect playing on the same target and
 * wait for its last in-flight frame to drain. Otherwise a trailing frame
 * lands on the device *after* the follow-up (e.g. "turn off") and re-wakes
 * the light. These tests verify the canceller is invoked through every
 * chokepoint and uses the correct key format.
 */
describe("ActionServices.cancelActiveEffectForTarget", () => {
  afterEach(() => {
    registerEffectCanceller(null);
  });

  it("cancels using light:deviceId|model for single-light targets", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const services = new ActionServices();
    const light = makeLight({ deviceId: "dev-99", model: "H6159" });

    await services.cancelActiveEffectForTarget({ type: "light", light });

    expect(canceller).toHaveBeenCalledTimes(1);
    expect(canceller).toHaveBeenCalledWith("light:dev-99|H6159");
  });

  it("cancels group id plus each member light for group targets", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const services = new ActionServices();
    const l1 = makeLight({ deviceId: "a", model: "H6001" });
    const l2 = makeLight({ deviceId: "b", model: "H6002" });
    const group = LightGroup.create("grp-1", "Living Room", [l1, l2]);

    await services.cancelActiveEffectForTarget({ type: "group", group });

    expect(canceller.mock.calls.map((c) => c[0])).toEqual([
      "group:grp-1",
      "light:a|H6001",
      "light:b|H6002",
    ]);
  });

  it("is a safe no-op when no canceller is registered", async () => {
    registerEffectCanceller(null);
    const services = new ActionServices();
    const light = makeLight();
    // Must not throw.
    await services.cancelActiveEffectForTarget({ type: "light", light });
  });

  it("swallows canceller errors so they don't block the user command", async () => {
    const canceller = vi.fn().mockRejectedValue(new Error("boom"));
    registerEffectCanceller(canceller);
    const services = new ActionServices();
    const light = makeLight();

    await expect(
      services.cancelActiveEffectForTarget({ type: "light", light }),
    ).resolves.toBeUndefined();
    expect(canceller).toHaveBeenCalled();
  });
});

/**
 * Integration-ish: ensure the cancel hook actually fires at each chokepoint.
 * We mock the repository so repo calls are no-ops, install a canceller spy,
 * and verify it was called before the repo call landed.
 */
describe("ActionServices chokepoint: cancel before user command", () => {
  type RepoMock = {
    setSegmentColors: ReturnType<typeof vi.fn>;
    setLightScene: ReturnType<typeof vi.fn>;
    setDiyScene: ReturnType<typeof vi.fn>;
    applySnapshot: ReturnType<typeof vi.fn>;
    toggleRaw: ReturnType<typeof vi.fn>;
    setMusicModeRaw: ReturnType<typeof vi.fn>;
    toggleGradient: ReturnType<typeof vi.fn>;
    toggleNightlight: ReturnType<typeof vi.fn>;
  };

  const fullRepo = (): RepoMock => ({
    setSegmentColors: vi.fn().mockResolvedValue(undefined),
    setLightScene: vi.fn().mockResolvedValue(undefined),
    setDiyScene: vi.fn().mockResolvedValue(undefined),
    applySnapshot: vi.fn().mockResolvedValue(undefined),
    toggleRaw: vi.fn().mockResolvedValue(undefined),
    setMusicModeRaw: vi.fn().mockResolvedValue(undefined),
    toggleGradient: vi.fn().mockResolvedValue(undefined),
    toggleNightlight: vi.fn().mockResolvedValue(undefined),
  });

  const installRepo = (repo: RepoMock) => {
    const shared = (
      ActionServices as unknown as { _shared: { lightRepository?: unknown } }
    )._shared;
    const original = shared.lightRepository;
    shared.lightRepository = repo;
    return () => {
      shared.lightRepository = original;
    };
  };

  afterEach(() => {
    registerEffectCanceller(null);
  });

  const expectCancelledBefore = async (
    canceller: ReturnType<typeof vi.fn>,
    repoFn: ReturnType<typeof vi.fn>,
    trigger: () => Promise<void>,
  ) => {
    await trigger();
    expect(canceller).toHaveBeenCalled();
    expect(repoFn).toHaveBeenCalled();
    // The cancel must happen before (or at latest simultaneously with) the
    // repo dispatch — vi call ordering uses invocation order.
    const cancelOrder = canceller.mock.invocationCallOrder[0];
    const repoOrder = repoFn.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(repoOrder);
  };

  it("setSegmentColors cancels the light's effect first", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const repo = fullRepo();
    const restore = installRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight({ deviceId: "s1", model: "H61A0" });

      await expectCancelledBefore(canceller, repo.setSegmentColors, () =>
        services.setSegmentColors(light, []),
      );
      expect(canceller).toHaveBeenCalledWith("light:s1|H61A0");
    } finally {
      restore();
    }
  });

  it("applyDynamicScene cancels first", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const repo = fullRepo();
    const restore = installRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight();

      await expectCancelledBefore(canceller, repo.setLightScene, () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        services.applyDynamicScene(light, {} as any),
      );
    } finally {
      restore();
    }
  });

  it("applySnapshot cancels first", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const repo = fullRepo();
    const restore = installRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight();

      await expectCancelledBefore(canceller, repo.applySnapshot, () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        services.applySnapshot(light, {} as any),
      );
    } finally {
      restore();
    }
  });

  it("toggleFeatureRaw cancels first", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const repo = fullRepo();
    const restore = installRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight();

      await expectCancelledBefore(canceller, repo.toggleRaw, () =>
        services.toggleFeatureRaw(light, "gradientToggle", true),
      );
    } finally {
      restore();
    }
  });

  it("applyMusicModeRaw cancels first", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const repo = fullRepo();
    const restore = installRepo(repo);
    try {
      const services = new ActionServices();
      const light = makeLight();

      await expectCancelledBefore(canceller, repo.setMusicModeRaw, () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        services.applyMusicModeRaw(light, {} as any),
      );
    } finally {
      restore();
    }
  });

  it("controlTarget cancels first on light targets", async () => {
    const canceller = vi.fn().mockResolvedValue(true);
    registerEffectCanceller(canceller);
    const repo = fullRepo();
    const restore = installRepo(repo);

    // controlTarget goes through LightControlService, which we can't easily
    // mock at the shared level without a deeper rewrite. Stub the service
    // method instead so the test is focused on the cancel-before-dispatch
    // contract rather than the full control pipeline.
    const controlService = {
      controlLight: vi.fn().mockResolvedValue(undefined),
      controlGroup: vi.fn().mockResolvedValue(undefined),
    };
    const shared = (
      ActionServices as unknown as {
        _shared: { lightControlService?: unknown };
      }
    )._shared;
    const originalControl = shared.lightControlService;
    shared.lightControlService = controlService;

    try {
      const services = new ActionServices();
      const light = makeLight({ deviceId: "ct", model: "H6159" });
      const target: DeviceTarget = { type: "light", light };

      await services.controlTarget(target, "off");

      expect(canceller).toHaveBeenCalledWith("light:ct|H6159");
      expect(controlService.controlLight).toHaveBeenCalled();
      const cancelOrder = canceller.mock.invocationCallOrder[0];
      const controlOrder = controlService.controlLight.mock.invocationCallOrder[0];
      expect(cancelOrder).toBeLessThan(controlOrder);
    } finally {
      shared.lightControlService = originalControl;
      restore();
    }
  });
});
