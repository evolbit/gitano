import { beforeEach, describe, expect, it } from "vitest";
import { useGitActionsStore } from "./git-actions-store";

describe("git actions store", () => {
  beforeEach(() => {
    useGitActionsStore.setState({
      pendingAction: null,
      notice: null,
    });
  });

  it("tracks the pending remote action", () => {
    useGitActionsStore.getState().setPendingAction("push");

    expect(useGitActionsStore.getState().pendingAction).toBe("push");
  });

  it("stores and clears git action notices", () => {
    const notice = {
      kind: "success" as const,
      title: "Pushed",
      details: "origin/main updated",
      expanded: false,
    };

    useGitActionsStore.getState().setNotice(notice);
    expect(useGitActionsStore.getState().notice).toEqual(notice);

    useGitActionsStore.getState().setNotice(null);

    expect(useGitActionsStore.getState().notice).toBeNull();
  });
});
