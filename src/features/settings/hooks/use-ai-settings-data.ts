import { useCallback, useEffect, useState } from "react";
import {
  getExternalAiAgentCatalog,
  getLocalAiEntitlementStatus,
  getLocalAiMachineProfile,
  getLocalAiModelCatalog,
  getLocalAiModelPreferences,
  getLocalAiModelStatus,
  getLocalAiRuntimeStatus,
  type ExternalAiAgentEntry,
  type LocalAiEntitlementStatus,
  type LocalAiMachineProfile,
  type LocalAiModelEntry,
  type LocalAiModelStatus,
  type LocalAiPreferences,
  type LocalAiRuntimeSetupStatus,
} from "@/shared/api/local-ai";
import {
  errorMessage,
  promptDraftsFromPreferences,
} from "../components/settings-window/utils";

export function useAiSettingsData(open: boolean) {
  const [catalog, setCatalog] = useState<LocalAiModelEntry[]>([]);
  const [externalAgents, setExternalAgents] = useState<ExternalAiAgentEntry[]>([]);
  const [preferences, setPreferences] = useState<LocalAiPreferences | null>(null);
  const [entitlement, setEntitlement] =
    useState<LocalAiEntitlementStatus | null>(null);
  const [runtimeStatus, setRuntimeStatus] =
    useState<LocalAiRuntimeSetupStatus | null>(null);
  const [machineProfile, setMachineProfile] =
    useState<LocalAiMachineProfile | null>(null);
  const [modelStatuses, setModelStatuses] = useState<
    Record<string, LocalAiModelStatus | null>
  >({});
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const showSettingsError = useCallback((fallback: string, error: unknown) => {
    setSettingsError(errorMessage(error, fallback));
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setSettingsError(null);
    try {
      const [
        nextCatalog,
        nextExternalAgents,
        nextPreferences,
        nextEntitlement,
        nextRuntimeStatus,
        nextMachineProfile,
      ] =
        await Promise.all([
          getLocalAiModelCatalog(),
          getExternalAiAgentCatalog(),
          getLocalAiModelPreferences(),
          getLocalAiEntitlementStatus(),
          getLocalAiRuntimeStatus(),
          getLocalAiMachineProfile(),
        ]);
      const statusEntries = await Promise.all(
        nextCatalog.map(async (model) => {
          try {
            const status = await getLocalAiModelStatus(model.id);
            return [model.id, status] as const;
          } catch {
            return [model.id, null] as const;
          }
        }),
      );

      setCatalog(nextCatalog);
      setExternalAgents(nextExternalAgents);
      setPreferences(nextPreferences);
      setPromptDrafts(promptDraftsFromPreferences(nextPreferences));
      setEntitlement(nextEntitlement);
      setRuntimeStatus(nextRuntimeStatus);
      setMachineProfile(nextMachineProfile);
      setModelStatuses(Object.fromEntries(statusEntries));
      setSettingsRevision((current) => current + 1);
    } catch (loadError) {
      showSettingsError("AI settings failed", loadError);
    } finally {
      setLoading(false);
    }
  }, [showSettingsError]);

  useEffect(() => {
    if (!open) return;
    void loadSettings();
  }, [loadSettings, open]);

  return {
    catalog,
    externalAgents,
    preferences,
    setPreferences,
    entitlement,
    runtimeStatus,
    machineProfile,
    modelStatuses,
    settingsError,
    setSettingsError,
    showSettingsError,
    promptDrafts,
    setPromptDrafts,
    loading,
    loadSettings,
    settingsRevision,
  };
}
