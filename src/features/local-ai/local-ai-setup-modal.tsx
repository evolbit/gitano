import ReactDOM from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCloudDownload, IconX } from "@/components/icons";
import type { LocalAiActionKind } from "@/shared/api/local-ai";
import { useLocalAiStore } from "./store";

type LocalAiSetupModalProps = {
  open: boolean;
  actionKind?: LocalAiActionKind | null;
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

export function LocalAiSetupModal({
  open,
  actionKind,
  onClose,
  onReady,
}: LocalAiSetupModalProps) {
  const {
    catalog,
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
    prepareSelectedModel,
  } = useLocalAiStore();
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [allowLimited, setAllowLimited] = useState(false);
  const setupStartedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setupStartedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadSetupState();
  }, [loadSetupState, open]);

  useEffect(() => {
    if (!open || !preferences) return;
    const preferredModelId =
      (actionKind ? preferences.actionModelIds[actionKind] : null) ??
      preferences.globalModelId;
    const nextModelId = preferredModelId || catalog[0]?.id || "";
    setSelectedModelId(nextModelId);
  }, [actionKind, catalog, open, preferences]);

  useEffect(() => {
    if (!open || !selectedModelId) return;
    void loadSetupState(selectedModelId);
  }, [loadSetupState, open, selectedModelId]);

  const selectedModel = useMemo(
    () => catalog.find((model) => model.id === selectedModelId) ?? null,
    [catalog, selectedModelId],
  );
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
  const isReady = modelStatus?.ready && modelStatus.modelId === selectedModelId;
  const runtimeUnavailable =
    modelStatus?.runtime.available === false ||
    compatibility?.level === "runtimeUnavailable";
  const setupModelId =
    selectedModelId || preferences?.globalModelId || modelStatus?.modelId || "";
  const canPrepare =
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

    setupStartedRef.current = false;
    onReady?.();
    onClose();
  }, [
    activeOperationId,
    activeProgress?.modelId,
    activeProgress?.state,
    isReady,
    onClose,
    onReady,
    open,
    selectedModelId,
  ]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10050]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-10 flex max-h-[88vh] w-[min(720px,94vw)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-normal text-muted-foreground">
              Premium local AI
            </div>
            <div className="text-base font-semibold text-foreground">
              Model setup
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

          {entitlement && !entitlement.entitled ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100">
              {entitlement.reason ?? "Local AI requires a premium license."}
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-300">
              Local model
            </span>
            <select
              value={selectedModelId}
              disabled={loading}
              className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
              onChange={(event) => {
                const modelId = event.target.value;
                setSelectedModelId(modelId);
                setAllowLimited(false);
                void setPreference(modelId, actionKind ?? null);
              }}
            >
              {catalog.map((model) => (
                <option
                  key={model.id}
                  value={model.id}
                >
                  {model.displayName} · {model.downloadSizeGb.toFixed(1)}GB ·{" "}
                  {model.qualityTier}
                </option>
              ))}
            </select>
          </label>

          {selectedModel ? (
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

          {modelStatus?.runtime.available === false ? (
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

          {showCompatibilityWarning ? (
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
          {isReady ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded border border-blue-500/50 bg-blue-500/15 px-3 text-xs font-semibold text-blue-100 hover:bg-blue-500/25"
              onClick={() => {
                onReady?.();
                onClose();
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
