import { useCallback, useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  listProviderPullRequests,
  type PullRequestListItem,
} from "@/shared/api/integrations";

const PULL_REQUESTS_STALE_MS = 30_000;

export function pullRequestsQueryKey(repoPath: string | null | undefined) {
  return ["provider-pull-requests", "github", repoPath ?? null] as const;
}

function loadProviderPullRequests(repoPath: string) {
  return listProviderPullRequests({
    providerId: "github",
    path: repoPath,
  });
}

export function prefetchPullRequests(
  queryClient: QueryClient,
  repoPath: string | null | undefined,
) {
  if (!repoPath) return Promise.resolve();

  return queryClient.prefetchQuery({
    queryKey: pullRequestsQueryKey(repoPath),
    queryFn: () => loadProviderPullRequests(repoPath),
    staleTime: PULL_REQUESTS_STALE_MS,
  });
}

export type PullRequestAvailability =
  | "unknown"
  | "ready"
  | "disconnected"
  | "unavailable"
  | "error";

function classifyPullRequestError(error: unknown): PullRequestAvailability {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GitHub is not connected")) return "disconnected";
  if (
    message.includes("GitHub CLI is not installed") ||
    message.includes("GitHub CLI is installed but is not authenticated") ||
    message.includes("gh auth login")
  ) {
    return "disconnected";
  }
  if (message.includes("does not resolve to a GitHub repository")) {
    return "unavailable";
  }
  return "error";
}

export function usePullRequests({
  open,
  repoPath,
}: {
  open: boolean;
  repoPath: string | null | undefined;
}) {
  const query = useQuery({
    queryKey: pullRequestsQueryKey(repoPath),
    queryFn: () => {
      if (!repoPath) return Promise.resolve<PullRequestListItem[]>([]);

      return loadProviderPullRequests(repoPath);
    },
    enabled: open && Boolean(repoPath),
    staleTime: PULL_REQUESTS_STALE_MS,
  });

  const error = useMemo(() => {
    if (!query.error) return null;

    return query.error instanceof Error
      ? query.error.message
      : String(query.error);
  }, [query.error]);
  const availability = useMemo<PullRequestAvailability>(() => {
    if (!open || !repoPath) return "unknown";
    if (query.data) return "ready";
    if (query.error) return classifyPullRequestError(query.error);

    return "unknown";
  }, [open, query.data, query.error, repoPath]);
  const { refetch } = query;
  const refresh = useCallback(async () => {
    await refetch({ throwOnError: false });
  }, [refetch]);

  return {
    availability,
    error,
    loading: query.isLoading,
    pullRequests: query.data ?? [],
    refresh,
    refreshing: query.isRefetching,
  };
}
