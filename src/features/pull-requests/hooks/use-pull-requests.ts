import { useCallback, useEffect, useState } from "react";
import {
  listGitHubPullRequests,
  listProviderIntegrations,
  type GitHubPullRequestListItem,
} from "@/shared/api/integrations";

export type PullRequestAvailability =
  | "unknown"
  | "ready"
  | "disconnected"
  | "unavailable"
  | "error";

function classifyPullRequestError(error: unknown): PullRequestAvailability {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GitHub is not connected")) return "disconnected";
  if (message.includes("does not resolve to a GitHub repository")) {
    return "unavailable";
  }
  return "error";
}

async function hasConnectedGitHubProvider() {
  const providers = await listProviderIntegrations();
  return providers.some(
    (provider) => provider.id === "github" && provider.status === "connected",
  );
}

export function usePullRequests({
  open,
  repoPath,
}: {
  open: boolean;
  repoPath: string | null | undefined;
}) {
  const [pullRequests, setPullRequests] = useState<GitHubPullRequestListItem[]>(
    [],
  );
  const [availability, setAvailability] =
    useState<PullRequestAvailability>("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPullRequests = useCallback(async () => {
    if (!open || !repoPath) {
      setPullRequests([]);
      setAvailability("unknown");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const connected = await hasConnectedGitHubProvider();
      if (!connected) {
        setPullRequests([]);
        setAvailability("disconnected");
        return;
      }

      const nextPullRequests = await listGitHubPullRequests({ path: repoPath });
      setPullRequests(nextPullRequests);
      setAvailability("ready");
    } catch (loadError) {
      setPullRequests([]);
      setAvailability(classifyPullRequestError(loadError));
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [open, repoPath]);

  useEffect(() => {
    void loadPullRequests();
  }, [loadPullRequests]);

  return {
    availability,
    error,
    loading,
    pullRequests,
    refresh: loadPullRequests,
  };
}
