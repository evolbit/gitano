import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FULL_LOG_COMMIT_LIMIT } from "../components/commit-list/constants";
import { useCommitListData } from "./use-commit-list-data";

const getCommitsListPaginatedMock = vi.hoisted(() => vi.fn());
const getRemoteUrlMock = vi.hoisted(() => vi.fn());
const getRepositoryStateMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/commits", () => ({
  getCommitsListPaginated: getCommitsListPaginatedMock,
  getRemoteUrl: getRemoteUrlMock,
}));

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: getRepositoryStateMock,
}));

describe("useCommitListData", () => {
  beforeEach(() => {
    getCommitsListPaginatedMock.mockReset();
    getRemoteUrlMock.mockReset();
    getRepositoryStateMock.mockReset();
    getRemoteUrlMock.mockResolvedValue(null);
    getRepositoryStateMock.mockResolvedValue(null);
  });

  it("loads commits, reports truncation, and resets scroll on demand", async () => {
    const scrollElement = { scrollTop: 120 } as HTMLDivElement;
    const scrollContainerRef = { current: scrollElement };
    const commit = {
      sha: "abcdef1234567890",
      message: "Fix cache",
      author: "Ava",
      author_initial: "A",
      date: 1_700_000_000,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };
    getCommitsListPaginatedMock.mockResolvedValue({
      commits: [commit],
      has_more: true,
    });

    const { result } = renderHook(() =>
      useCommitListData({ repoPath: "/repo", scrollContainerRef }),
    );

    await act(async () => {
      await result.current.loadCommits({ forceRefresh: true, resetScroll: true });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCommitsListPaginatedMock).toHaveBeenCalledWith({
      path: "/repo",
      offset: 0,
      limit: FULL_LOG_COMMIT_LIMIT,
      forceRefresh: true,
    });
    expect(result.current.commits).toEqual([commit]);
    expect(result.current.error).toContain("Commit history truncated");
    expect(scrollElement.scrollTop).toBe(0);
  });
});
