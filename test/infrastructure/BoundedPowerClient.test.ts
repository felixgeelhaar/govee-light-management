vi.unmock("@felixgeelhaar/govee-api-client");
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GoveeApiError,
  InvalidApiKeyError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from "@felixgeelhaar/govee-api-client";
import { BoundedPowerClient } from "../../src/backend/infrastructure/BoundedPowerClient";
const light = { deviceId: "dev-1", model: "H619A" };
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("bounded lifecycle API client", () => {
  it.each([true, false])(
    "sends explicit power %s with a cancellable signal",
    async (power) => {
      const delegate = {
        turnOn: vi.fn().mockResolvedValue(undefined),
        turnOff: vi.fn().mockResolvedValue(undefined),
      };
      const factory = vi.fn(() => delegate);
      await new BoundedPowerClient(factory).setPower(
        light,
        power,
        "secret-key",
        new AbortController().signal,
      );
      expect(factory).toHaveBeenCalledWith("secret-key");
      expect(power ? delegate.turnOn : delegate.turnOff).toHaveBeenCalledWith(
        light.deviceId,
        light.model,
        { signal: expect.any(AbortSignal) },
      );
      expect(power ? delegate.turnOff : delegate.turnOn).not.toHaveBeenCalled();
    },
  );
  it("never constructs a client for an aborted request", async () => {
    const factory = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      new BoundedPowerClient(factory).setPower(
        light,
        true,
        "secret-key",
        controller.signal,
      ),
    ).rejects.toMatchObject({ category: "cancelled" });
    expect(factory).not.toHaveBeenCalled();
  });
  it.each([
    [new InvalidApiKeyError("secret-body"), "auth"],
    [new RateLimitError("secret-body"), "rate_limit"],
    [new NetworkError("secret-body", "connection"), "network"],
    [new NetworkError("secret-body", "timeout"), "timeout"],
    [new GoveeApiError("secret-body", 403), "auth"],
    [new GoveeApiError("secret-body", 200, 429), "rate_limit"],
    [new GoveeApiError("secret-body", 500), "network"],
    [new ValidationError("secret-body"), "validation"],
  ])("sanitizes client errors into %s", async (failure, category) => {
    const command = vi.fn().mockRejectedValue(failure);
    const error = await new BoundedPowerClient(() => ({
      turnOn: command,
      turnOff: command,
    }))
      .setPower(light, true, "secret-key", new AbortController().signal)
      .catch((value) => value);
    expect(error.category).toBe(category);
    expect(JSON.stringify(error)).not.toContain("secret");
    expect(error.cause).toBeUndefined();
  });
  it("cancels the client when its five-second deadline expires", async () => {
    vi.useFakeTimers();
    const command = vi.fn(
      (_id, _model, options) =>
        new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true },
          );
        }),
    );
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation((ms) => {
        const controller = new AbortController();
        setTimeout(
          () => controller.abort(new DOMException("Expired", "TimeoutError")),
          ms,
        );
        return controller.signal;
      });
    const result = new BoundedPowerClient(() => ({
      turnOn: command,
      turnOff: command,
    })).setPower(light, true, "secret-key", new AbortController().signal);
    const rejection = expect(result).rejects.toMatchObject({
      category: "timeout",
    });
    await vi.advanceTimersByTimeAsync(5000);
    await rejection;
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(command).toHaveBeenCalledOnce();
  });
});
