import { useCallback, useEffect, useMemo, useState } from "react";
import { getProviderPullRequestCount } from "@/shared/api/integrations";

const PULL_REQUEST_COUNT_REFRESH_MS = 60_000;

type CachedPullRequestCount = {
  count: number;
  loadedAt: number;
};

const countCache = new Map<string, CachedPullRequestCount>();

function cacheKey(repoPath: string) {
  return repoPath;
}

export function usePullRequestCount(repoPath: string | null | undefined) {
  const key = useMemo(() => (repoPath ? cacheKey(repoPath) : null), [repoPath]);
  const cached = key ? countCache.get(key) : null;
  const [count, setCount] = useState<number | null>(cached?.count ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    const nextCached = key ? countCache.get(key) : null;
    setCount(nextCached?.count ?? null);
    setError(null);
    setEligible(false);
  }, [key]);

  const refresh = useCallback(async () => {
    if (!repoPath || !key) return;

    setLoading(true);
    try {
      const result = await getProviderPullRequestCount({
        providerId: "github",
        path: repoPath,
      });
      countCache.set(key, { count: result.count, loadedAt: Date.now() });
      setCount(result.count);
      setError(null);
      setEligible(true);
    } catch (refreshError) {
      setEligible(false);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : String(refreshError),
      );
    } finally {
      setLoading(false);
    }
  }, [key, repoPath]);

  useEffect(() => {
    if (!repoPath) return;

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, PULL_REQUEST_COUNT_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [refresh, repoPath]);

  return {
    count,
    loading,
    error,
    eligible,
    refresh,
  };
}
