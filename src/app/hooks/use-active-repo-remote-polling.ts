import { useEffect, useRef } from "react";
import { fetchAllRemotes, hasRemoteRefUpdates } from "@/shared/api/git/sync";
import { APP_EVENTS } from "@/shared/config/events";
import type { GitFetchMode } from "@/shared/types/git";
import {
  useGitActionsStore,
  useRepoStore,
  useWorkspaceUiStore,
} from "@/features/repository-workspace";

export const ACTIVE_REPO_REMOTE_POLL_INITIAL_DELAY_MS = 2_000;
export const ACTIVE_REPO_REMOTE_POLL_INTERVAL_MS = 15_000;

function dispatchRefreshEvents() {
  window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
  window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
}

function fetchModeFromPullStrategy(pullStrategy: string): GitFetchMode {
  return pullStrategy === "fetch-all-prune" ? "fetch-all-prune" : "fetch-all";
}

export function useActiveRepoRemotePolling() {
  const activeTabId = useRepoStore((state) => state.activeTabId);
  const activeRepoPath = useRepoStore(
    (state) =>
      state.tabs.find((tab) => tab.id === activeTabId)?.repoPath || null,
  );
  const pendingGitAction = useGitActionsStore((state) => state.pendingAction);
  const pullStrategy = useWorkspaceUiStore((state) => state.pullStrategy);
  const pendingGitActionRef = useRef(pendingGitAction);
  const pullStrategyRef = useRef(pullStrategy);

  useEffect(() => {
    pendingGitActionRef.current = pendingGitAction;
  }, [pendingGitAction]);

  useEffect(() => {
    pullStrategyRef.current = pullStrategy;
  }, [pullStrategy]);

  useEffect(() => {
    if (!activeRepoPath) return;

    let cancelled = false;
    let inFlight = false;
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;

    const scheduleNextPoll = (delayMs: number) => {
      timeoutId = window.setTimeout(() => {
        void pollRemoteRefs();
      }, delayMs);
    };

    const pollRemoteRefs = async () => {
      if (cancelled) return;

      if (pendingGitActionRef.current || inFlight) {
        scheduleNextPoll(ACTIVE_REPO_REMOTE_POLL_INTERVAL_MS);
        return;
      }

      inFlight = true;
      try {
        const hasUpdates = await hasRemoteRefUpdates(activeRepoPath);
        if (!hasUpdates || cancelled || pendingGitActionRef.current) return;

        await fetchAllRemotes(
          activeRepoPath,
          fetchModeFromPullStrategy(pullStrategyRef.current),
        );

        if (!cancelled) {
          dispatchRefreshEvents();
        }
      } catch {
        // Background polling should not interrupt foreground Git workflows.
      } finally {
        inFlight = false;
        if (!cancelled) {
          scheduleNextPoll(ACTIVE_REPO_REMOTE_POLL_INTERVAL_MS);
        }
      }
    };

    scheduleNextPoll(ACTIVE_REPO_REMOTE_POLL_INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeRepoPath]);
}
