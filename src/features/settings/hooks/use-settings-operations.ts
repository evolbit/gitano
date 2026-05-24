import { useState } from "react";
import {
  listenToExternalAiAgentProgress,
  listenToLocalAiProgress,
  type ExternalAiAgentProgress,
  type LocalAiDownloadProgress,
} from "@/shared/api/local-ai";
import { useSettingsProgressListener } from "./use-settings-progress-listener";

export function useSettingsOperations(
  open: boolean,
  loadSettings: () => Promise<void>,
) {
  const [progressByOperationId, setProgressByOperationId] = useState<
    Record<string, LocalAiDownloadProgress>
  >({});
  const [externalProgressByOperationId, setExternalProgressByOperationId] =
    useState<Record<string, ExternalAiAgentProgress>>({});
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const [activeExternalOperationId, setActiveExternalOperationId] =
    useState<string | null>(null);

  useSettingsProgressListener({
    open,
    listen: listenToLocalAiProgress,
    setProgressByOperationId,
    loadSettings,
  });

  useSettingsProgressListener({
    open,
    listen: listenToExternalAiAgentProgress,
    setProgressByOperationId: setExternalProgressByOperationId,
    loadSettings,
  });

  const activeProgress = activeOperationId
    ? progressByOperationId[activeOperationId]
    : null;
  const activeExternalProgress = activeExternalOperationId
    ? externalProgressByOperationId[activeExternalOperationId]
    : null;
  const setupInProgress =
    (!!activeProgress &&
      activeProgress.state !== "completed" &&
      activeProgress.state !== "failed") ||
    (!!activeExternalProgress &&
      activeExternalProgress.state !== "completed" &&
      activeExternalProgress.state !== "failed");

  return {
    progressByOperationId,
    setProgressByOperationId,
    externalProgressByOperationId,
    setExternalProgressByOperationId,
    activeOperationId,
    setActiveOperationId,
    activeExternalOperationId,
    setActiveExternalOperationId,
    activeProgress,
    activeExternalProgress,
    setupInProgress,
  };
}
