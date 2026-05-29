import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  getCommitGraphWindow,
  getCommitHistoryWindow,
  getRemoteUrl,
  prepareCommitHistory,
  searchCommitHistory,
} from "@/shared/api/git/commits";
import { getRepositoryState } from "@/shared/api/repositories";
import { APP_EVENTS } from "@/shared/config/events";
import type {
  CommitGraphRow,
  CommitHistoryWindow,
  CommitHistorySearchResponse,
  CommitListItem,
  RepositoryState,
} from "@/shared/types/git";
import { COMMIT_HISTORY_WINDOW_SIZE } from "../components/commit-list/constants";
import type { LoadCommitsOptions } from "../types/commit-list";

type UseCommitListDataParams = {
  repoPath?: string | null;
  scrollContainerRef: RefObject<HTMLDivElement>;
};

export type CommitWindowLoadOptions = {
  offset?: number;
  anchorSha?: string;
  anchorRowIndex?: number;
  resetScroll?: boolean;
};

export type CommitSearchNavigationResult = CommitHistorySearchResponse & {
  loadedWindowOffset: number | null;
  loadedCommit: CommitListItem | null;
};

const HISTORY_READY_POLL_INTERVAL_MS = 250;
const COMMIT_DETAIL_ROW_CACHE_LIMIT = COMMIT_HISTORY_WINDOW_SIZE * 6;

function getCommitWindowRequestKey({
  anchorRowIndex,
  anchorSha,
  offset,
}: CommitWindowLoadOptions) {
  return `${offset ?? ""}:${anchorSha ?? ""}:${anchorRowIndex ?? ""}`;
}

function waitForNextHistoryPoll() {
  return new Promise((resolve) =>
    window.setTimeout(resolve, HISTORY_READY_POLL_INTERVAL_MS),
  );
}

function mergeCommitDetailCache(
  cachedCommits: Map<number, CommitListItem>,
  commits: CommitListItem[],
  offset: number,
) {
  const nextCachedCommits = new Map(cachedCommits);

  commits.forEach((commit, index) => {
    const rowIndex = offset + index;
    nextCachedCommits.delete(rowIndex);
    nextCachedCommits.set(rowIndex, commit);
  });

  while (nextCachedCommits.size > COMMIT_DETAIL_ROW_CACHE_LIMIT) {
    const oldestKey = nextCachedCommits.keys().next().value;
    if (typeof oldestKey !== "number") break;
    nextCachedCommits.delete(oldestKey);
  }

  return nextCachedCommits;
}

export function useCommitListData({
  repoPath,
  scrollContainerRef,
}: UseCommitListDataParams) {
  const [commits, setCommits] = useState<CommitListItem[]>([]);
  const [cachedCommitsByRowIndex, setCachedCommitsByRowIndex] = useState<
    Map<number, CommitListItem>
  >(() => new Map());
  const [graphRows, setGraphRows] = useState<CommitGraphRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [repositoryState, setRepositoryState] =
    useState<RepositoryState | null>(null);
  const [windowOffset, setWindowOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasPreviousWindow, setHasPreviousWindow] = useState(false);
  const [hasMoreWindow, setHasMoreWindow] = useState(false);
  const [searchResult, setSearchResult] =
    useState<CommitHistorySearchResponse | null>(null);
  const loadRequestIdRef = useRef(0);
  const commitWindowRequestIdRef = useRef(0);
  const commitPrefetchEpochRef = useRef(0);
  const commitPrefetchKeysRef = useRef<Set<string>>(new Set());
  const graphWindowRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  const refreshRepositorySurfaces = useCallback(() => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
  }, []);

  const resetCommits = useCallback(() => {
    commitWindowRequestIdRef.current += 1;
    commitPrefetchEpochRef.current += 1;
    commitPrefetchKeysRef.current.clear();
    graphWindowRequestIdRef.current += 1;
    searchRequestIdRef.current += 1;
    setCommits([]);
    setCachedCommitsByRowIndex(new Map());
    setGraphRows([]);
    setWindowOffset(0);
    setTotalCount(0);
    setHasPreviousWindow(false);
    setHasMoreWindow(false);
    setSearchResult(null);
  }, []);

  const applyWindow = useCallback(
    async ({
      offset,
      anchorSha,
      anchorRowIndex,
      resetScroll = false,
      requestId,
    }: CommitWindowLoadOptions & { requestId: number }) => {
      if (!repoPath) {
        resetCommits();
        return null;
      }

      const windowResult = await getCommitHistoryWindow({
        path: repoPath,
        offset,
        limit: COMMIT_HISTORY_WINDOW_SIZE,
        anchorSha,
        anchorRowIndex,
      });

      if (requestId !== commitWindowRequestIdRef.current) {
        return null;
      }

      setCommits(windowResult.commits);
      setCachedCommitsByRowIndex((currentCache) =>
        mergeCommitDetailCache(
          currentCache,
          windowResult.commits,
          windowResult.offset,
        ),
      );
      setWindowOffset(windowResult.offset);
      setTotalCount(windowResult.totalCount);
      setHasPreviousWindow(windowResult.hasPrevious);
      setHasMoreWindow(windowResult.hasMore);

      if (resetScroll && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }

      return windowResult;
    },
    [repoPath, resetCommits, scrollContainerRef],
  );

  const loadCommits = useCallback(
    async ({
      forceRefresh = false,
      resetScroll = false,
    }: LoadCommitsOptions = {}) => {
      if (!repoPath) {
        loadRequestIdRef.current += 1;
        setLoading(false);
        resetCommits();
        return;
      }

      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      commitWindowRequestIdRef.current += 1;
      commitPrefetchEpochRef.current += 1;
      commitPrefetchKeysRef.current.clear();
      graphWindowRequestIdRef.current += 1;
      searchRequestIdRef.current += 1;
      setLoading(true);
      setError(null);
      setSearchResult(null);

      try {
        let status = await prepareCommitHistory({
          path: repoPath,
          forceRefresh,
        });

        while (
          requestId === loadRequestIdRef.current &&
          status.status === "loading"
        ) {
          await waitForNextHistoryPoll();
          status = await prepareCommitHistory({ path: repoPath });
        }

        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        if (status.status === "error") {
          throw new Error(status.error ?? "Commit history failed to load.");
        }

        if (status.status !== "ready") {
          resetCommits();
          return;
        }

        setTotalCount(status.totalCount);
        const windowRequestId = commitWindowRequestIdRef.current + 1;
        commitWindowRequestIdRef.current = windowRequestId;
        await applyWindow({
          offset: 0,
          resetScroll,
          requestId: windowRequestId,
        });
      } catch (err) {
        if (requestId === loadRequestIdRef.current) {
          setError(err instanceof Error ? err.message : String(err));
          resetCommits();
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [applyWindow, repoPath, resetCommits],
  );

  const loadCommitWindow = useCallback(
    async (options: CommitWindowLoadOptions = {}) => {
      const requestId = commitWindowRequestIdRef.current + 1;
      commitWindowRequestIdRef.current = requestId;
      setError(null);
      try {
        return await applyWindow({ ...options, requestId });
      } catch (err) {
        if (requestId === commitWindowRequestIdRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [applyWindow],
  );

  const prefetchCommitWindow = useCallback(
    async (
      options: CommitWindowLoadOptions = {},
    ): Promise<CommitHistoryWindow | null> => {
      if (!repoPath) return null;

      const requestKey = getCommitWindowRequestKey(options);
      if (commitPrefetchKeysRef.current.has(requestKey)) {
        return null;
      }

      const requestEpoch = commitPrefetchEpochRef.current;
      commitPrefetchKeysRef.current.add(requestKey);

      try {
        const windowResult = await getCommitHistoryWindow({
          path: repoPath,
          offset: options.offset,
          limit: COMMIT_HISTORY_WINDOW_SIZE,
          anchorSha: options.anchorSha,
          anchorRowIndex: options.anchorRowIndex,
        });

        if (requestEpoch !== commitPrefetchEpochRef.current) {
          return null;
        }

        setCachedCommitsByRowIndex((currentCache) =>
          mergeCommitDetailCache(
            currentCache,
            windowResult.commits,
            windowResult.offset,
          ),
        );
        setTotalCount((currentTotal) =>
          currentTotal || windowResult.totalCount,
        );

        return windowResult;
      } catch {
        return null;
      } finally {
        if (requestEpoch === commitPrefetchEpochRef.current) {
          commitPrefetchKeysRef.current.delete(requestKey);
        }
      }
    },
    [repoPath],
  );

  const loadCommitGraphWindow = useCallback(
    async ({ offset = 0, limit = COMMIT_HISTORY_WINDOW_SIZE }) => {
      if (!repoPath) {
        setGraphRows([]);
        return null;
      }

      const requestId = graphWindowRequestIdRef.current + 1;
      graphWindowRequestIdRef.current = requestId;

      try {
        const windowResult = await getCommitGraphWindow({
          path: repoPath,
          offset,
          limit,
        });
        if (requestId !== graphWindowRequestIdRef.current) {
          return null;
        }
        setGraphRows(windowResult.rows);
        return windowResult;
      } catch (err) {
        if (requestId === graphWindowRequestIdRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [repoPath],
  );

  const runCommitSearch = useCallback(
    async ({
      query,
      currentRowIndex,
      direction,
    }: {
      query: string;
      currentRowIndex?: number;
      direction?: "next" | "previous";
    }): Promise<CommitSearchNavigationResult | null> => {
      if (!repoPath) return null;
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;

      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        setSearchResult(null);
        return {
          query,
          matchCount: 0,
          currentMatchPosition: null,
          matchedRowIndex: null,
          matchedSha: null,
          loadedWindowOffset: null,
          loadedCommit: null,
        };
      }

      try {
        const result = await searchCommitHistory({
          path: repoPath,
          query,
          currentRowIndex,
          direction,
        });

        if (requestId !== searchRequestIdRef.current) {
          return null;
        }

        let loadedWindowOffset: number | null = null;
        let loadedCommit: CommitListItem | null = null;

        if (typeof result.matchedRowIndex === "number") {
          const loadedWindow = await loadCommitWindow({
            anchorRowIndex: result.matchedRowIndex,
          });
          if (requestId !== searchRequestIdRef.current) {
            return null;
          }
          loadedWindowOffset = loadedWindow?.offset ?? null;
          loadedCommit =
            loadedWindow?.commits.find(
              (commit) => commit.sha === result.matchedSha,
            ) ?? null;
        }

        setSearchResult(result);

        return {
          ...result,
          loadedWindowOffset,
          loadedCommit,
        };
      } catch {
        if (requestId === searchRequestIdRef.current) {
          setSearchResult(null);
        }
        return null;
      }
    },
    [loadCommitWindow, repoPath],
  );

  useEffect(() => {
    if (!repoPath) {
      setRemoteUrl(null);
      return;
    }

    let cancelled = false;
    getRemoteUrl(repoPath, "origin")
      .then((nextRemoteUrl) => {
        if (!cancelled) setRemoteUrl(nextRemoteUrl);
      })
      .catch(() => {
        if (!cancelled) setRemoteUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [repoPath]);

  useEffect(() => {
    if (!repoPath) {
      setRepositoryState(null);
      return;
    }

    let cancelled = false;
    setRepositoryState(null);

    const refreshRepositoryState = async () => {
      try {
        const nextState = await getRepositoryState(repoPath);
        if (!cancelled) setRepositoryState(nextState);
      } catch {
        if (!cancelled) setRepositoryState(null);
      }
    };

    void refreshRepositoryState();

    const handleRepoRefsRefresh = () => {
      void refreshRepositoryState();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(
        APP_EVENTS.repoRefsRefresh,
        handleRepoRefsRefresh,
      );
    };
  }, [repoPath]);

  useEffect(() => {
    if (!repoPath) {
      return;
    }

    const handleCommitRefresh = () => {
      void loadCommits({ forceRefresh: true });
    };

    window.addEventListener(APP_EVENTS.commitsRefresh, handleCommitRefresh);

    return () => {
      window.removeEventListener(
        APP_EVENTS.commitsRefresh,
        handleCommitRefresh,
      );
    };
  }, [loadCommits, repoPath]);

  return {
    commits,
    cachedCommitsByRowIndex,
    error,
    graphRows,
    hasMoreWindow,
    hasPreviousWindow,
    loadCommits,
    loadCommitGraphWindow,
    loadCommitWindow,
    loading,
    prefetchCommitWindow,
    remoteUrl,
    repositoryState,
    refreshRepositorySurfaces,
    resetCommits,
    runCommitSearch,
    searchResult,
    totalCount,
    windowOffset,
  };
}
