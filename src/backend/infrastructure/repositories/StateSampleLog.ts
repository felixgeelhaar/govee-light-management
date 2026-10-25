import streamDeck from "@elgato/streamdeck";

export interface StateSampleSummary {
  /** Length of the window the counts cover, in whole minutes. */
  windowMinutes: number;
  /** Cloud queries: the ones that count against Govee's rate limit. */
  total: number;
  /** Reads answered by the light over the local network. */
  lan: number;
  lights: { light: string; name: string; count: number; lan: number }[];
}

type SampledLight = { deviceId: string; model: string; name: string };

const DEFAULT_WINDOW_MS = 10 * 60_000;

/**
 * Counts live-state queries per light and logs one `light.state.samples`
 * summary per window, so the per-device sample rate against the rate-limited
 * API can be read from the plugin log without a line per query. The window
 * closes on the first query after it expires; no timer is held.
 */
export class StateSampleLog {
  private readonly counts = new Map<
    string,
    { name: string; count: number; lan: number }
  >();
  private windowStart: number;

  constructor(
    private readonly windowMs = DEFAULT_WINDOW_MS,
    private readonly now: () => number = Date.now,
    private readonly emit: (summary: StateSampleSummary) => void = (summary) =>
      streamDeck.logger.info("light.state.samples", summary),
  ) {
    this.windowStart = now();
  }

  record(light: SampledLight, via: "cloud" | "lan" = "cloud"): void {
    const time = this.now();
    if (time - this.windowStart >= this.windowMs) this.flush(time);
    const key = `${light.deviceId}|${light.model}`;
    const entry = this.counts.get(key) ?? {
      name: light.name,
      count: 0,
      lan: 0,
    };
    if (via === "lan") entry.lan += 1;
    else entry.count += 1;
    this.counts.set(key, entry);
  }

  private flush(time: number): void {
    const lights = [...this.counts].map(([light, { name, count, lan }]) => ({
      light,
      name,
      count,
      lan,
    }));
    this.emit({
      windowMinutes: Math.round((time - this.windowStart) / 60_000),
      total: lights.reduce((sum, entry) => sum + entry.count, 0),
      lan: lights.reduce((sum, entry) => sum + entry.lan, 0),
      lights,
    });
    this.counts.clear();
    this.windowStart = time;
  }
}

/** Shared by every repository instance so the summary covers the whole plugin. */
export const stateSamples = new StateSampleLog();
