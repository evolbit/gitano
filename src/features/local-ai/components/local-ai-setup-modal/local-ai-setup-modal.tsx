import ReactDOM from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCloudDownload, IconX } from "@/shared/components/icons/icons";
import type {
  AnalysisEngine,
  ExternalAiAgentEntry,
  LocalAiActionKind,
  LocalAiModelEntry,
} from "@/shared/api/local-ai";
import { externalAiAgentStatusLabel } from "@/shared/utils/external-ai-agent-status";
import { useLocalAiStore } from "../../stores/local-ai-store";

type LocalAiSetupModalProps = {
  open: boolean;
  actionKind?: LocalAiActionKind | null;
  setupReason?: string | null;
  onClose: () => void;
  onReady?: () => void;
};

function formatGb(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}GB` : "unknown";
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number") return null;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

function isModelSuitableForAction(
  model: LocalAiModelEntry,
  actionKind?: LocalAiActionKind | null,
) {
  return !actionKind || model.actionSuitability.includes(actionKind);
}

function localEngineValue(modelId: string) {
  return `local:${modelId}`;
}

function externalEngineValue(agentId: string) {
  return `external:${agentId}`;
}

function engineValue(engine: AnalysisEngine | null | undefined) {
  if (!engine) return "";
  if (engine.type === "external_agent") return externalEngineValue(engine.agentId);
  return engine.modelId ? localEngineValue(engine.modelId) : "";
}

function engineFromValue(value: string): AnalysisEngine | null {
  if (value.startsWith("external:")) {
    const agentId = value.slice("external:".length);
    return agentId ? { type: "external_agent", agentId } : null;
  }
  if (value.startsWith("local:")) {
    const modelId = value.slice("local:".length);
    return modelId ? { type: "local_model", modelId } : null;
  }

  return null;
}

function firstReadyAgent(agents: ExternalAiAgentEntry[]) {
  return agents.find((agent) => agent.status.available) ?? null;
}

export function LocalAiSetupModal({
  open,
  actionKind,
  setupReason,
  onClose,
  onReady,
}: LocalAiSetupModalProps) {
  const {
    catalog,
    externalAgents,
    entitlement,
    preferences,
    modelStatus,
    compatibility,
    activeOperationId,
    progressByOperationId,
    progressTimelineByOperationId,
    loading,
    error,
    loadSetupState,
    setPreference,
    setAnalysisEnginePreference,
    prepareSelectedModel,
  } = useLocalAiStore();
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedEngineValue, setSelectedEngineValue] = useState<string>("");
  const [allowLimited, setAllowLimited] = useState(false);
  const setupStartedRef = useRef(false);
  const readyHandlingRef = useRef(false);
  const selectableCatalog = useMemo(() => {
    const suitableModels = catalog.filter((model) =>
      isModelSuitableForAction(model, actionKind),
    );
    return suitableModels.length ? suitableModels : catalog;
  }, [actionKind, catalog]);

  useEffect(() => {
    if (!open) {
      setupStartedRef.current = false;
      readyHandlingRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadSetupState();
  }, [loadSetupState, open]);

  useEffect(() => {
    if (!open || !preferences) return;
    const actionEngine = actionKind
      ? preferences.actionEngines?.[actionKind]
      : null;
    const globalEngine = preferences.analysisEngine;
    const readyAgent = firstReadyAgent(externalAgents);
    const setupNeedsEngineSelection =
      setupReason?.toLowerCase().includes("no ai model selected") ||
      setupReason?.toLowerCase().includes("no ai models available");
    const preferredEngine =
      actionEngine && engineValue(actionEngine)
        ? actionEngine
        : readyAgent && setupNeedsEngineSelection
          ? ({ type: "external_agent", agentId: readyAgent.id } satisfies AnalysisEngine)
        : globalEngine && engineValue(globalEngine)
          ? globalEngine
          : readyAgent
            ? ({ type: "external_agent", agentId: readyAgent.id } satisfies AnalysisEngine)
            : null;
    const preferredModelIds = [
      preferredEngine?.type === "local_model" ? preferredEngine.modelId : null,
      actionKind ? preferences.actionModelIds[actionKind] : null,
      preferences.globalModelId,
    ];
    const nextModelId =
      preferredModelIds.find(
        (modelId) =>
          !!modelId &&
          selectableCatalog.some((model) => model.id === modelId),
      ) ||
      selectableCatalog[0]?.id ||
      catalog[0]?.id ||
      "";
    setSelectedModelId(nextModelId);
    setSelectedEngineValue(
      preferredEngine?.type === "external_agent"
        ? externalEngineValue(preferredEngine.agentId)
        : nextModelId
          ? localEngineValue(nextModelId)
          : "",
    );
  }, [
    actionKind,
    catalog,
    externalAgents,
    open,
    preferences,
    selectableCatalog,
    setupReason,
  ]);

  useEffect(() => {
    if (!open || !selectedModelId || !selectedEngineValue.startsWith("local:")) {
      return;
    }
    void loadSetupState(selectedModelId);
  }, [loadSetupState, open, selectedEngineValue, selectedModelId]);

  const selectedEngine = engineFromValue(selectedEngineValue);
  const selectedModel = useMemo(
    () =>
      selectableCatalog.find((model) => model.id === selectedModelId) ??
      catalog.find((model) => model.id === selectedModelId) ??
      null,
    [catalog, selectableCatalog, selectedModelId],
  );
  const selectedAgent =
    selectedEngine?.type === "external_agent"
      ? externalAgents.find((agent) => agent.id === selectedEngine.agentId) ?? null
      : null;
  const activeProgress = activeOperationId
    ? progressByOperationId[activeOperationId]
    : null;
  const activeProgressTimeline = activeOperationId
    ? (progressTimelineByOperationId[activeOperationId] ?? [])
    : [];
  const previousProgressSteps = activeProgressTimeline.slice(0, -1);
  const setupInProgress =
    !!activeProgress &&
    activeProgress.state !== "completed" &&
    activeProgress.state !== "failed";
  const isExternalEngine = selectedEngine?.type === "external_agent";
  const isReady = modelStatus?.ready && modelStatus.modelId === selectedModelId;
  const runtimeUnavailable =
    modelStatus?.runtime.available === false ||
    compatibility?.level === "runtimeUnavailable";
  const setupModelId =
    selectedModelId || preferences?.globalModelId || modelStatus?.modelId || "";
  const canPrepare =
    !isExternalEngine &&
    !!selectedModelId &&
    entitlement?.entitled &&
    !loading &&
    !setupInProgress &&
    !compatibility?.blocking &&
    (compatibility?.level === "compatible" || allowLimited);
  const downloadButtonLabel = runtimeUnavailable
    ? "Download local AI"
    : "Download model";
  const showCompatibilityWarning =
    !!compatibility && compatibility.level !== "compatible";
  const selectedActionModelId = actionKind
    ? preferences?.actionModelIds[actionKind]
    : null;
  const selectedActionEngine = actionKind
    ? preferences?.actionEngines?.[actionKind]
    : null;
  const saveSelectedModelForAction = useCallback(async () => {
    if (!actionKind || !selectedModelId) return true;
    if (selectedActionModelId === selectedModelId) return true;

    await setPreference(selectedModelId, actionKind);
    return (
      useLocalAiStore.getState().preferences?.actionModelIds?.[actionKind] ===
      selectedModelId
    );
  }, [actionKind, selectedActionModelId, selectedModelId, setPreference]);
  const saveSelectedEngineForAction = useCallback(async () => {
    if (selectedEngine?.type === "external_agent") {
      if (
        actionKind &&
        selectedActionEngine?.type === "external_agent" &&
        selectedActionEngine.agentId === selectedEngine.agentId
      ) {
        return true;
      }

      await setAnalysisEnginePreference(selectedEngine, actionKind ?? null);
      const preferences = useLocalAiStore.getState().preferences;
      const savedEngine = actionKind
        ? preferences?.actionEngines?.[actionKind]
        : preferences?.analysisEngine;

      return (
        savedEngine?.type === "external_agent" &&
        savedEngine.agentId === selectedEngine.agentId
      );
    }

    return saveSelectedModelForAction();
  }, [
    actionKind,
    saveSelectedModelForAction,
    selectedActionEngine,
    selectedEngine,
    setAnalysisEnginePreference,
  ]);
  const handleReady = useCallback(async () => {
    if (readyHandlingRef.current) return;
    readyHandlingRef.current = true;
    const saved = await saveSelectedEngineForAction();
    if (!saved) {
      readyHandlingRef.current = false;
      return;
    }

    setupStartedRef.current = false;
    onReady?.();
    onClose();
    readyHandlingRef.current = false;
  }, [onClose, onReady, saveSelectedEngineForAction]);

  useEffect(() => {
    if (
      !open ||
      !setupStartedRef.current ||
      !activeOperationId ||
      activeProgress?.state !== "completed" ||
      activeProgress.modelId !== selectedModelId ||
      !isReady
    ) {
      return;
    }

    void handleReady();
  }, [
    activeOperationId,
    activeProgress?.modelId,
    activeProgress?.state,
    handleReady,
    isReady,
    open,
    selectedModelId,
  ]);

  if (!open) return null;

  const selectedAgentReady = Boolean(isExternalEngine && selectedAgent?.status.available);
  const readyButtonVisible = Boolean(isReady || selectedAgentReady);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10050]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-10 flex max-h-[88vh] w-[min(720px,94vw)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-normal text-muted-foreground">
              AI
            </div>
            <div className="text-base font-semibold text-foreground">
              Analysis engine setup
            </div>
          </div>
          <button
            type="button"
            className="rounded p-2 text-muted-foreground hover:bg-zinc-800 hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-sm text-zinc-200">
          {loading && !selectedModel ? (
            <div className="rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-300">
              Checking local AI setup...
            </div>
          ) : null}

          {setupReason ? (
            <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs leading-5 text-blue-100">
              {setupReason}
            </div>
          ) : null}

          {entitlement && !entitlement.entitled ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100">
              {entitlement.reason ?? "Local AI requires a premium license."}
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-300">
              Analysis engine
            </span>
            <select
              value={selectedEngineValue}
              disabled={loading || entitlement?.entitled === false}
              className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
              onChange={(event) => {
                const value = event.target.value;
                const engine = engineFromValue(value);
                setSelectedEngineValue(value);
                setAllowLimited(false);
                if (engine?.type === "local_model" && engine.modelId) {
                  setSelectedModelId(engine.modelId);
                  void setPreference(engine.modelId, actionKind ?? null);
                }
              }}
            >
              <optgroup label="Local models">
                {selectableCatalog.map((model) => (
                  <option
                    key={model.id}
                    value={localEngineValue(model.id)}
                  >
                    {model.displayName} · {model.downloadSizeGb.toFixed(1)}GB ·{" "}
                    {model.qualityTier}
                  </option>
                ))}
              </optgroup>
              <optgroup label="External agents">
                {externalAgents.map((agent) => (
                  <option
                    key={agent.id}
                    value={externalEngineValue(agent.id)}
                    disabled={!agent.status.available}
                  >
                    {agent.displayName}
                    {agent.status.available ? "" : " · not ready"}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          {selectedAgent ? (
            <div className="space-y-3 rounded border border-border bg-background-emphasis p-3 text-xs text-zinc-300">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-zinc-500">Provider</div>
                  <div className="font-medium text-zinc-100">
                    {selectedAgent.provider}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Version</div>
                  <div className="font-medium text-zinc-100">
                    {selectedAgent.status.version ?? selectedAgent.version}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Status</div>
                  <div className="font-medium text-zinc-100">
                    {externalAiAgentStatusLabel(selectedAgent)}
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-zinc-400">
                External agents run through the user's local agent installation
                and account. Repository context is handled by the selected
                agent, not by Gitano's local Ollama runtime.
              </p>
              {selectedAgent.status.error ? (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100">
                  {selectedAgent.status.error}
                </div>
              ) : null}
            </div>
          ) : selectedModel ? (
            <div className="space-y-3 rounded border border-border bg-background-emphasis p-3 text-xs text-zinc-300">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-zinc-500">Download</div>
                  <div className="font-medium text-zinc-100">
                    {selectedModel.downloadSizeGb.toFixed(1)}GB
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Context</div>
                  <div className="font-medium text-zinc-100">
                    {selectedModel.contextWindow.toLocaleString()} tokens
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Installed</div>
                  <div className="font-medium text-zinc-100">
                    {modelStatus?.installed
                      ? `${formatBytes(modelStatus.sizeBytes) ?? "installed"}`
                      : "Not installed"}
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-zinc-400">
                Model files are stored inside Gitano's local AI data folder
                when Gitano manages the runtime. Set OLLAMA_HOST only for
                development against an external Ollama service.
              </p>
            </div>
          ) : null}

          {!isExternalEngine && modelStatus?.runtime.available === false ? (
            <div className="space-y-3 rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-100">
              <div>
                <div className="font-medium">Local AI setup required</div>
                <div className="mt-1 text-xs leading-5 text-blue-100/90">
                  Gitano will prepare its private local AI engine, then download
                  the selected model into Gitano's local AI data folder.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-blue-200/40 px-2 py-1 text-xs text-blue-50 hover:bg-blue-200/10"
                  disabled={loading}
                  onClick={() => {
                    void loadSetupState(setupModelId);
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          {!isExternalEngine && showCompatibilityWarning ? (
            <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100">
              <div className="font-medium">
                {compatibility.blocking
                  ? "This model cannot be prepared yet"
                  : "This model may run slowly"}
              </div>
              {compatibility.reasons.map((reason) => (
                <div key={reason}>{reason}</div>
              ))}
              <div className="text-xs text-amber-200/80">
                Machine: {formatGb(compatibility.machine.totalMemoryGb)} memory,{" "}
                {formatGb(compatibility.machine.modelStorageFreeDiskGb)} free in
                local AI model storage at{" "}
                {compatibility.machine.modelStoragePath}
              </div>
              {compatibility.recommendedModelId ? (
                <button
                  type="button"
                  className="rounded border border-amber-400/40 px-2 py-1 text-xs text-amber-50 hover:bg-amber-400/10"
                  onClick={() => {
                    setSelectedModelId(compatibility.recommendedModelId ?? "");
                    setAllowLimited(false);
                  }}
                >
                  Use {compatibility.recommendedModelId}
                </button>
              ) : null}
              {!compatibility.blocking ? (
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={allowLimited}
                    onChange={(event) => setAllowLimited(event.target.checked)}
                  />
                  Continue anyway
                </label>
              ) : null}
            </div>
          ) : null}

          {activeProgress ? (
            <div className="rounded border border-border bg-background-emphasis p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-300">
                <span>{activeProgress.status}</span>
                {typeof activeProgress.percentage === "number" ? (
                  <span>{Math.round(activeProgress.percentage)}%</span>
                ) : null}
              </div>
              <div className="h-2 overflow-hidden rounded bg-zinc-800">
                <div
                  className={`h-full bg-blue-500 transition-all ${
                    typeof activeProgress.percentage === "number"
                      ? ""
                      : "w-1/3 animate-pulse"
                  }`}
                  style={
                    typeof activeProgress.percentage === "number"
                      ? { width: `${activeProgress.percentage}%` }
                      : undefined
                  }
                />
              </div>
              {activeProgress.error ? (
                <div className="mt-2 text-xs text-red-300">
                  {activeProgress.error}
                </div>
              ) : null}
              {previousProgressSteps.length > 0 ? (
                <div className="mt-3 space-y-1 border-t border-border pt-2">
                  {previousProgressSteps.map((progress, index) => (
                    <div
                      key={`${progress.state}-${progress.status}-${index}`}
                      className="flex items-center justify-between gap-3 text-[11px] text-zinc-400"
                    >
                      <span className="min-w-0 truncate">
                        {progress.status}
                      </span>
                      {typeof progress.percentage === "number" ? (
                        <span>{Math.round(progress.percentage)}%</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-background-emphasis px-5 py-3">
          <button
            type="button"
            className="h-8 rounded border border-border px-3 text-xs text-zinc-200 hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
          {readyButtonVisible ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded border border-blue-500/50 bg-blue-500/15 px-3 text-xs font-semibold text-blue-100 hover:bg-blue-500/25"
              onClick={() => {
                void handleReady();
              }}
            >
              Ready
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded border border-blue-500/50 bg-blue-500/15 px-3 text-xs font-semibold text-blue-100 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canPrepare}
              onClick={() => {
                setupStartedRef.current = true;
                void prepareSelectedModel(selectedModelId, allowLimited);
              }}
            >
              <IconCloudDownload size={14} />
              {downloadButtonLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
