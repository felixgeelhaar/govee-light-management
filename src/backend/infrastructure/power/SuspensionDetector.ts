/**
 * Detects that the computer was actually suspended.
 *
 * Stream Deck's `systemDidWakeUp` also fires when only the display wakes
 * (observed on macOS with no system sleep), which turned lights on with a
 * "Computer wakes" rule. A suspended process runs no timers, so the wall
 * clock moves far past the next scheduled tick; a running one does not.
 * Wall-clock gaps work on every OS, unlike monotonic clocks, which stop
 * during sleep on macOS but not necessarily on Windows.
 */
export class SuspensionDetector {
  private timer?: ReturnType<typeof setInterval>;
  private lastTickAt = 0;
  private suspendedUntil?: number;

  constructor(
    private readonly tickMs = 5_000,
    /** Lateness beyond one tick that counts as a suspension, not a busy loop. */
    private readonly thresholdMs = 15_000,
    /** How long after resuming a wake event is still attributed to it. */
    private readonly windowMs = 120_000,
  ) {}

  start(): void {
    if (this.timer) return;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.sample(), this.tickMs);
    this.timer.unref?.();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** True when a suspension ended within the wake window. */
  recentlySuspended(): boolean {
    this.sample();
    return (
      this.suspendedUntil !== undefined &&
      Date.now() - this.suspendedUntil <= this.windowMs
    );
  }

  // A wake event can arrive before the late tick runs, so asking samples too.
  private sample(): void {
    const now = Date.now();
    if (now - this.lastTickAt > this.tickMs + this.thresholdMs)
      this.suspendedUntil = now;
    this.lastTickAt = now;
  }
}
