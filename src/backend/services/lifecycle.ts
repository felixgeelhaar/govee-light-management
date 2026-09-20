interface Logger {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

type ShutdownHandler = () => Promise<void> | void;

/**
 * Ordered shutdown for work that outlives a single action.
 *
 * Stream Deck stops a plugin by signalling its process, and nothing here
 * listened: `SchedulerService.shutdown()` — which stops the 30s engine poll
 * and persists the schedule — was defined and never called.
 *
 * Signal wiring belongs to the entry point; this is the part worth testing.
 * Handlers run in registration order and are awaited, one failure never
 * strands the rest, and a second signal is ignored — a plugin being stopped
 * often gets SIGTERM and SIGINT in quick succession, and persisting twice
 * from half-torn-down state is worse than not persisting at all.
 */
export function createShutdownRunner(logger?: Logger) {
  const handlers: Array<{ name: string; run: ShutdownHandler }> = [];
  let started = false;

  return {
    onShutdown(name: string, run: ShutdownHandler): void {
      handlers.push({ name, run });
    },

    async run(signal: string): Promise<void> {
      if (started) return;
      started = true;
      logger?.info?.(`Shutting down on ${signal}`);

      for (const { name, run } of handlers) {
        try {
          await run();
        } catch (error) {
          // Report and continue: the next handler may be the one holding the
          // work worth saving.
          logger?.error?.(`Shutdown step "${name}" failed:`, error);
        }
      }
    },
  };
}

export type ShutdownRunner = ReturnType<typeof createShutdownRunner>;
