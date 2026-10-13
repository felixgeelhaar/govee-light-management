import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { BoundedPowerClient } from "../../src/backend/infrastructure/BoundedPowerClient";

describe("lifecycle network cancellation", () => {
  it("aborts the real HTTP request rather than merely abandoning its promise", async () => {
    let accepted!: () => void;
    let disconnected!: () => void;
    const received = new Promise<void>((resolve) => {
      accepted = resolve;
    });
    const closed = new Promise<void>((resolve) => {
      disconnected = resolve;
    });
    const server = createServer((_request, response) => {
      response.on("close", disconnected);
      accepted();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test port");
    const controller = new AbortController();
    const client = new BoundedPowerClient((_url, options) =>
      fetch(`http://127.0.0.1:${address.port}`, options),
    );
    try {
      const request = client.setPower(
        { deviceId: "test-device", model: "H619A" },
        true,
        "test-key",
        controller.signal,
      );
      const rejected = expect(request).rejects.toMatchObject({
        category: "cancelled",
      });
      await received;
      controller.abort();
      await rejected;
      await closed;
    } finally {
      controller.abort();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10000);
});
