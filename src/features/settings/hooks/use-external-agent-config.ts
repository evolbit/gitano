import { useCallback, useEffect, useState } from "react";
import {
  getExternalAiAgentSessionConfig,
  type ExternalAiAgentSessionConfig,
} from "@/shared/api/local-ai";
import {
  errorMessage,
  removeRecordEntry,
} from "../components/settings-window/utils";

export function useExternalAgentConfig({
  repoPath,
  enabled,
  selectedExternalAgentIds,
  resetKey,
}: {
  repoPath?: string | null;
  enabled: boolean;
  selectedExternalAgentIds: string[];
  resetKey: number;
}) {
  const [externalConfigByAgentId, setExternalConfigByAgentId] = useState<
    Record<string, ExternalAiAgentSessionConfig | null>
  >({});
  const [externalConfigLoadingByAgentId, setExternalConfigLoadingByAgentId] =
    useState<Record<string, boolean>>({});
  const [externalConfigErrorsByAgentId, setExternalConfigErrorsByAgentId] =
    useState<Record<string, string>>({});

  const loadExternalAgentConfig = useCallback(
    async (agentId: string) => {
      if (
        externalConfigByAgentId[agentId] ||
        externalConfigLoadingByAgentId[agentId] ||
        externalConfigErrorsByAgentId[agentId]
      ) {
        return;
      }

      setExternalConfigLoadingByAgentId((current) => ({
        ...current,
        [agentId]: true,
      }));
      setExternalConfigErrorsByAgentId((current) =>
        removeRecordEntry(current, agentId),
      );

      try {
        const config = await getExternalAiAgentSessionConfig({
          agentId,
          repoPath: repoPath ?? null,
        });
        setExternalConfigByAgentId((current) => ({
          ...current,
          [agentId]: config,
        }));
      } catch (configError) {
        setExternalConfigErrorsByAgentId((current) => ({
          ...current,
          [agentId]: errorMessage(configError, "Agent config unavailable"),
        }));
      } finally {
        setExternalConfigLoadingByAgentId((current) =>
          removeRecordEntry(current, agentId),
        );
      }
    },
    [
      externalConfigByAgentId,
      externalConfigErrorsByAgentId,
      externalConfigLoadingByAgentId,
      repoPath,
    ],
  );

  useEffect(() => {
    setExternalConfigByAgentId({});
    setExternalConfigLoadingByAgentId({});
    setExternalConfigErrorsByAgentId({});
  }, [repoPath, resetKey]);

  useEffect(() => {
    if (!enabled) return;
    selectedExternalAgentIds.forEach((agentId) => {
      void loadExternalAgentConfig(agentId);
    });
  }, [enabled, loadExternalAgentConfig, selectedExternalAgentIds]);

  return {
    externalConfigByAgentId,
    externalConfigLoadingByAgentId,
    externalConfigErrorsByAgentId,
    loadExternalAgentConfig,
  };
}
