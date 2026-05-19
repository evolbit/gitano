import ReactDOM from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCheck,
  IconCloudDownload,
  IconX,
} from "@/components/icons";
import {
  deleteLocalAiModel,
  getLocalAiEntitlementStatus,
  getLocalAiModelCatalog,
  getLocalAiModelPreferences,
  getLocalAiModelStatus,
  getLocalAiRuntimeStatus,
  listenToLocalAiProgress,
  prepareLocalAiModel,
  prepareLocalAiRuntime,
  setLocalAiModelPreference,
  type LocalAiActionKind,
  type LocalAiDownloadProgress,
  type LocalAiEntitlementStatus,
  type LocalAiModelEntry,
  type LocalAiModelStatus,
  type LocalAiPreferences,
  type LocalAiRuntimeSetupStatus,
} from "@/shared/api/local-ai";
import { ACTION_MODEL_REQUIRED_MESSAGE } from "./constants";

type SettingsPane = "runtime" | "models" | "configuration";

type SettingsWindowProps = {
  open: boolean;
  onClose: () => void;
};

const AI_PANES: ReadonlyArray<{ key: SettingsPane; label: string }> = [
  { key: "runtime", label: "Runtime" },
  { key: "models", label: "Models" },
  { key: "configuration", label: "Configuration" },
];

const ACTIONS: ReadonlyArray<{
  kind: LocalAiActionKind;
  label: string;
  description: string;
}> = [
  {
    kind: "commitMessage",
    label: "Commit",
    description: "Generate commit messages from staged changes.",
  },
  {
    kind: "commitAnalysis",
    label: "Commit review",
    description: "Analyze committed changes.",
  },
  {
    kind: "branchAnalysis",
    label: "PR / branch review",
    description: "Analyze branch comparisons before opening a PR.",
  },
  {
    kind: "mergeConflictSuggestions",
    label: "Merge conflicts",
    description: "Suggest conflict resolution steps.",
  },
];

function formatContext(tokens: number) {
  return tokens >= 1024 ? `${Math.round(tokens / 1024)}K` : `${tokens}`;
}

function formatActionLabel(kind: string) {
  return ACTIONS.find((action) => action.kind === kind)?.label ?? kind;
}

function getModelStatusLabel(status: LocalAiModelStatus | null | undefined) {
  if (!status) return "Unknown";
  if (status.ready) return status.running ? "Running" : "Downloaded";
  if (!status.runtime.available) return "Runtime unavailable";
  return "Not downloaded";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : String(error || fallback);
}

function isUnsupportedEmptyModelError(error: unknown) {
  return errorMessage(error, "").trim() === "Unsupported local AI model:";
}

function SettingsRow({
  title,
  description,
  children,
  warning,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  warning?: string | null;
}) {
  return (
    <div className="border-t border-border py-4">
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-5 text-foreground">
            {title}
          </div>
          <div className="mt-1 max-w-[560px] text-xs leading-5 text-zinc-400">
            {description}
          </div>
          {warning ? (
            <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
              {warning}
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 justify-start md:justify-end">{children}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-4 text-xs font-semibold uppercase tracking-normal text-zinc-500">
      {children}
    </div>
  );
}

function SelectControl({
  value,
  disabled,
  onChange,
  children,
  label,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-8 w-full min-w-0 rounded border border-border bg-background px-2 text-xs font-medium text-foreground outline-none transition-colors focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-50 md:w-[220px]"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {children}
    </select>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === "danger"
          ? "border-red-500/40 bg-background text-red-100 hover:bg-red-500/10"
          : "border-border bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ValuePill({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-border bg-background-emphasis px-3 py-1.5 text-right text-xs font-semibold text-zinc-200">
      <span className="block truncate">{children}</span>
    </div>
  );
}

function ProgressPanel({ progress }: { progress: LocalAiDownloadProgress | null }) {
  if (!progress) return null;

  return (
    <div className="rounded border border-border bg-background-emphasis p-3 text-xs text-zinc-300">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">{progress.status}</span>
        {typeof progress.percentage === "number" ? (
          <span>{Math.round(progress.percentage)}%</span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-background">
        <div
          className={`h-full bg-blue-500 transition-all ${
            typeof progress.percentage === "number" ? "" : "w-1/3 animate-pulse"
          }`}
          style={
            typeof progress.percentage === "number"
              ? { width: `${progress.percentage}%` }
              : undefined
          }
        />
      </div>
      {progress.error ? (
        <div className="mt-2 text-red-300">{progress.error}</div>
      ) : null}
    </div>
  );
}

export function SettingsWindow({ open, onClose }: SettingsWindowProps) {
  const [pane, setPane] = useState<SettingsPane>("runtime");
  const [catalog, setCatalog] = useState<LocalAiModelEntry[]>([]);
  const [preferences, setPreferences] = useState<LocalAiPreferences | null>(null);
  const [entitlement, setEntitlement] =
    useState<LocalAiEntitlementStatus | null>(null);
  const [runtimeStatus, setRuntimeStatus] =
    useState<LocalAiRuntimeSetupStatus | null>(null);
  const [modelStatuses, setModelStatuses] = useState<
    Record<string, LocalAiModelStatus | null>
  >({});
  const [progressByOperationId, setProgressByOperationId] = useState<
    Record<string, LocalAiDownloadProgress>
  >({});
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const showSettingsError = useCallback((fallback: string, error: unknown) => {
    setSettingsError(errorMessage(error, fallback));
  }, []);

  const activeProgress = activeOperationId
    ? progressByOperationId[activeOperationId]
    : null;
  const setupInProgress =
    !!activeProgress &&
    activeProgress.state !== "completed" &&
    activeProgress.state !== "failed";

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setSettingsError(null);
    try {
      const [nextCatalog, nextPreferences, nextEntitlement, nextRuntimeStatus] =
        await Promise.all([
          getLocalAiModelCatalog(),
          getLocalAiModelPreferences(),
          getLocalAiEntitlementStatus(),
          getLocalAiRuntimeStatus(),
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
      setPreferences(nextPreferences);
      setEntitlement(nextEntitlement);
      setRuntimeStatus(nextRuntimeStatus);
      setModelStatuses(Object.fromEntries(statusEntries));
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

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    let unlisten: (() => void) | null = null;
    void listenToLocalAiProgress((progress) => {
      setProgressByOperationId((current) => ({
        ...current,
        [progress.operationId]: progress,
      }));

      if (progress.state === "completed") {
        void loadSettings();
      }
    }).then((nextUnlisten) => {
      if (mounted) {
        unlisten = nextUnlisten;
      } else {
        nextUnlisten();
      }
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [loadSettings, open]);

  const modelUsageById = useMemo(() => {
    const usage: Record<string, string[]> = {};
    if (!preferences) return usage;

    if (preferences.globalModelId.trim()) {
      usage[preferences.globalModelId] = ["Global default"];
    }
    Object.entries(preferences.actionModelIds).forEach(([kind, modelId]) => {
      usage[modelId] = [...(usage[modelId] ?? []), formatActionLabel(kind)];
    });

    return usage;
  }, [preferences]);

  const selectedModelIdForAction = (actionKind: LocalAiActionKind) =>
    preferences?.actionModelIds[actionKind] ?? "";

  const handlePrepareRuntime = async (forceReinstall: boolean) => {
    setSettingsError(null);
    try {
      const response = await prepareLocalAiRuntime({ forceReinstall });
      setActiveOperationId(response.operationId);
      setProgressByOperationId((current) => ({
        ...current,
        [response.operationId]: {
          operationId: response.operationId,
          modelId: "runtime",
          state: "queued",
          status: forceReinstall
            ? "Starting runtime upgrade..."
            : "Starting runtime setup...",
          completedBytes: null,
          totalBytes: null,
          percentage: null,
          error: null,
        },
      }));
    } catch (runtimeError) {
      showSettingsError("Runtime setup failed", runtimeError);
    }
  };

  const handlePrepareModel = async (modelId: string) => {
    setSettingsError(null);
    try {
      const response = await prepareLocalAiModel({
        modelId,
        allowLimited: true,
      });
      setActiveOperationId(response.operationId);
      setProgressByOperationId((current) => ({
        ...current,
        [response.operationId]: {
          operationId: response.operationId,
          modelId,
          state: "queued",
          status: `Starting download for ${modelId}...`,
          completedBytes: null,
          totalBytes: null,
          percentage: null,
          error: null,
        },
      }));
    } catch (downloadError) {
      showSettingsError("Model download failed", downloadError);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    setSettingsError(null);
    try {
      await deleteLocalAiModel(modelId);
      await loadSettings();
    } catch (deleteError) {
      showSettingsError("Model deletion failed", deleteError);
    }
  };

  const handleSetPreference = async (
    modelId: string,
    actionKind?: LocalAiActionKind | null,
  ) => {
    setSettingsError(null);
    const normalizedModelId = modelId.trim();
    if (
      actionKind &&
      !normalizedModelId &&
      !preferences?.actionModelIds[actionKind]
    ) {
      return;
    }

    try {
      const nextPreferences = await setLocalAiModelPreference({
        modelId: normalizedModelId,
        actionKind: actionKind ?? null,
      });
      setPreferences(nextPreferences);
    } catch (preferenceError) {
      if (actionKind && !normalizedModelId && isUnsupportedEmptyModelError(preferenceError)) {
        setPreferences((current) => {
          if (!current) return current;
          const actionModelIds = { ...current.actionModelIds };
          delete actionModelIds[actionKind];
          return {
            ...current,
            actionModelIds,
          };
        });
        return;
      }

      showSettingsError("Model preference failed", preferenceError);
    }
  };

  if (!open) return null;

  const runtimeActionLabel = runtimeStatus?.installed
    ? "Upgrade runtime"
    : "Download runtime";
  const paneTitle =
    pane === "runtime"
      ? "Runtime"
      : pane === "models"
        ? "Models"
        : "Configuration";

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/65 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="flex h-[min(720px,88vh)] w-[min(980px,96vw)] overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-background-emphasis">
          <div className="flex h-16 flex-shrink-0 flex-col justify-center border-b border-border px-4">
            <div className="text-sm font-semibold text-foreground">Settings</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Local AI</div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-normal text-zinc-500">
              AI
            </div>
            {AI_PANES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`mb-1 flex h-8 w-full items-center rounded px-2 text-left text-sm font-medium transition-colors ${
                  pane === item.key
                    ? "bg-zinc-800 text-foreground"
                    : "text-muted-foreground hover:bg-zinc-800/70 hover:text-foreground"
                }`}
                onClick={() => setPane(item.key)}
              >
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-background-emphasis px-5">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-normal text-zinc-500">
                AI
              </div>
              <h2 className="truncate text-sm font-semibold text-foreground">
                {paneTitle}
              </h2>
            </div>
            <button
              type="button"
              className="ml-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
              aria-label="Close"
              onClick={onClose}
            >
              <IconX size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 text-sm text-zinc-200">
            <div className="mx-auto w-full max-w-[780px]">
              {loading ? (
                <div className="mb-4 rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-300">
                  Loading settings...
                </div>
              ) : null}

              {settingsError ? (
                <div
                  role="alert"
                  className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
                >
                  {settingsError}
                </div>
              ) : null}

              {entitlement && !entitlement.entitled ? (
                <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  {entitlement.reason ?? "Local AI requires a premium license."}
                </div>
              ) : null}

              {activeProgress ? (
                <div className="mb-4">
                  <ProgressPanel progress={activeProgress} />
                </div>
              ) : null}

            {pane === "runtime" ? (
              <>
                <SectionLabel>Local Runtime</SectionLabel>

                <SettingsRow
                  title="Runtime Status"
                  description="Whether Gitano can reach the local AI runtime used for model downloads and inference."
                >
                  <ValuePill>
                    {runtimeStatus?.runtime.available
                      ? "Running"
                      : runtimeStatus?.installed
                        ? "Installed"
                        : "Not installed"}
                  </ValuePill>
                </SettingsRow>

                {runtimeStatus?.managed === false ? (
                  <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs leading-5 text-blue-100">
                    Runtime is controlled by OLLAMA_HOST. Manage upgrades outside
                    Gitano.
                  </div>
                ) : null}

                {runtimeStatus?.runtime.error ? (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    {runtimeStatus.runtime.error}
                  </div>
                ) : null}

                <SettingsRow
                  title="Runtime Endpoint"
                  description="Local endpoint used by Gitano when talking to the managed or externally configured runtime."
                >
                  <ValuePill>{runtimeStatus?.runtime.endpoint ?? "Unknown"}</ValuePill>
                </SettingsRow>

                <SettingsRow
                  title="Installed Version"
                  description="Version reported by the managed local AI runtime currently installed on this machine."
                >
                  <ValuePill>
                    {runtimeStatus?.installedVersion ??
                      (runtimeStatus?.installed ? "Installed" : "None")}
                  </ValuePill>
                </SettingsRow>

                <SettingsRow
                  title="Runtime Updates"
                  description={`Download or upgrade to ${runtimeStatus?.latestCompatibleVersion ?? "the latest compatible runtime"}.`}
                >
                  <ActionButton
                    disabled={
                      setupInProgress ||
                      !runtimeStatus?.canInstall ||
                      entitlement?.entitled === false
                    }
                    onClick={() => {
                      void handlePrepareRuntime(Boolean(runtimeStatus?.installed));
                    }}
                  >
                    <IconCloudDownload size={16} />
                    {runtimeActionLabel}
                  </ActionButton>
                </SettingsRow>

                <SettingsRow
                  title="Model Storage"
                  description="Directory where Gitano stores model weights when it owns the local runtime."
                >
                  <ValuePill>{runtimeStatus?.modelStoragePath ?? "Unknown"}</ValuePill>
                </SettingsRow>
              </>
            ) : null}

            {pane === "models" ? (
              <>
                <SectionLabel>Available Models</SectionLabel>
                {catalog.map((model) => {
                  const status = modelStatuses[model.id];
                  const usage = modelUsageById[model.id] ?? [];
                  return (
                    <SettingsRow
                      key={model.id}
                      title={model.displayName}
                      description={`${model.id} - ${model.downloadSizeGb.toFixed(1)}GB - ${formatContext(model.contextWindow)} context${
                        usage.length > 0 ? ` - Used by: ${usage.join(", ")}` : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ValuePill>{getModelStatusLabel(status)}</ValuePill>
                        {status?.ready ? (
                          <ActionButton
                            variant="danger"
                            disabled={setupInProgress}
                            onClick={() => {
                              void handleDeleteModel(model.id);
                            }}
                          >
                            Delete
                          </ActionButton>
                        ) : (
                          <ActionButton
                            disabled={
                              setupInProgress ||
                              entitlement?.entitled === false
                            }
                            onClick={() => {
                              void handlePrepareModel(model.id);
                            }}
                          >
                            <IconCloudDownload size={16} />
                            Download
                          </ActionButton>
                        )}
                      </div>
                    </SettingsRow>
                  );
                })}
              </>
            ) : null}

            {pane === "configuration" ? (
              <>
                <SectionLabel>Model Selection</SectionLabel>

                <SettingsRow
                  title="Global Default"
                  description="Default model used by local AI actions when an action-specific model is not configured."
                >
                  <SelectControl
                    label="Global default model"
                    value={preferences?.globalModelId ?? ""}
                    disabled={!preferences || catalog.length === 0}
                    onChange={(modelId) => {
                      if (!modelId) return;
                      void handleSetPreference(modelId, null);
                    }}
                  >
                    {preferences?.globalModelId ? null : (
                      <option value="">
                        ---
                      </option>
                    )}
                    {catalog.map((model) => (
                      <option
                        key={model.id}
                        value={model.id}
                      >
                        {model.displayName}
                      </option>
                    ))}
                  </SelectControl>
                </SettingsRow>

                <SectionLabel>Actions</SectionLabel>

                {ACTIONS.map((action) => {
                  const selectedModelId = selectedModelIdForAction(action.kind);
                  const selectedModelStatus = selectedModelId
                    ? modelStatuses[selectedModelId]
                    : null;
                  const selectedMissing =
                    !selectedModelId || selectedModelStatus?.ready === false;
                  return (
                    <SettingsRow
                      key={action.kind}
                      title={action.label}
                      description={action.description}
                      warning={
                        selectedMissing ? ACTION_MODEL_REQUIRED_MESSAGE : null
                      }
                    >
                      <div className="flex w-full flex-col items-end gap-2">
                        {selectedModelStatus?.ready ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                            <IconCheck size={14} />
                            Ready
                          </span>
                        ) : null}
                        <SelectControl
                          label={`${action.label} model`}
                          value={selectedModelId}
                          disabled={!preferences || catalog.length === 0}
                          onChange={(modelId) => {
                            void handleSetPreference(modelId, action.kind);
                          }}
                        >
                          <option value="">
                            ---
                          </option>
                          {catalog.map((model) => (
                            <option
                              key={model.id}
                              value={model.id}
                            >
                              {model.displayName}
                            </option>
                          ))}
                        </SelectControl>
                      </div>
                    </SettingsRow>
                  );
                })}
              </>
            ) : null}
          </div>
          </div>
        </main>
      </div>
    </div>,
    document.body,
  );
}
