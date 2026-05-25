import { useCallback, useEffect, useState } from "react";
import {
  completeGitHubOAuthIntegration,
  disconnectProviderIntegration,
  listProviderIntegrations,
  startGitHubOAuthIntegration,
  verifyProviderIntegration,
  type GitHubOAuthStartResponse,
  type ProviderIntegration,
} from "@/shared/api/integrations";

function replaceProvider(
  providers: ProviderIntegration[],
  provider: ProviderIntegration,
) {
  return providers.map((current) =>
    current.id === provider.id ? provider : current,
  );
}

type CompleteGitHubOAuthOptions = {
  silent?: boolean;
};

export function useProviderIntegrations(enabled: boolean) {
  const [providers, setProviders] = useState<ProviderIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyProviderIds, setBusyProviderIds] = useState<Record<string, boolean>>(
    {},
  );

  const loadProviders = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);
    try {
      setProviders(await listProviderIntegrations());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const setProviderBusy = useCallback((providerId: string, busy: boolean) => {
    setBusyProviderIds((current) => {
      const next = { ...current };
      if (busy) {
        next[providerId] = true;
      } else {
        delete next[providerId];
      }
      return next;
    });
  }, []);

  const startGitHubOAuth = useCallback(
    async (): Promise<GitHubOAuthStartResponse> => {
      setProviderBusy("github", true);
      setError(null);
      try {
        return await startGitHubOAuthIntegration();
      } catch (startError) {
        setError(
          startError instanceof Error ? startError.message : String(startError),
        );
        throw startError;
      } finally {
        setProviderBusy("github", false);
      }
    },
    [setProviderBusy],
  );

  const completeGitHubOAuth = useCallback(
    async (deviceCode: string, options?: CompleteGitHubOAuthOptions) => {
      if (!options?.silent) {
        setProviderBusy("github", true);
      }
      try {
        const provider = await completeGitHubOAuthIntegration({ deviceCode });
        setProviders((current) => replaceProvider(current, provider));
        setError(null);
      } catch (completeError) {
        throw completeError;
      } finally {
        if (!options?.silent) {
          setProviderBusy("github", false);
        }
      }
    },
    [setProviderBusy],
  );

  const verifyProvider = useCallback(
    async (providerId: string) => {
      setProviderBusy(providerId, true);
      setError(null);
      try {
        const provider = await verifyProviderIntegration(providerId);
        setProviders((current) => replaceProvider(current, provider));
      } catch (verifyError) {
        setError(
          verifyError instanceof Error ? verifyError.message : String(verifyError),
        );
        throw verifyError;
      } finally {
        setProviderBusy(providerId, false);
      }
    },
    [setProviderBusy],
  );

  const disconnectProvider = useCallback(
    async (providerId: string) => {
      setProviderBusy(providerId, true);
      setError(null);
      try {
        const provider = await disconnectProviderIntegration(providerId);
        setProviders((current) => replaceProvider(current, provider));
      } catch (disconnectError) {
        setError(
          disconnectError instanceof Error
            ? disconnectError.message
            : String(disconnectError),
        );
        throw disconnectError;
      } finally {
        setProviderBusy(providerId, false);
      }
    },
    [setProviderBusy],
  );

  return {
    providers,
    loading,
    error,
    busyProviderIds,
    completeGitHubOAuth,
    disconnectProvider,
    loadProviders,
    startGitHubOAuth,
    verifyProvider,
  };
}
