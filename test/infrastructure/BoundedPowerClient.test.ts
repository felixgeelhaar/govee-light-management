import { afterEach, describe, expect, it, vi } from "vitest";
import { BoundedPowerClient } from "../../src/backend/infrastructure/BoundedPowerClient";
const light = { deviceId: "dev-1", model: "H619A" };
afterEach(() => vi.restoreAllMocks());
describe("bounded lifecycle power transport", () => {
  it.each([true, false])(
    "sends explicit power %s with a cancellable signal",
    async (power) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 200 }), { status: 200 }),
        );
      const client = new BoundedPowerClient(fetcher);
      const controller = new AbortController();
      await client.setPower(light, power, "secret-key", controller.signal);
      const [url, options] = fetcher.mock.calls[0];
      expect(url).toBe(
        "https://openapi.api.govee.com/router/api/v1/device/control",
      );
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.parse(options.body).payload.capability.value).toBe(
        power ? 1 : 0,
      );
    },
  );
  it("never dispatches an already aborted request", async () => {
    const fetcher = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      new BoundedPowerClient(fetcher).setPower(
        light,
        true,
        "secret-key",
        controller.signal,
      ),
    ).rejects.toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [401, "auth"],
    [429, "rate_limit"],
    [500, "network"],
  ])(
    "classifies HTTP %s without exposing response bodies or keys",
    async (status, category) => {
      const client = new BoundedPowerClient(
        vi
          .fn()
          .mockResolvedValue(
            new Response("secret-response", { status: status as number }),
          ),
      );
      const error = await client
        .setPower(light, true, "secret-key", new AbortController().signal)
        .catch((value) => value);
      expect(error.category).toBe(category);
      expect(JSON.stringify(error)).not.toContain("secret");
    },
  );
  it("rejects invalid or negative API responses rather than claiming success", async () => {
    for (const body of [
      "invalid",
      JSON.stringify({ code: 400, message: "secret-body" }),
    ]) {
      const client = new BoundedPowerClient(
        vi.fn().mockResolvedValue(new Response(body, { status: 200 })),
      );
      await expect(
        client.setPower(
          light,
          true,
          "secret-key",
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ category: "validation" });
    }
  });
});
