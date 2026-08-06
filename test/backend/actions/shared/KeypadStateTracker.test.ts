/**
 * The tracker's read side — the two accessors keypad actions render
 * from. `getStatus` drives the ●/◐/○ badge painted onto the key
 * artwork; `getGroupCount` supplies the `N/M` text that stays in the
 * title. They were split apart in #333: the status had to leave the
 * title because Stream Deck ignores `setTitle()` once a user sets a
 * title of their own.
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

describe("KeypadStateTracker.getGroupCount", () => {
  it("is empty before any state has been sampled", () => {
    expect(makeTracker().getGroupCount("ctx")).toBe("");
  });

  it("is empty for a single-light target, which has nothing to count", () => {
    const tracker = makeTracker();
    tracker.setOptimisticSingle("ctx", true);
    expect(tracker.getGroupCount("ctx")).toBe("");
  });

  it("reports on-count over total for a group", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 1, 3);
    expect(tracker.getGroupCount("ctx")).toBe("1/3");
  });

  it("ignores a zero-total group rather than rendering 0/0", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 0, 0);
    expect(tracker.getGroupCount("ctx")).toBe("");
  });

  it("drops back to empty once the context is detached", () => {
    const tracker = makeTracker();
    tracker.setOptimisticGroup("ctx", 2, 2);
    tracker.detach("ctx");
    expect(tracker.getGroupCount("ctx")).toBe("");
    expect(tracker.getStatus("ctx")).toBe("unknown");
  });
});
