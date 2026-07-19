import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamDeck } from "@elgato/streamdeck";
import { ActionServices } from "../../../../src/backend/actions/shared/ActionServices";

/**
 * Issue #311: a user could not control their H619A lights and saw only a
 * warning triangle on the key. resolveTarget can return null for five
 * distinct reasons, and every one produced that identical silent triangle
 * — leaving neither the user nor us able to tell which had happened.
 *
 * These tests pin the diagnostics rather than the control flow: each null
 * path must say why. If someone later drops the logging, the symptom (an
 * unexplained triangle) returns silently, so the assertions are on the log
 * call, not only on the null return.
 */

/** Swap services on the private static _shared, restoring afterwards. */
const installShared = (patch: Record<string, unknown>) => {
  const shared = (
    ActionServices as unknown as { _shared: Record<string, unknown> }
  )._shared;
  const original: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    original[key] = shared[key];
    shared[key] = patch[key];
  }
  return () => {
    for (const key of Object.keys(patch)) {
      shared[key] = original[key];
    }
  };
};

describe("resolveTarget diagnostics (issue #311)", () => {
  let services: ActionServices;
  let restore: (() => void) | undefined;
  const warn = streamDeck.logger.warn as ReturnType<typeof vi.fn>;

  const warnedWith = (fragment: string) =>
    warn.mock.calls.some((c) => String(c[0]).includes(fragment));
  const contextFor = (fragment: string) =>
    warn.mock.calls.find((c) => String(c[0]).includes(fragment))?.[1] as
      | Record<string, unknown>
      | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    services = new ActionServices();
  });

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("explains an empty selection instead of failing silently", async () => {
    const target = await services.resolveTarget({} as never);

    expect(target).toBeNull();
    expect(warnedWith("no target in settings")).toBe(true);
  });

  it("distinguishes a failed discovery from a genuinely missing device", async () => {
    // Discovery returning nothing almost always means the API call failed
    // or was rate-limited — not that the user's light disappeared. Saying
    // "device not found" there sends everyone down the wrong path.
    restore = installShared({
      deviceService: {
        discover: vi.fn().mockResolvedValue([]),
        getCachedLights: vi.fn().mockReturnValue(null),
      },
    });

    const target = await services.resolveTarget({
      selectedDeviceId: "dev-1|H619A",
    } as never);

    expect(target).toBeNull();
    expect(warnedWith("no devices at all")).toBe(true);
    expect(warnedWith("selected device not present")).toBe(false);
  });

  it("reports the wanted device and what discovery actually returned", async () => {
    // The diagnostic that would have resolved #311 in one round trip:
    // which model was asked for, versus which models came back.
    restore = installShared({
      deviceService: {
        discover: vi.fn().mockResolvedValue([
          {
            deviceId: "other-1",
            model: "H6001",
            name: "Strip",
            controllable: true,
          },
        ]),
        getCachedLights: vi.fn().mockReturnValue(null),
      },
    });

    const target = await services.resolveTarget({
      selectedDeviceId: "dev-1|H619A",
    } as never);

    expect(target).toBeNull();
    expect(warnedWith("selected device not present")).toBe(true);

    const context = contextFor("selected device not present");
    expect(context).toMatchObject({
      wantDeviceId: "dev-1",
      wantModel: "H619A",
      discoveredCount: 1,
    });
    expect(context?.discoveredModels).toContain("H6001");
  });

  it("explains a group that is no longer in storage", async () => {
    restore = installShared({
      groupService: { findGroupById: vi.fn().mockResolvedValue(null) },
    });

    const target = await services.resolveTarget({
      selectedDeviceId: "group:grp-1",
    } as never);

    expect(target).toBeNull();
    expect(warnedWith("group not found in storage")).toBe(true);
  });

  it("explains a light target whose device service is unavailable", async () => {
    restore = installShared({ deviceService: undefined });

    const target = await services.resolveTarget({
      selectedDeviceId: "dev-1|H619A",
    } as never);

    expect(target).toBeNull();
    expect(warnedWith("target is incomplete")).toBe(true);
    expect(contextFor("target is incomplete")).toMatchObject({
      hasDeviceService: false,
    });
  });
});
