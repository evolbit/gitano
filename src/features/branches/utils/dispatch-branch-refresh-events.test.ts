import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_EVENTS } from "@/shared/config/events";
import { dispatchBranchRefreshEvents } from "./dispatch-branch-refresh-events";

describe("dispatchBranchRefreshEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests branch, commit, and working-change refreshes together", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    dispatchBranchRefreshEvents();

    expect(dispatchSpy.mock.calls.map(([event]) => event.type)).toEqual([
      APP_EVENTS.repoRefsRefresh,
      APP_EVENTS.commitsRefresh,
      APP_EVENTS.workingChangesRefresh,
    ]);
  });
});
