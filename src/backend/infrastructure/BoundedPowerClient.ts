import { randomUUID } from "node:crypto";

export class PowerRequestError extends Error {
  constructor(
    readonly category:
      | "network"
      | "timeout"
      | "auth"
      | "rate_limit"
      | "validation"
      | "cancelled",
  ) {
    super(`Power request failed: ${category}`);
  }
}

/**
 * The installed API client has timeouts but no per-command AbortSignal API.
 * This narrow adapter uses the same documented power endpoint, without its
 * retry middleware, so lifecycle cancellation reaches the network request.
 */
export class BoundedPowerClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async setPower(
    light: { deviceId: string; model: string },
    isOn: boolean,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<void> {
    signal.throwIfAborted();
    const deadline = AbortSignal.timeout(5000);
    const requestSignal = AbortSignal.any([signal, deadline]);
    try {
      const response = await this.fetcher(
        "https://openapi.api.govee.com/router/api/v1/device/control",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Govee-API-Key": apiKey,
          },
          signal: requestSignal,
          redirect: "error",
          body: JSON.stringify({
            requestId: randomUUID(),
            payload: {
              sku: light.model,
              device: light.deviceId,
              capability: {
                type: "devices.capabilities.on_off",
                instance: "powerSwitch",
                value: isOn ? 1 : 0,
              },
            },
          }),
        },
      );
      if (response.status === 401 || response.status === 403)
        throw new PowerRequestError("auth");
      if (response.status === 429) throw new PowerRequestError("rate_limit");
      if (!response.ok)
        throw new PowerRequestError(
          response.status >= 500 ? "network" : "validation",
        );
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new PowerRequestError("validation");
      }
      signal.throwIfAborted();
      if (!body || typeof body !== "object" || !("code" in body))
        throw new PowerRequestError("validation");
      if (body.code === 401 || body.code === 403)
        throw new PowerRequestError("auth");
      if (body.code === 429) throw new PowerRequestError("rate_limit");
      if (body.code !== 200) throw new PowerRequestError("validation");
    } catch (error) {
      if (signal.aborted) throw new PowerRequestError("cancelled");
      if (deadline.aborted) throw new PowerRequestError("timeout");
      if (error instanceof PowerRequestError) throw error;
      // Do not retain fetch errors/causes, request options, or API body text.
      throw new PowerRequestError("network");
    }
  }
}
