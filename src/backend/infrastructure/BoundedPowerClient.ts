import {
  GoveeClient,
  GoveeApiError,
  InvalidApiKeyError,
  NetworkError,
  RateLimitError,
} from "@felixgeelhaar/govee-api-client";

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

type PowerClient = Pick<GoveeClient, "turnOn" | "turnOff">;

/** Keeps lifecycle deadlines and sanitized errors around the shared API client. */
export class BoundedPowerClient {
  constructor(
    private readonly createClient: (apiKey: string) => PowerClient = (apiKey) =>
      new GoveeClient({ apiKey, timeout: 5000, enableRetries: false }),
  ) {}

  async setPower(
    light: { deviceId: string; model: string },
    isOn: boolean,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<void> {
    const deadline = AbortSignal.timeout(5000);
    const requestSignal = AbortSignal.any([signal, deadline]);
    try {
      requestSignal.throwIfAborted();
      const client = this.createClient(apiKey);
      const options = { signal: requestSignal };
      if (isOn) await client.turnOn(light.deviceId, light.model, options);
      else await client.turnOff(light.deviceId, light.model, options);
      requestSignal.throwIfAborted();
    } catch (error) {
      if (signal.aborted) throw new PowerRequestError("cancelled");
      if (deadline.aborted) throw new PowerRequestError("timeout");
      if (error instanceof InvalidApiKeyError)
        throw new PowerRequestError("auth");
      if (error instanceof RateLimitError)
        throw new PowerRequestError("rate_limit");
      if (error instanceof NetworkError)
        throw new PowerRequestError(
          error.errorType === "timeout" ? "timeout" : "network",
        );
      if (error instanceof GoveeApiError) {
        if (
          error.statusCode === 401 ||
          error.statusCode === 403 ||
          error.apiErrorCode === 401 ||
          error.apiErrorCode === 403
        )
          throw new PowerRequestError("auth");
        if (error.statusCode === 429 || error.apiErrorCode === 429)
          throw new PowerRequestError("rate_limit");
        if (error.statusCode >= 500) throw new PowerRequestError("network");
      }
      // Never retain client errors, Axios causes, keys, or response bodies.
      throw new PowerRequestError("validation");
    }
  }
}
