import { describe, expect, it } from "vitest";
import {
  clearPendingSyncedScrollTop,
  markPendingSyncedScrollTop,
  shouldIgnoreSyncedScrollEvent,
} from "./conflict-scroll-sync";

describe("conflict scroll sync", () => {
  it("ignores the pending programmatic scroll event once", () => {
    const pending = { current: null };

    markPendingSyncedScrollTop(pending, 120);

    expect(shouldIgnoreSyncedScrollEvent(pending, 120)).toBe(true);
    expect(pending.current).toBeNull();
    expect(shouldIgnoreSyncedScrollEvent(pending, 121)).toBe(false);
  });

  it("publishes a different user scroll while a programmatic scroll is pending", () => {
    const pending = { current: null };

    markPendingSyncedScrollTop(pending, 120);

    expect(shouldIgnoreSyncedScrollEvent(pending, 160)).toBe(false);
    expect(pending.current).toBeNull();
  });

  it("clears stale pending scroll state when no scroll event fires", () => {
    const pending = { current: null };

    markPendingSyncedScrollTop(pending, 120);
    clearPendingSyncedScrollTop(pending, 120);

    expect(pending.current).toBeNull();
  });
});
