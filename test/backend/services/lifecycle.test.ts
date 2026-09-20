import { describe, expect, it, vi } from "vitest";
import { createShutdownRunner } from "@/backend/services/lifecycle";

/**
 * Stream Deck stops a plugin by signalling its process. Until now nothing
 * listened: `SchedulerService.shutdown()` — which stops the 30s engine poll
 * and persists the schedule — was defined and never called, and CLAUDE.md
 * claimed graceful shutdown that no code performed.
 *
 * The runner is the seam. Signal wiring lives in plugin.ts; what has to be
 * right is that every handler runs, one failure does not strand the rest,
 * and a second signal does not run them twice.
 */
describe("shutdown runner", () => {
  it("runs each handler once, in registration order", async () => {
    const order: string[] = [];
    const runner = createShutdownRunner();
    runner.onShutdown("scheduler", async () => {
      order.push("scheduler");
    });
    runner.onShutdown("effects", async () => {
      order.push("effects");
    });

    await runner.run("SIGTERM");

    expect(order).toEqual(["scheduler", "effects"]);
  });

  it("keeps going when one handler fails, and reports it", async () => {
    const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
    const survivor = vi.fn().mockResolvedValue(undefined);
    const runner = createShutdownRunner(logger);
    runner.onShutdown("explodes", async () => {
      throw new Error("persist failed");
    });
    runner.onShutdown("survivor", survivor);

    await runner.run("SIGTERM");

    expect(survivor).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it("ignores a second signal", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const runner = createShutdownRunner();
    runner.onShutdown("scheduler", handler);

    await runner.run("SIGTERM");
    await runner.run("SIGINT");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("waits for a slow handler rather than racing it", async () => {
    let settled = false;
    const runner = createShutdownRunner();
    runner.onShutdown("slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      settled = true;
    });

    await runner.run("SIGTERM");

    expect(settled).toBe(true);
  });
});
