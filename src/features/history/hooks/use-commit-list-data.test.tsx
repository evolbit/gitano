import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMIT_HISTORY_WINDOW_SIZE } from "../components/commit-list/constants";
import { useCommitListData } from "./use-commit-list-data";

const getCommitHistoryWindowMock = vi.hoisted(() => vi.fn());
const getCommitGraphWindowMock = vi.hoisted(() => vi.fn());
const getRemoteUrlMock = vi.hoisted(() => vi.fn());
const getRepositoryStateMock = vi.hoisted(() => vi.fn());
const prepareCommitHistoryMock = vi.hoisted(() => vi.fn());
const searchCommitHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/commits", () => ({
  getCommitGraphWindow: getCommitGraphWindowMock,
  getCommitHistoryWindow: getCommitHistoryWindowMock,
  getRemoteUrl: getRemoteUrlMock,
  prepareCommitHistory: prepareCommitHistoryMock,
  searchCommitHistory: searchCommitHistoryMock,
}));

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: getRepositoryStateMock,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

describe("useCommitListData", () => {
  beforeEach(() => {
    getCommitHistoryWindowMock.mockReset();
    getCommitGraphWindowMock.mockReset();
    getRemoteUrlMock.mockReset();
    getRepositoryStateMock.mockReset();
    prepareCommitHistoryMock.mockReset();
    searchCommitHistoryMock.mockReset();
    getRemoteUrlMock.mockResolvedValue(null);
    getRepositoryStateMock.mockResolvedValue(null);
  });

  it("loads graph-only rows separately from commit details", async () => {
    const scrollContainerRef = { current: null };
    const graphRow = {
      rowIndex: 5_000,
      graphWidth: 6,
      graphLane: 2,
      graphColor: 1,
      graphSegments: [],
      refs: ["main", "tag: v1.0.0"],
    };

    getCommitGraphWindowMock.mockResolvedValue({
      rows: [graphRow],
      offset: 4_920,
      limit: 200,
      totalCount: 12_000,
    });

    const { result } = renderHook(() =>
      useCommitListData({ repoPath: "/repo", scrollContainerRef }),
    );

    await act(async () => {
      await result.current.loadCommitGraphWindow({
        offset: 4_920,
        limit: 200,
      });
    });

    expect(getCommitGraphWindowMock).toHaveBeenCalledWith({
      path: "/repo",
      offset: 4_920,
      limit: 200,
    });
    expect(result.current.graphRows).toEqual([graphRow]);
  });

  it("prepares history, loads a bounded commit window, and resets scroll", async () => {
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

    prepareCommitHistoryMock.mockResolvedValue({
      status: "ready",
      totalCount: 12_000,
      error: null,
    });
    getCommitHistoryWindowMock.mockResolvedValue({
      commits: [commit],
      offset: 0,
      limit: COMMIT_HISTORY_WINDOW_SIZE,
      totalCount: 12_000,
      hasPrevious: false,
      hasMore: true,
    });

    const { result } = renderHook(() =>
      useCommitListData({ repoPath: "/repo", scrollContainerRef }),
    );

    await act(async () => {
      await result.current.loadCommits({ forceRefresh: true, resetScroll: true });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(prepareCommitHistoryMock).toHaveBeenCalledWith({
      path: "/repo",
      forceRefresh: true,
    });
    expect(getCommitHistoryWindowMock).toHaveBeenCalledWith({
      path: "/repo",
      offset: 0,
      limit: COMMIT_HISTORY_WINDOW_SIZE,
      anchorSha: undefined,
      anchorRowIndex: undefined,
    });
    expect(result.current.commits).toEqual([commit]);
    expect(result.current.totalCount).toBe(12_000);
    expect(result.current.hasMoreWindow).toBe(true);
    expect(scrollElement.scrollTop).toBe(0);
  });

  it("keeps recently loaded commit details by absolute row index", async () => {
    const scrollContainerRef = { current: null };
    const firstCommit = {
      sha: "first-sha",
      message: "First window commit",
      author: "Ava",
      author_initial: "A",
      date: 1_700_000_000,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };
    const secondCommit = {
      sha: "second-sha",
      message: "Second window commit",
      author: "Grace",
      author_initial: "G",
      date: 1_699_999_999,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };

    getCommitHistoryWindowMock
      .mockResolvedValueOnce({
        commits: [firstCommit],
        offset: 0,
        limit: COMMIT_HISTORY_WINDOW_SIZE,
        totalCount: 12_000,
        hasPrevious: false,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        commits: [secondCommit],
        offset: 5_000,
        limit: COMMIT_HISTORY_WINDOW_SIZE,
        totalCount: 12_000,
        hasPrevious: true,
        hasMore: true,
      });

    const { result } = renderHook(() =>
      useCommitListData({ repoPath: "/repo", scrollContainerRef }),
    );

    await act(async () => {
      await result.current.loadCommitWindow({ offset: 0 });
    });
    await act(async () => {
      await result.current.loadCommitWindow({ offset: 5_000 });
    });

    expect(result.current.cachedCommitsByRowIndex.get(0)).toEqual(firstCommit);
    expect(result.current.cachedCommitsByRowIndex.get(5_000)).toEqual(
      secondCommit,
    );
  });

  it("ignores stale commit detail window responses", async () => {
    const scrollContainerRef = { current: null };
    const staleCommit = {
      sha: "stale-sha",
      message: "Stale window commit",
      author: "Ava",
      author_initial: "A",
      date: 1_700_000_000,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };
    const latestCommit = {
      sha: "latest-sha",
      message: "Latest window commit",
      author: "Grace",
      author_initial: "G",
      date: 1_699_999_999,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };
    const staleWindow = deferred<Awaited<
      ReturnType<typeof getCommitHistoryWindowMock>
    >>();
    const latestWindow = deferred<Awaited<
      ReturnType<typeof getCommitHistoryWindowMock>
    >>();

    getCommitHistoryWindowMock
      .mockReturnValueOnce(staleWindow.promise)
      .mockReturnValueOnce(latestWindow.promise);

    const { result } = renderHook(() =>
      useCommitListData({ repoPath: "/repo", scrollContainerRef }),
    );

    let staleLoad:
      | Awaited<ReturnType<typeof result.current.loadCommitWindow>>
      | Promise<Awaited<ReturnType<typeof result.current.loadCommitWindow>>>
      | null = null;
    let latestLoad:
      | Awaited<ReturnType<typeof result.current.loadCommitWindow>>
      | Promise<Awaited<ReturnType<typeof result.current.loadCommitWindow>>>
      | null = null;

    act(() => {
      staleLoad = result.current.loadCommitWindow({ offset: 0 });
      latestLoad = result.current.loadCommitWindow({ offset: 5_000 });
    });

    await act(async () => {
      latestWindow.resolve({
        commits: [latestCommit],
        offset: 5_000,
        limit: COMMIT_HISTORY_WINDOW_SIZE,
        totalCount: 12_000,
        hasPrevious: true,
        hasMore: true,
      });
      await latestLoad;
    });

    expect(result.current.commits).toEqual([latestCommit]);
    expect(result.current.windowOffset).toBe(5_000);

    await act(async () => {
      staleWindow.resolve({
        commits: [staleCommit],
        offset: 0,
        limit: COMMIT_HISTORY_WINDOW_SIZE,
        totalCount: 12_000,
        hasPrevious: false,
        hasMore: true,
      });
      await staleLoad;
    });

    expect(result.current.commits).toEqual([latestCommit]);
    expect(result.current.windowOffset).toBe(5_000);
  });

  it("loads a row window around backend search matches", async () => {
    const scrollContainerRef = { current: null };
    const commit = {
      sha: "match-sha",
      message: "Fix cache",
      author: "Ava",
      author_initial: "A",
      date: 1_700_000_000,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };

    searchCommitHistoryMock.mockResolvedValue({
      query: "fix",
      matchCount: 4,
      currentMatchPosition: 2,
      matchedRowIndex: 5000,
      matchedSha: "match-sha",
    });
    getCommitHistoryWindowMock.mockResolvedValue({
      commits: [commit],
      offset: 4500,
      limit: COMMIT_HISTORY_WINDOW_SIZE,
      totalCount: 12_000,
      hasPrevious: true,
      hasMore: true,
    });

    const { result } = renderHook(() =>
      useCommitListData({ repoPath: "/repo", scrollContainerRef }),
    );

    let searchResult:
      | Awaited<ReturnType<typeof result.current.runCommitSearch>>
      | undefined;

    await act(async () => {
      searchResult = await result.current.runCommitSearch({
        query: "fix",
        currentRowIndex: 10,
        direction: "next",
      });
    });

    expect(searchCommitHistoryMock).toHaveBeenCalledWith({
      path: "/repo",
      query: "fix",
      currentRowIndex: 10,
      direction: "next",
    });
    expect(getCommitHistoryWindowMock).toHaveBeenCalledWith({
      path: "/repo",
      offset: undefined,
      limit: COMMIT_HISTORY_WINDOW_SIZE,
      anchorSha: undefined,
      anchorRowIndex: 5000,
    });
    expect(searchResult?.loadedWindowOffset).toBe(4500);
    expect(searchResult?.loadedCommit).toEqual(commit);
    expect(result.current.searchResult?.matchCount).toBe(4);
  });

  it("can retry after history preparation fails", async () => {
    const scrollContainerRef = { current: null };
    const commit = {
      sha: "retry-sha",
      message: "Retry success",
      author: "Ava",
      author_initial: "A",
      date: 1_700_000_000,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };

    prepareCommitHistoryMock
      .mockResolvedValueOnce({
        status: "error",
        totalCount: 0,
        error: "failed",
      })
      .mockResolvedValueOnce({
        status: "ready",
        totalCount: 1,
        error: null,
      });
    getCommitHistoryWindowMock.mockResolvedValue({
      commits: [commit],
      offset: 0,
      limit: COMMIT_HISTORY_WINDOW_SIZE,
      totalCount: 1,
      hasPrevious: false,
      hasMore: false,
    });

    const { result } = renderHook(() =>
      useCommitListData({ repoPath: "/repo", scrollContainerRef }),
    );

    await act(async () => {
      await result.current.loadCommits({ forceRefresh: true });
    });

    expect(result.current.error).toBe("failed");

    await act(async () => {
      await result.current.loadCommits({ forceRefresh: true });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.commits).toEqual([commit]);
  });
});
