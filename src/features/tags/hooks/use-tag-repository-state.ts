import { useEffect, useState } from "react";
import { getRepositoryState } from "@/shared/api/repositories";
import { APP_EVENTS } from "@/shared/config/events";
import type { RepositoryState } from "@/shared/types/git";

export function useTagRepositoryState(repoPath: string) {
  const [repositoryState, setRepositoryState] =
    useState<RepositoryState | null>(null);
  const requiresInitialCommit = repositoryState?.hasCommits === false;

  useEffect(() => {
    let cancelled = false;

    const refreshRepositoryState = async () => {
      try {
        const nextState = await getRepositoryState(repoPath);
        if (!cancelled) {
          setRepositoryState(nextState);
        }
      } catch {
        if (!cancelled) {
          setRepositoryState(null);
        }
      }
    };

    void refreshRepositoryState();

    const handleRepoRefsRefresh = () => {
      void refreshRepositoryState();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    };
  }, [repoPath]);

  return { requiresInitialCommit };
}
