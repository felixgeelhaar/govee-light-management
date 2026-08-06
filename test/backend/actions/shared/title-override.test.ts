/**
 * Detecting when the user has taken the title over from the plugin.
 *
 * The keypad shows power state as a glyph in the title (#194). Stream
 * Deck silently drops every `setTitle()` once the user sets a title of
 * their own, taking the glyph with it (#333). The badge on the artwork
 * is the fallback — but it should appear *only* when the title glyph
 * has actually gone, otherwise the key shows the same dot twice.
 */
import { describe, expect, it } from "vitest";
import { TitleOverrideTracker } from "../../../../src/backend/actions/shared/title-override";

const shown = (title: string) => ({ title, showTitle: true });

describe("TitleOverrideTracker", () => {
  it("reports no override before anything has been observed", () => {
    expect(new TitleOverrideTracker().isOverridden("ctx")).toBe(false);
  });

  it("treats the plugin's own title as no override", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "85%\n●");
    t.observe("ctx", shown("85%\n●"));
    expect(t.isOverridden("ctx")).toBe(false);
  });

  it("detects a user title that displaced the plugin's", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "85%\n●");
    t.observe("ctx", shown("Desk"));
    expect(t.isOverridden("ctx")).toBe(true);
  });

  it("detects a user title present before the plugin has written one", () => {
    const t = new TitleOverrideTracker();
    t.observe("ctx", shown("Desk"));
    expect(t.isOverridden("ctx")).toBe(true);
  });

  it("does not mistake an empty title for a user override", () => {
    const t = new TitleOverrideTracker();
    t.observe("ctx", shown(""));
    expect(t.isOverridden("ctx")).toBe(false);
  });

  it("treats a hidden title as an override, since the glyph is invisible", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "85%\n●");
    t.observe("ctx", { title: "85%\n●", showTitle: false });
    expect(t.isOverridden("ctx")).toBe(true);
  });

  it("clears the override when the user deletes their custom title", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "85%\n●");
    t.observe("ctx", shown("Desk"));
    expect(t.isOverridden("ctx")).toBe(true);

    // Plugin re-renders; Stream Deck now reports the plugin's title again.
    t.noteWritten("ctx", "85%\n●");
    t.observe("ctx", shown("85%\n●"));
    expect(t.isOverridden("ctx")).toBe(false);
  });

  it("re-hides the badge when the user re-enables a hidden title", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "●");
    t.observe("ctx", { title: "●", showTitle: false });
    expect(t.isOverridden("ctx")).toBe(true);
    t.observe("ctx", { title: "●", showTitle: true });
    expect(t.isOverridden("ctx")).toBe(false);
  });

  it("tracks the newest plugin title, not the first", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "85%\n●");
    t.noteWritten("ctx", "40%\n●");
    t.observe("ctx", shown("40%\n●"));
    expect(t.isOverridden("ctx")).toBe(false);
  });

  it("keeps contexts independent", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("a", "85%\n●");
    t.noteWritten("b", "85%\n●");
    t.observe("a", shown("Desk"));
    t.observe("b", shown("85%\n●"));
    expect(t.isOverridden("a")).toBe(true);
    expect(t.isOverridden("b")).toBe(false);
  });

  it("forgets a context so a recycled key id cannot inherit stale state", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "85%\n●");
    t.observe("ctx", shown("Desk"));
    t.forget("ctx");
    expect(t.isOverridden("ctx")).toBe(false);
  });
});

describe("TitleOverrideTracker.observe — change reporting", () => {
  it("reports true only when the override state actually flips", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "●");

    // Same as the plugin wrote — no change from the default of false.
    expect(t.observe("ctx", shown("●"))).toBe(false);
    // User takes over — flips to true.
    expect(t.observe("ctx", shown("Desk"))).toBe(true);
    // Repeat of the same user title — no flip, so no needless re-render.
    expect(t.observe("ctx", shown("Desk"))).toBe(false);
    // User edits their title again — still overridden, still no flip.
    expect(t.observe("ctx", shown("Desk Lamp"))).toBe(false);
  });
});

describe("TitleOverrideTracker — badge visibility rule", () => {
  // The whole point: exactly one dot is visible at any time.
  it("shows the badge when the title glyph is gone, and not otherwise", () => {
    const t = new TitleOverrideTracker();
    t.noteWritten("ctx", "85%\n●");

    t.observe("ctx", shown("85%\n●"));
    expect(t.isOverridden("ctx")).toBe(false); // glyph visible → no badge

    t.observe("ctx", shown("Desk"));
    expect(t.isOverridden("ctx")).toBe(true); // glyph gone → badge

    t.observe("ctx", { title: "Desk", showTitle: false });
    expect(t.isOverridden("ctx")).toBe(true); // title hidden → badge
  });
});
