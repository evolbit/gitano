import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  getCommitsListPaginated,
  getRemoteUrl,
} from "@/shared/api/git/commits";
import { getRepositoryState } from "@/shared/api/repositories";
import { APP_EVENTS } from "@/shared/config/events";
import type { CommitListItem, RepositoryState } from "@/shared/types/git";
import { FULL_LOG_COMMIT_LIMIT } from "../components/commit-list/constants";
import type { LoadCommitsOptions } from "../types/commit-list";

type UseCommitListDataParams = {
  repoPath?: string | null;
  scrollContainerRef: RefObject<HTMLDivElement>;
};

export function useCommitListData({
  repoPath,
  scrollContainerRef,
}: UseCommitListDataParams) {
  const [commits, setCommits] = useState<CommitListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [repositoryState, setRepositoryState] =
    useState<RepositoryState | null>(null);
  const loadRequestIdRef = useRef(0);

  const refreshRepositorySurfaces = useCallback(() => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
  }, []);

  const resetCommits = useCallback(() => {
    setCommits([]);
  }, []);

  const loadCommits = useCallback(
    async ({
      forceRefresh = false,
      resetScroll = false,
    }: LoadCommitsOptions = {}) => {
      if (!repoPath) {
        loadRequestIdRef.current += 1;
        setLoading(false);
        return;
      }

      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      setLoading(true);
      setError(null);

      try {
        const result = await getCommitsListPaginated({
          path: repoPath,
          offset: 0,
          limit: FULL_LOG_COMMIT_LIMIT,
          forceRefresh,
        });

        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        setCommits(result.commits || []);

        if (result.has_more) {
          setError(
            `Commit history truncated after ${FULL_LOG_COMMIT_LIMIT.toLocaleString()} commits. Increase FULL_LOG_COMMIT_LIMIT if needed.`,
          );
        }
        if (resetScroll && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      } catch (err) {
        if (requestId === loadRequestIdRef.current) {
          setError(String(err));
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [repoPath, scrollContainerRef],
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
    error,
    loadCommits,
    loading,
    remoteUrl,
    repositoryState,
    refreshRepositorySurfaces,
    resetCommits,
  };
}
