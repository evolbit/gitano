import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REPOSITORY_SURFACE_STATE,
  PULL_REQUESTS_SURFACE_MODES,
  useRepositorySurfaceStore,
} from "../../stores/repository-surface-store";
import { RepositoryPullRequestsSurface } from "./repository-pull-requests-surface";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/features/pull-requests", () => ({
  PullRequestListSurface: ({
    onReviewPullRequest,
  }: {
    onReviewPullRequest: (review: {
      number: number;
      title: string;
      baseRef: string;
      headRef: string;
      baseLabel: string;
      headLabel: string;
    }) => void;
  }) => (
    <div>
      PullRequestList
      <button
        type="button"
        onClick={() =>
          onReviewPullRequest({
            number: 12,
            title: "Improve checkout flow",
            baseRef: "refs/remotes/origin/main",
            headRef: "refs/remotes/origin/pull/12/head",
            baseLabel: "acme:main",
            headLabel: "acme:feature",
          })
        }
      >
        Review PR
      </button>
    </div>
  ),
}));

vi.mock("@/features/branches", () => ({
  PrReview: ({
    onBackToList,
    onUiStateChange,
    pullRequestContext,
  }: {
    onBackToList: () => void;
    onUiStateChange: (state: { selectedPath: string }) => void;
    pullRequestContext: { number: number; title: string };
  }) => (
    <div>
      Review #{pullRequestContext.number}: {pullRequestContext.title}
      <button
        type="button"
        onClick={() => onUiStateChange({ selectedPath: "src/app.ts" })}
      >
        Select file
      </button>
      <button type="button" onClick={onBackToList}>
        Back to list
      </button>
    </div>
  ),
}));

describe("RepositoryPullRequestsSurface", () => {
  afterEach(() => {
    cleanup();
    useRepositorySurfaceStore.setState({ repoSurfaceStateByPath: {} });
  });

  it("routes from list mode into review mode and back to the list", () => {
    render(<RepositoryPullRequestsSurface repoPath="/repo" />);

    fireEvent.click(screen.getByRole("button", { name: "Review PR" }));

    expect(screen.getByText("Review #12: Improve checkout flow")).toBeInTheDocument();
    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo"],
    ).toMatchObject({
      pullRequestsSurfaceMode: PULL_REQUESTS_SURFACE_MODES.review,
      activePullRequestNumber: 12,
    });

    fireEvent.click(screen.getByRole("button", { name: "Select file" }));

    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo"]
        .pullRequestReviewByNumber[12].selectedPath,
    ).toBe("src/app.ts");

    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));

    expect(screen.getByText("PullRequestList")).toBeInTheDocument();
    expect(
      useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo"]
        .pullRequestsSurfaceMode,
    ).toBe(PULL_REQUESTS_SURFACE_MODES.list);
  });

  it("falls back to list mode when review context is missing", async () => {
    useRepositorySurfaceStore.setState({
      repoSurfaceStateByPath: {
        "/repo": {
          ...DEFAULT_REPOSITORY_SURFACE_STATE,
          pullRequestsSurfaceMode: PULL_REQUESTS_SURFACE_MODES.review,
          activePullRequestNumber: 99,
        },
      },
    });

    render(<RepositoryPullRequestsSurface repoPath="/repo" />);

    await waitFor(() => {
      expect(
        useRepositorySurfaceStore.getState().repoSurfaceStateByPath["/repo"]
          .pullRequestsSurfaceMode,
      ).toBe(PULL_REQUESTS_SURFACE_MODES.list);
    });
    expect(screen.getByText("PullRequestList")).toBeInTheDocument();
  });
});
