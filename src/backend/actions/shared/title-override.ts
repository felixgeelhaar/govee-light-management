/**
 * Tracks whether the user has taken a key's title over from the plugin.
 *
 * Keypad actions show power state as a ●/◐/○ glyph in the title (#194).
 * Stream Deck renders titles by the precedence user-defined > plugin
 * `setTitle()` > manifest default, so the moment a user types a title
 * of their own, every `setTitle()` call is silently dropped and the
 * glyph disappears with it (#333).
 *
 * The badge drawn onto the key artwork (`status-badge.ts`) is the
 * fallback. It should appear *only* when the title glyph has actually
 * gone — showing both would put the same dot on one key twice.
 *
 * There is no API flag for "the user set a title", so this infers it:
 *
 *   - `showTitle` is first-class — the SDK documents it as whether the
 *     *user* opted to show or hide the title. Hidden means the glyph is
 *     invisible regardless of what the plugin writes.
 *   - Otherwise, compare the title Stream Deck reports against the last
 *     one the plugin wrote. They diverge exactly when a user title is
 *     winning the precedence contest.
 *
 * The one blind spot is a user title identical to the plugin's own, which
 * reads as "not overridden" — and is harmless, because an identical title
 * still renders the same glyph.
 */

/** The parts of a `titleParametersDidChange` payload that matter here. */
export interface TitleParameters {
  /** Title as rendered — the user's if they set one, else the plugin's. */
  title: string;
  /** Whether the user has opted to show the title for this key. */
  showTitle: boolean;
}

export class TitleOverrideTracker {
  /** Last title the plugin wrote, per action context. */
  private lastWritten = new Map<string, string>();
  /** Whether the user's title (or hidden title) is currently winning. */
  private overridden = new Map<string, boolean>();

  /**
   * Record a title the plugin just wrote. Callers should invoke this on
   * every `setTitle()` so the next `observe()` compares against current
   * output rather than a stale value.
   */
  noteWritten(ctx: string, title: string): void {
    this.lastWritten.set(ctx, title);
  }

  /**
   * Fold in a `titleParametersDidChange` payload.
   *
   * @returns `true` when the override state flipped, so the caller knows
   * a re-render is needed. Repeated events that do not change the state
   * return `false`, keeping idle keys from re-rendering needlessly.
   */
  observe(ctx: string, params: TitleParameters): boolean {
    const written = this.lastWritten.get(ctx);
    // Before the plugin has written anything, any non-empty title can
    // only have come from the user.
    const displaced =
      written === undefined ? params.title !== "" : params.title !== written;

    const next = !params.showTitle || displaced;
    const previous = this.overridden.get(ctx) ?? false;
    this.overridden.set(ctx, next);
    return next !== previous;
  }

  /** Whether the title glyph is currently invisible to the user. */
  isOverridden(ctx: string): boolean {
    return this.overridden.get(ctx) ?? false;
  }

  /** Drop all state for a context, on `onWillDisappear`. */
  forget(ctx: string): void {
    this.lastWritten.delete(ctx);
    this.overridden.delete(ctx);
  }
}
