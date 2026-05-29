import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PULL_REQUEST_REVIEW_UI_STATE,
  PULL_REQUEST_REVIEW_DISPLAY_MODES,
  PULL_REQUESTS_SURFACE_MODES,
  REPOSITORY_SURFACES,
  useRepositorySurfaceStore,
} from "./repository-surface-store";

describe("repository surface store", () => {
  beforeEach(() => {
    useRepositorySurfaceStore.setState({ repoSurfaceStateByPath: {} });
  });

  it("tracks active repository surfaces independently", () => {
    useRepositorySurfaceStore.getState().showPullRequestsSurface("/repo-a");

    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo-a"]
        .activeSurface,
    ).toBe(REPOSITORY_SURFACES.pullRequests);
    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo-b"],
    ).toBeUndefined();

    useRepositorySurfaceStore.getState().showWorkspaceSurface("/repo-a");

    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo-a"]
        .activeSurface,
    ).toBe(REPOSITORY_SURFACES.workspace);
  });

  it("keeps pull request review UI state scoped by repository and number", () => {
    useRepositorySurfaceStore.getState().showPullRequestReview("/repo-a", 12);
    useRepositorySurfaceStore
      .getState()
      .updatePullRequestReviewState("/repo-a", 12, {
        selectedPath: "src/a.ts",
        displayMode: PULL_REQUEST_REVIEW_DISPLAY_MODES.split,
        historyOpen: true,
        scroll: { diff: 240 },
      });
    useRepositorySurfaceStore.getState().showPullRequestReview("/repo-a", 18);
    useRepositorySurfaceStore
      .getState()
      .updatePullRequestReviewState("/repo-b", 12, {
        selectedPath: "src/b.ts",
      });

    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo-a"]
        .pullRequestReviewByNumber[12],
    ).toEqual({
      ...DEFAULT_PULL_REQUEST_REVIEW_UI_STATE,
      selectedPath: "src/a.ts",
      displayMode: PULL_REQUEST_REVIEW_DISPLAY_MODES.split,
      historyOpen: true,
      scroll: { diff: 240 },
    });
    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo-a"]
        .pullRequestReviewByNumber[18],
    ).toEqual(DEFAULT_PULL_REQUEST_REVIEW_UI_STATE);
    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo-b"]
        .pullRequestReviewByNumber[12].selectedPath,
    ).toBe("src/b.ts");
  });

  it("keeps scroll and pull request mode in session-only state", () => {
    useRepositorySurfaceStore.getState().showPullRequestReview("/repo", 12);
    useRepositorySurfaceStore
      .getState()
      .setMainWorkspaceScroll("/repo", "history", 120);
    useRepositorySurfaceStore.getState().setPullRequestListScrollTop("/repo", 80);

    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo"],
    ).toMatchObject({
      activeSurface: REPOSITORY_SURFACES.pullRequests,
      pullRequestsSurfaceMode: PULL_REQUESTS_SURFACE_MODES.review,
      activePullRequestNumber: 12,
      mainWorkspaceScroll: { history: 120 },
      pullRequestListScrollTop: 80,
    });
  });
});
