/**
 * The tracker's read side — the two accessors keypad actions render
 * from, which report the same state in two forms. `getStatusGlyph`
 * builds the title text (#194); `getStatus` drives the badge painted
 * onto the key artwork, added in #333 because Stream Deck ignores
 * `setTitle()` once a user sets a title of their own. They must never
 * disagree, or one copy of the dot would contradict the other.
 */
import { describe, expect, it } from "vitest";
import { KeypadStateTracker } from "../../../../src/backend/actions/shared/KeypadStateTracker";

const makeTracker = () => new KeypadStateTracker();

describe("KeypadStateTracker.getStatus", () => {
  it("reports unknown before any state has been sampled", () => {
    expect(makeTracker().getStatus("ctx")).toBe("unknown");
  });

  it("reports on for a single light that is on", () => {
    const tracker = makeTracker();
    tracker.setOptimisticSingle("ctx", true);
    expect(tracker.getStatus("ctx")).toBe("on");
  });

  it("reports off for a single light that is off", () => {
    const tracker = makeTracker();
    tracker.setOptimisticSingle("ctx", false);
    expect(tracker.getStatus("ctx")).toBe("off");
  });

  it("reports on when every group member is on", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 3, 3);
    expect(tracker.getStatus("ctx")).toBe("on");
  });

  it("reports partial when some but not all members are on", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 1, 3);
    expect(tracker.getStatus("ctx")).toBe("partial");
  });

  it("reports off when no group member is on", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 0, 3);
    expect(tracker.getStatus("ctx")).toBe("off");
  });

  it("keeps contexts independent", () => {
    const tracker = makeTracker();
    tracker.setOptimisticSingle("a", true);
    tracker.setOptimisticSingle("b", false);
    expect(tracker.getStatus("a")).toBe("on");
    expect(tracker.getStatus("b")).toBe("off");
  });
});

describe("KeypadStateTracker.getStatusGlyph", () => {
  it("is empty before any state has been sampled", () => {
    expect(makeTracker().getStatusGlyph("ctx")).toBe("");
  });

  it("renders a bare glyph for a single light", () => {
    const tracker = makeTracker();
    tracker.setOptimisticSingle("ctx", true);
    expect(tracker.getStatusGlyph("ctx")).toBe("●");
  });

  it("renders glyph over on-count for a group", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 1, 3);
    expect(tracker.getStatusGlyph("ctx")).toBe("◐\n1/3");
  });

  it("drops back to empty once the context is detached", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 2, 2);
    tracker.detach("ctx");
    expect(tracker.getStatusGlyph("ctx")).toBe("");
    expect(tracker.getStatus("ctx")).toBe("unknown");
  });
});

describe("KeypadStateTracker — title glyph and badge agree", () => {
  // The key shows the same state twice: as text in the title and as a
  // badge on the artwork. A disagreement between them would be visible
  // to the user as two dots contradicting each other on one key.
  const glyphForStatus = { on: "●", partial: "◐", off: "○" } as const;

  it.each([
    {
      label: "single on",
      apply: (t: KeypadStateTracker) => t.setOptimisticSingle("c", true),
    },
    {
      label: "single off",
      apply: (t: KeypadStateTracker) => t.setOptimisticSingle("c", false),
    },
    {
      label: "group all on",
      apply: (t: KeypadStateTracker) => t.setOptimisticGroup("c", 3, 3),
    },
    {
      label: "group partial",
      apply: (t: KeypadStateTracker) => t.setOptimisticGroup("c", 1, 3),
    },
    {
      label: "group all off",
      apply: (t: KeypadStateTracker) => t.setOptimisticGroup("c", 0, 3),
    },
  ])("$label", ({ apply }) => {
    const tracker = makeTracker();
    apply(tracker);
    const status = tracker.getStatus("c") as keyof typeof glyphForStatus;
    expect(tracker.getStatusGlyph("c").startsWith(glyphForStatus[status])).toBe(
      true,
    );
  });
});
