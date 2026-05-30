import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PULL_STRATEGY,
  DEFAULT_PUSH_MODE,
  DEFAULT_REPO_WORKSPACE_STATE,
  DEFAULT_WINDOW_BOUNDS,
  useWorkspaceUiStore,
} from "./workspace-ui-store";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe("workspace UI store", () => {
  beforeEach(() => {
    useWorkspaceUiStore.setState({
      window: DEFAULT_WINDOW_BOUNDS,
      pullStrategy: DEFAULT_PULL_STRATEGY,
      pushMode: DEFAULT_PUSH_MODE,
      repoStateByPath: {},
    });
  });

  it("merges partial repo updates with default workspace state", () => {
    useWorkspaceUiStore
      .getState()
      .setSelectedWorkingDiffPath("/repo", "src/file.ts");

    expect(useWorkspaceUiStore.getState().repoStateByPath["/repo"]).toEqual({
      ...DEFAULT_REPO_WORKSPACE_STATE,
      selectedWorkingDiffPath: "src/file.ts",
    });
  });

  it("normalizes the legacy folders left pane section during repo updates", () => {
    useWorkspaceUiStore.setState({
      repoStateByPath: {
        "/repo": {
          ...DEFAULT_REPO_WORKSPACE_STATE,
          leftPaneSection: "folders" as never,
        },
      },
    });

    useWorkspaceUiStore.getState().setSelectedStashRef("/repo", "stash@{0}");

    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].leftPaneSection,
    ).toBe("stashes");
  });

  it("updates app-level window bounds and remote action preferences", () => {
    useWorkspaceUiStore.getState().setWindowBounds({ width: 900, x: 12 });
    useWorkspaceUiStore.getState().setPullStrategy("pull-ff-only");
    useWorkspaceUiStore.getState().setPushMode("push-branch-and-tags");

    expect(useWorkspaceUiStore.getState().window).toEqual({
      ...DEFAULT_WINDOW_BOUNDS,
      width: 900,
      x: 12,
    });
    expect(useWorkspaceUiStore.getState().pullStrategy).toBe("pull-ff-only");
    expect(useWorkspaceUiStore.getState().pushMode).toBe("push-branch-and-tags");
  });

  it("persists branch and tag presence filters independently", () => {
    useWorkspaceUiStore
      .getState()
      .setBranchPresenceFilter("/repo", { local: true, remote: false });
    useWorkspaceUiStore
      .getState()
      .setTagPresenceFilter("/repo", { local: false, remote: true });

    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"]
        .branchPresenceFilter,
    ).toEqual({ local: true, remote: false });
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"]
        .tagPresenceFilter,
    ).toEqual({ local: false, remote: true });
  });

  it("normalizes empty branch and tag presence filters", () => {
    useWorkspaceUiStore
      .getState()
      .setBranchPresenceFilter("/repo", { local: false, remote: false });
    useWorkspaceUiStore
      .getState()
      .setTagPresenceFilter("/repo", { local: false, remote: false });

    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"]
        .branchPresenceFilter,
    ).toEqual({ local: true, remote: true });
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"]
        .tagPresenceFilter,
    ).toEqual({ local: true, remote: true });
  });
});
