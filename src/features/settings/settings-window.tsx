import ReactDOM from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconCloudDownload,
  IconX,
} from "@/components/icons";
import {
  authenticateExternalAiAgent,
  deleteLocalAiModel,
  getExternalAiAgentCatalog,
  getExternalAiAgentSessionConfig,
  getLocalAiEntitlementStatus,
  getLocalAiMachineProfile,
  getLocalAiModelCatalog,
  getLocalAiModelPreferences,
  getLocalAiModelStatus,
  getLocalAiRuntimeStatus,
  installExternalAiAgent,
  listenToExternalAiAgentProgress,
  listenToLocalAiProgress,
  prepareLocalAiModel,
  prepareLocalAiRuntime,
  removeExternalAiAgent,
  setExternalAiAgentConfigPreference,
  setExternalAiAgentAsDefault,
  setLocalAiActionPromptOverride,
  setLocalAiAnalysisEnginePreference,
  setLocalAiModelPreference,
  setLocalAiModelWarmPreference,
  warmConfiguredLocalAiModels,
  type AnalysisEngine,
  type ExternalAiAgentConfigOption,
  type ExternalAiAgentEntry,
  type ExternalAiAgentProgress,
  type ExternalAiAgentSessionConfig,
  type LocalAiActionKind,
  type LocalAiDownloadProgress,
  type LocalAiEntitlementStatus,
  type LocalAiMachineProfile,
  type LocalAiModelEntry,
  type LocalAiModelWarmMemoryClass,
  type LocalAiModelStatus,
  type LocalAiPreferences,
  type LocalAiRuntimeSetupStatus,
} from "@/shared/api/local-ai";
import { ACTION_MODEL_REQUIRED_MESSAGE } from "./constants";

type SettingsPane = "runtime" | "models" | "externalAgents" | "configuration";

type SettingsWindowProps = {
  open: boolean;
  onClose: () => void;
  repoPath?: string | null;
};

type WarmConfirmation = {
  modelId: string;
  title: string;
  description: string;
  details: string;
};

const AI_PANES: ReadonlyArray<{ key: SettingsPane; label: string }> = [
  { key: "runtime", label: "Runtime" },
  { key: "models", label: "Local Models" },
  { key: "externalAgents", label: "External Agents" },
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
    label: "Branch analysis",
    description: "Analyze branch risk before opening a PR.",
  },
  {
    kind: "branchReview",
    label: "Branch review",
    description: "Review changed lines before opening a PR.",
  },
  {
    kind: "mergeConflictSuggestions",
    label: "Merge conflicts",
    description: "Suggest conflict resolution steps.",
  },
];

const DEFAULT_ACTION_PROMPTS: Record<LocalAiActionKind, string> = {
  commitMessage: [
    "Generate a Git commit message for the staged changes only.",
    "Requirements:",
    "- The message must be specific to the files and behavior changed.",
    "- Use imperative mood and keep the subject near 72 characters.",
    "- Prefer conventional commit style when a clear type fits: feat, fix, refactor, test, docs, chore.",
    '- Do not use generic messages like "Update changes", "Update files", "Misc changes", or "Refactor code".',
  ].join("\n"),
  commitAnalysis:
    "Analyze this commit for correctness, risk, and maintainability.",
  branchAnalysis: [
    "Analyze this branch or PR-style diff as a reviewer preparing to approve or question a PR.",
    "Focus on intent, real risks, behavioral changes, potential regressions, test gaps, recommendations, and action items.",
    "Do not return a raw changed-file list; the UI already shows the changed files. Mention files only when they support a concrete risk or action item.",
    "Do not create low-value findings. If there are no concrete findings, return an empty findings array and useful recommendations or action items if applicable.",
    "Keep the report focused on findings that affect review or release decisions.",
  ].join("\n"),
  branchReview: [
    "Review this branch like PR review feedback. Find changed lines that may introduce bugs, regressions, unsafe assumptions, missing validation, missing tests, or maintainability issues.",
    'Every inline finding must be anchored to a changed line from the diff. Use side "new" for added/modified new-code feedback and side "old" only when the deleted line itself needs attention.',
    "Do not summarize files. Do not produce informational cleanup comments. If there are no actionable changed-code risks, return an empty findings array and a concise summary.",
    "Suggested comments should be ready to paste into a PR and should ask for a concrete change or clarification.",
    "Include all material changed-code risks you can substantiate.",
    "Prioritize actionable, high-confidence findings over exhaustive or stylistic feedback.",
  ].join("\n"),
  mergeConflictSuggestions:
    "Suggest how to resolve these merge conflicts without modifying files.",
};

const WARM_MEMORY_WARNING_BASELINE_GB = 5;
const WARM_MEMORY_HIGH_SHARE = 0.25;
const WARM_MEMORY_VERY_HIGH_SHARE = 0.5;

function formatContext(tokens: number) {
  return tokens >= 1024 ? `${Math.round(tokens / 1024)}K` : `${tokens}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatGigabytes(value: number | null | undefined) {
  if (!isFiniteNumber(value)) {
    return "Unknown";
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}GB`;
}

function getWarmMemoryEstimateGb(model: LocalAiModelEntry | null | undefined) {
  return isFiniteNumber(model?.warmMemoryEstimateGb)
    ? model.warmMemoryEstimateGb
    : null;
}

function getWarmMemoryClass(model: LocalAiModelEntry | null | undefined) {
  return model?.warmMemoryClass ?? null;
}

function hasWarmMetadata(model: LocalAiModelEntry | null | undefined) {
  return getWarmMemoryEstimateGb(model) !== null && getWarmMemoryClass(model) !== null;
}

function formatWarmMemoryClass(
  memoryClass: LocalAiModelWarmMemoryClass | null | undefined,
) {
  switch (memoryClass) {
    case "small":
      return "Small";
    case "medium":
      return "Medium";
    case "large":
      return "Large";
    case "veryLarge":
      return "Very large";
    default:
      return "Unknown";
  }
}

function formatWarmMemoryDetails(model: LocalAiModelEntry) {
  const estimate = getWarmMemoryEstimateGb(model);
  if (estimate === null) {
    return "Warm memory unavailable";
  }

  return `${formatWarmMemoryClass(getWarmMemoryClass(model))} warm, about ${formatGigabytes(estimate)}`;
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

function describeWarmupFailures(
  failures: ReadonlyArray<{ modelId: string; error: string }>,
) {
  return failures
    .map((failure) => `${failure.modelId}: ${failure.error}`)
    .join("\n");
}

function warmModelIdsWithToggle(
  currentModelIds: readonly string[],
  modelId: string,
  warm: boolean,
) {
  if (!warm) {
    return currentModelIds.filter((warmModelId) => warmModelId !== modelId);
  }

  return Array.from(new Set([...currentModelIds, modelId]));
}

function localModelEngine(modelId: string | null): AnalysisEngine {
  return {
    type: "local_model",
    modelId,
  };
}

function engineValue(engine: AnalysisEngine | null | undefined) {
  if (!engine) return "";
  if (engine.type === "external_agent") return `external:${engine.agentId}`;
  return engine.modelId ? `local:${engine.modelId}` : "";
}

function engineFromValue(value: string): AnalysisEngine | null {
  if (value.startsWith("external:")) {
    const agentId = value.slice("external:".length);
    return agentId ? { type: "external_agent", agentId } : null;
  }

  if (value.startsWith("local:")) {
    const modelId = value.slice("local:".length);
    return modelId ? localModelEngine(modelId) : null;
  }

  return null;
}

function preferenceGlobalEngine(preferences: LocalAiPreferences | null) {
  if (!preferences) return null;
  return (
    preferences.analysisEngine ??
    localModelEngine(preferences.globalModelId.trim() || null)
  );
}

function preferenceActionEngine(
  preferences: LocalAiPreferences | null,
  actionKind: LocalAiActionKind,
) {
  if (!preferences) return null;
  return (
    preferences.actionEngines?.[actionKind] ??
    (preferences.actionModelIds[actionKind]
      ? localModelEngine(preferences.actionModelIds[actionKind])
      : null)
  );
}

function hasExternalEngine(preferences: LocalAiPreferences | null) {
  if (!preferences) return false;
  const globalEngine = preferenceGlobalEngine(preferences);
  return (
    globalEngine?.type === "external_agent" ||
    Object.values(preferences.actionEngines ?? {}).some(
      (engine) => engine.type === "external_agent",
    )
  );
}

const INHERIT_EXTERNAL_CONFIG_VALUE = "__gitano_inherit_external_config__";

function externalAgentGlobalOptionValues(
  preferences: LocalAiPreferences | null,
  agentId: string,
) {
  return preferences?.externalAgentOptionValues?.[agentId] ?? {};
}

function externalAgentActionOptionValues(
  preferences: LocalAiPreferences | null,
  actionKind: LocalAiActionKind,
  agentId: string,
) {
  return (
    preferences?.actionExternalAgentOptionValues?.[actionKind]?.[agentId] ?? {}
  );
}

function externalAgentEffectiveOptionValue(
  preferences: LocalAiPreferences | null,
  agentId: string,
  actionKind: LocalAiActionKind | null,
  option: ExternalAiAgentConfigOption,
) {
  const globalValue = externalAgentGlobalOptionValues(preferences, agentId)[
    option.id
  ];
  const actionValue = actionKind
    ? externalAgentActionOptionValues(preferences, actionKind, agentId)[
        option.id
      ]
    : undefined;
  return actionValue ?? globalValue ?? option.currentValue;
}

function externalAgentOptionLabel(
  option: ExternalAiAgentConfigOption,
  value: string,
) {
  return option.options.find((item) => item.value === value)?.name ?? value;
}

function selectableExternalConfigOptions(
  config: ExternalAiAgentSessionConfig | null | undefined,
) {
  return (config?.options ?? []).filter(
    (option) => option.type === "select" && option.options.length > 0,
  );
}

function statusLabel(agent: ExternalAiAgentEntry) {
  if (agent.status.available) return agent.status.authenticated ? "Ready" : "Ready";
  switch (agent.status.state) {
    case "notInstalled":
      return "Not installed";
    case "unsupportedPlatform":
      return "Unsupported";
    case "unavailable":
      return "Unavailable";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
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
    <div className="mb-3 mt-6 text-xs font-semibold uppercase tracking-normal text-zinc-500">
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

function ProgressPanel({
  progress,
}: {
  progress: LocalAiDownloadProgress | ExternalAiAgentProgress | null;
}) {
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

function WarmModelCheckbox({
  checked,
  disabled,
  reason,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  reason?: string | null;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <label
        className={`flex min-h-5 items-center gap-2 text-xs text-zinc-300 ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-blue-500"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span>Keep this model warm</span>
      </label>
      {disabled && reason ? (
        <div className="max-w-[220px] text-right text-[11px] leading-4 text-zinc-500">
          {reason}
        </div>
      ) : null}
    </div>
  );
}

function ExternalAgentConfigControls({
  agentId,
  scopeLabel,
  actionKind,
  preferences,
  config,
  loading,
  error,
  onChange,
}: {
  agentId: string;
  scopeLabel: string;
  actionKind: LocalAiActionKind | null;
  preferences: LocalAiPreferences | null;
  config: ExternalAiAgentSessionConfig | null | undefined;
  loading?: boolean;
  error?: string | null;
  onChange: (
    agentId: string,
    actionKind: LocalAiActionKind | null,
    configId: string,
    value: string | null,
  ) => void;
}) {
  if (loading && !config) {
    return (
      <div className="w-full text-right text-[11px] leading-4 text-zinc-500">
        Loading agent options...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-right text-[11px] leading-4 text-amber-100">
        {error}
      </div>
    );
  }

  const options = selectableExternalConfigOptions(config);
  if (options.length === 0) {
    return config ? (
      <div className="w-full text-right text-[11px] leading-4 text-zinc-500">
        No configurable agent options.
      </div>
    ) : null;
  }

  const globalValues = externalAgentGlobalOptionValues(preferences, agentId);
  const actionValues = actionKind
    ? externalAgentActionOptionValues(preferences, actionKind, agentId)
    : {};

  return (
    <div className="w-full space-y-2 rounded border border-border bg-background-emphasis p-2">
      {options.map((option) => {
        const optionHasValue = (value: string | undefined) =>
          Boolean(value && option.options.some((item) => item.value === value));
        const fallbackValue = optionHasValue(option.currentValue)
          ? option.currentValue
          : option.options[0]?.value ?? "";
        const effectiveValue = optionHasValue(
          externalAgentEffectiveOptionValue(
            preferences,
            agentId,
            actionKind,
            option,
          ),
        )
          ? externalAgentEffectiveOptionValue(
              preferences,
              agentId,
              actionKind,
              option,
            )
          : fallbackValue;
        const hasActionOverride =
          actionKind !== null &&
          Object.prototype.hasOwnProperty.call(actionValues, option.id);
        const savedGlobalValue = optionHasValue(globalValues[option.id])
          ? globalValues[option.id]
          : fallbackValue;
        const savedActionValue = optionHasValue(actionValues[option.id])
          ? actionValues[option.id]
          : fallbackValue;
        const selectedValue = actionKind
          ? hasActionOverride
            ? savedActionValue
            : INHERIT_EXTERNAL_CONFIG_VALUE
          : savedGlobalValue;

        return (
          <label
            key={option.id}
            className="block text-left text-[11px] font-semibold uppercase tracking-normal text-zinc-500"
          >
            <span>{option.name}</span>
            <select
              aria-label={`${scopeLabel} ${option.name}`}
              className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs font-medium normal-case text-foreground outline-none transition-colors focus:border-blue-500/60"
              value={selectedValue}
              onChange={(event) => {
                const value = event.currentTarget.value;
                onChange(
                  agentId,
                  actionKind,
                  option.id,
                  value === INHERIT_EXTERNAL_CONFIG_VALUE ? null : value,
                );
              }}
            >
              {actionKind ? (
                <option value={INHERIT_EXTERNAL_CONFIG_VALUE}>
                  {`Use global/default (${externalAgentOptionLabel(
                    option,
                    effectiveValue,
                  )})`}
                </option>
              ) : null}
              {option.options.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.name}
                </option>
              ))}
            </select>
            {option.description ? (
              <span className="mt-1 block normal-case leading-4 text-zinc-500">
                {option.description}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

function promptDraftsFromPreferences(
  preferences: LocalAiPreferences | null,
): Record<string, string> {
  return Object.fromEntries(
    ACTIONS.map((action) => [
      action.kind,
      preferences?.actionPromptOverrides?.[action.kind] ??
        DEFAULT_ACTION_PROMPTS[action.kind],
    ]),
  );
}

function PromptOverrideRow({
  action,
  value,
  hasOverride,
  canSave,
  canUseDefault,
  onChange,
  onSave,
  onUseDefault,
}: {
  action: (typeof ACTIONS)[number];
  value: string;
  hasOverride: boolean;
  canSave: boolean;
  canUseDefault: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onUseDefault: () => void;
}) {
  return (
    <div className="border-t border-border py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-5 text-foreground">
            {action.label}
          </div>
          <div className="mt-1 max-w-[640px] text-xs leading-5 text-zinc-400">
            {action.description}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <ActionButton disabled={!canUseDefault} onClick={onUseDefault}>
            Use default value
          </ActionButton>
          <ActionButton disabled={!canSave} onClick={onSave}>
            Save
          </ActionButton>
        </div>
      </div>
      <textarea
        aria-label={`${action.label} prompt override`}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-28 w-full resize-y rounded border border-border bg-background px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/60"
      />
      <div className="mt-2 text-[11px] leading-4 text-zinc-500">
        {hasOverride
          ? "Custom prompt override is active for this action."
          : "Using Gitano's default prompt for this action."}
      </div>
    </div>
  );
}

export function SettingsWindow({ open, onClose, repoPath }: SettingsWindowProps) {
  const [pane, setPane] = useState<SettingsPane>("runtime");
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
  const [progressByOperationId, setProgressByOperationId] = useState<
    Record<string, LocalAiDownloadProgress>
  >({});
  const [externalProgressByOperationId, setExternalProgressByOperationId] =
    useState<Record<string, ExternalAiAgentProgress>>({});
  const [externalConfigByAgentId, setExternalConfigByAgentId] = useState<
    Record<string, ExternalAiAgentSessionConfig | null>
  >({});
  const [externalConfigLoadingByAgentId, setExternalConfigLoadingByAgentId] =
    useState<Record<string, boolean>>({});
  const [externalConfigErrorsByAgentId, setExternalConfigErrorsByAgentId] =
    useState<Record<string, string>>({});
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const [activeExternalOperationId, setActiveExternalOperationId] =
    useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [warmSavingModelIds, setWarmSavingModelIds] = useState<
    Record<string, boolean>
  >({});
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [promptSavingActionKinds, setPromptSavingActionKinds] = useState<
    Record<string, boolean>
  >({});
  const [warmConfirmation, setWarmConfirmation] =
    useState<WarmConfirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const lastWarmSignatureRef = useRef<string | null>(null);
  const showSettingsError = useCallback((fallback: string, error: unknown) => {
    setSettingsError(errorMessage(error, fallback));
  }, []);

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
      setExternalConfigByAgentId({});
      setExternalConfigLoadingByAgentId({});
      setExternalConfigErrorsByAgentId({});
    } catch (loadError) {
      showSettingsError("AI settings failed", loadError);
    } finally {
      setLoading(false);
    }
  }, [showSettingsError]);

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
      setExternalConfigErrorsByAgentId((current) => {
        const next = { ...current };
        delete next[agentId];
        return next;
      });

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
        setExternalConfigLoadingByAgentId((current) => {
          const next = { ...current };
          delete next[agentId];
          return next;
        });
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
  }, [repoPath]);

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

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    let unlisten: (() => void) | null = null;
    void listenToExternalAiAgentProgress((progress) => {
      setExternalProgressByOperationId((current) => ({
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

  const modelById = useMemo(
    () => new Map(catalog.map((model) => [model.id, model])),
    [catalog],
  );
  const externalAgentById = useMemo(
    () => new Map(externalAgents.map((agent) => [agent.id, agent])),
    [externalAgents],
  );
  const globalEngine = preferenceGlobalEngine(preferences);
  const externalEngineSelected = hasExternalEngine(preferences);
  const selectedExternalAgentIds = useMemo(() => {
    if (!preferences) return [];
    const agentIds = new Set<string>();
    const global = preferenceGlobalEngine(preferences);
    if (global?.type === "external_agent") {
      agentIds.add(global.agentId);
    }
    ACTIONS.forEach((action) => {
      const engine = preferenceActionEngine(preferences, action.kind);
      if (engine?.type === "external_agent") {
        agentIds.add(engine.agentId);
      }
    });
    return [...agentIds].sort();
  }, [preferences]);

  useEffect(() => {
    if (!open || pane !== "configuration") return;
    selectedExternalAgentIds.forEach((agentId) => {
      void loadExternalAgentConfig(agentId);
    });
  }, [loadExternalAgentConfig, open, pane, selectedExternalAgentIds]);

  const warmModelIds = preferences?.warmModelIds ?? [];
  const warmSignature = useMemo(
    () => warmModelIds.slice().sort().join("|"),
    [warmModelIds],
  );

  const warmMemoryTotal = useCallback(
    (modelIds: readonly string[]) =>
      modelIds.reduce((total, modelId) => {
        return total + (getWarmMemoryEstimateGb(modelById.get(modelId)) ?? 0);
      }, 0),
    [modelById],
  );

  const buildWarmConfirmation = useCallback(
    (
      modelId: string,
      nextWarmModelIds: readonly string[],
    ): WarmConfirmation | null => {
      const model = modelById.get(modelId);
      if (!model) return null;

      const warmMemoryClass = getWarmMemoryClass(model);
      if (!hasWarmMetadata(model) || !warmMemoryClass) return null;

      const totalWarmMemoryGb = warmMemoryTotal(nextWarmModelIds);
      const totalMemoryGb = machineProfile?.totalMemoryGb ?? null;
      const memoryShare =
        totalMemoryGb && totalMemoryGb > 0
          ? totalWarmMemoryGb / totalMemoryGb
          : null;
      const largeModel =
        warmMemoryClass === "large" || warmMemoryClass === "veryLarge";
      const exceedsBaseline =
        totalWarmMemoryGb > WARM_MEMORY_WARNING_BASELINE_GB;
      const exceedsShare =
        memoryShare !== null && memoryShare >= WARM_MEMORY_HIGH_SHARE;

      if (!largeModel && !exceedsBaseline && !exceedsShare) {
        return null;
      }

      const severity =
        warmMemoryClass === "veryLarge" ||
        (memoryShare !== null && memoryShare >= WARM_MEMORY_VERY_HIGH_SHARE)
          ? "This is a very large warmup selection."
          : "This warmup selection may reserve noticeable memory.";

      const machineMemory = totalMemoryGb
        ? ` Machine memory: ${formatGigabytes(totalMemoryGb)}.`
        : "";

      return {
        modelId,
        title: "Keep model warm?",
        description:
          "Gitano will ask the local AI runtime to keep selected models loaded for faster first responses.",
        details: `${severity} Estimated warm memory: ${formatGigabytes(totalWarmMemoryGb)}.${machineMemory}`,
      };
    },
    [machineProfile?.totalMemoryGb, modelById, warmMemoryTotal],
  );

  const selectedEngineForAction = (actionKind: LocalAiActionKind) =>
    preferenceActionEngine(preferences, actionKind);

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

  const handleInstallExternalAgent = async (agentId: string) => {
    setSettingsError(null);
    try {
      const response = await installExternalAiAgent({ agentId });
      setActiveExternalOperationId(response.operationId);
      setExternalProgressByOperationId((current) => ({
        ...current,
        [response.operationId]: {
          operationId: response.operationId,
          agentId,
          state: "queued",
          status: `Starting install for ${agentId}...`,
          completedBytes: null,
          totalBytes: null,
          percentage: null,
          error: null,
        },
      }));
    } catch (installError) {
      showSettingsError("External agent install failed", installError);
    }
  };

  const handleAuthenticateExternalAgent = async (agentId: string) => {
    setSettingsError(null);
    try {
      await authenticateExternalAiAgent({ agentId });
      await loadSettings();
    } catch (authError) {
      showSettingsError("External agent authentication failed", authError);
    }
  };

  const handleRemoveExternalAgent = async (agentId: string) => {
    setSettingsError(null);
    try {
      await removeExternalAiAgent({ agentId });
      await loadSettings();
    } catch (removeError) {
      showSettingsError("External agent removal failed", removeError);
    }
  };

  const handleSetExternalAgentDefault = async (agentId: string) => {
    setSettingsError(null);
    try {
      const nextPreferences = await setExternalAiAgentAsDefault({ agentId });
      setPreferences(nextPreferences);
      await loadSettings();
    } catch (preferenceError) {
      showSettingsError("External agent preference failed", preferenceError);
    }
  };

  const handleWarmConfiguredModels = useCallback(async () => {
    if (externalEngineSelected) return;
    try {
      const response = await warmConfiguredLocalAiModels();
      if (response.failures.length > 0) {
        setSettingsError(describeWarmupFailures(response.failures));
      }
    } catch (warmError) {
      showSettingsError("Model warmup failed", warmError);
    }
  }, [externalEngineSelected, showSettingsError]);

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
          const actionEngines = { ...(current.actionEngines ?? {}) };
          delete actionModelIds[actionKind];
          delete actionEngines[actionKind];
          return {
            ...current,
            actionModelIds,
            actionEngines,
          };
        });
        return;
      }

      showSettingsError("Model preference failed", preferenceError);
    }
  };

  const handleSetEnginePreference = async (
    value: string,
    actionKind?: LocalAiActionKind | null,
  ) => {
    setSettingsError(null);
    const engine = engineFromValue(value);

    if (!engine && actionKind) {
      await handleSetPreference("", actionKind);
      return;
    }
    if (!engine) return;

    try {
      const nextPreferences = await setLocalAiAnalysisEnginePreference({
        engine,
        actionKind: actionKind ?? null,
      });
      setPreferences(nextPreferences);
    } catch (preferenceError) {
      showSettingsError("Analysis engine preference failed", preferenceError);
    }
  };

  const handleSetExternalConfigPreference = async (
    agentId: string,
    actionKind: LocalAiActionKind | null,
    configId: string,
    value: string | null,
  ) => {
    setSettingsError(null);
    try {
      const nextPreferences = await setExternalAiAgentConfigPreference({
        agentId,
        actionKind,
        configId,
        value,
      });
      setPreferences(nextPreferences);
    } catch (preferenceError) {
      showSettingsError("External agent option failed", preferenceError);
    }
  };

  const handleSetActionPromptOverride = async (
    actionKind: LocalAiActionKind,
    prompt: string | null,
  ) => {
    setSettingsError(null);
    setPromptSavingActionKinds((current) => ({
      ...current,
      [actionKind]: true,
    }));
    try {
      const nextPreferences = await setLocalAiActionPromptOverride({
        actionKind,
        prompt,
      });
      setPreferences(nextPreferences);
      setPromptDrafts((current) => ({
        ...current,
        [actionKind]:
          nextPreferences.actionPromptOverrides?.[actionKind] ??
          DEFAULT_ACTION_PROMPTS[actionKind],
      }));
    } catch (preferenceError) {
      showSettingsError("Prompt preference failed", preferenceError);
    } finally {
      setPromptSavingActionKinds((current) => {
        const next = { ...current };
        delete next[actionKind];
        return next;
      });
    }
  };

  const handleSetWarmPreference = useCallback(
    async (modelId: string, warm: boolean) => {
      if (externalEngineSelected) return;
      setSettingsError(null);
      setWarmSavingModelIds((current) => ({
        ...current,
        [modelId]: true,
      }));

      try {
        const nextPreferences = await setLocalAiModelWarmPreference({
          modelId,
          warm,
        });
        setPreferences(nextPreferences);
      } catch (warmPreferenceError) {
        showSettingsError("Model warmup preference failed", warmPreferenceError);
      } finally {
        setWarmSavingModelIds((current) => {
          const next = { ...current };
          delete next[modelId];
          return next;
        });
      }
    },
    [externalEngineSelected, showSettingsError],
  );

  const handleWarmToggle = useCallback(
    (modelId: string, warm: boolean) => {
      if (warm) {
        const nextWarmModelIds = warmModelIdsWithToggle(
          warmModelIds,
          modelId,
          true,
        );
        const confirmation = buildWarmConfirmation(modelId, nextWarmModelIds);
        if (confirmation) {
          setWarmConfirmation(confirmation);
          return;
        }
      }

      void handleSetWarmPreference(modelId, warm);
    },
    [buildWarmConfirmation, handleSetWarmPreference, warmModelIds],
  );

  useEffect(() => {
    if (!open || !warmSignature) return;
    if (lastWarmSignatureRef.current === warmSignature) return;

    lastWarmSignatureRef.current = warmSignature;
    void handleWarmConfiguredModels();
  }, [handleWarmConfiguredModels, open, warmSignature]);

  if (!open) return null;

  const runtimeActionLabel = runtimeStatus?.installed
    ? "Upgrade runtime"
    : "Download runtime";
  const paneTitle =
    pane === "runtime"
      ? "Runtime"
      : pane === "models"
        ? "Local Models"
        : pane === "externalAgents"
          ? "External Agents"
          : "Configuration";

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/65 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative flex h-[min(720px,88vh)] w-[min(980px,96vw)] overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-background-emphasis">
          <div className="flex h-16 flex-shrink-0 flex-col justify-center border-b border-border px-4">
            <div className="text-sm font-semibold text-foreground">Settings</div>
            <div className="mt-0.5 text-xs text-muted-foreground">AI Engines</div>
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

              {activeProgress || activeExternalProgress ? (
                <div className="mb-4">
                  <ProgressPanel progress={activeProgress ?? activeExternalProgress} />
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
                <SectionLabel>Available Local Models</SectionLabel>
                {catalog.map((model) => {
                  const status = modelStatuses[model.id];
                  const usage = modelUsageById[model.id] ?? [];
                  const warmMetadataAvailable = hasWarmMetadata(model);
                  const warmChecked = warmModelIds.includes(model.id);
                  const warmDisabled =
                    externalEngineSelected ||
                    !warmMetadataAvailable ||
                    !status?.ready ||
                    setupInProgress ||
                    Boolean(warmSavingModelIds[model.id]);
                  const warmDisabledReason = externalEngineSelected
                    ? "Warmup is unavailable while an external agent is selected."
                    : !warmMetadataAvailable
                    ? "Restart Gitano to enable warmup for this model."
                    : !status?.ready
                      ? "Download the model before keeping it warm."
                      : null;
                  return (
                    <SettingsRow
                      key={model.id}
                      title={model.displayName}
                      description={`${model.id} - ${model.downloadSizeGb.toFixed(1)}GB download - ${formatContext(model.contextWindow)} context - ${formatWarmMemoryDetails(model)}${
                        usage.length > 0 ? ` - Used by: ${usage.join(", ")}` : ""
                      }`}
                    >
                      <div className="flex w-full flex-col items-end gap-2">
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
                        <WarmModelCheckbox
                          checked={warmChecked}
                          disabled={warmDisabled}
                          reason={warmDisabledReason}
                          onChange={(checked) => {
                            handleWarmToggle(model.id, checked);
                          }}
                        />
                      </div>
                    </SettingsRow>
                  );
                })}
              </>
            ) : null}

            {pane === "externalAgents" ? (
              <>
                <SectionLabel>Curated Agents</SectionLabel>
                {externalAgents.map((agent) => {
                  const selected =
                    globalEngine?.type === "external_agent" &&
                    globalEngine.agentId === agent.id;
                  const authMethods = agent.status.authMethods
                    ?.map((method) => method.displayName)
                    .join(", ");
                  const installDisabled =
                    setupInProgress ||
                    entitlement?.entitled === false ||
                    !agent.installSource;
                  const setDefaultDisabled =
                    selected ||
                    !agent.status.available ||
                    entitlement?.entitled === false;

                  return (
                    <SettingsRow
                      key={agent.id}
                      title={agent.displayName}
                      description={`${agent.provider} - ${agent.description} - ${agent.version}${
                        agent.license ? ` - ${agent.license}` : ""
                      }${authMethods ? ` - Auth: ${authMethods}` : ""}`}
                      warning={agent.status.error}
                    >
                      <div className="flex w-full flex-col items-end gap-2">
                        <ValuePill>{selected ? "Selected" : statusLabel(agent)}</ValuePill>
                        <div className="flex flex-wrap justify-end gap-2">
                          {!agent.status.installed ? (
                            <ActionButton
                              disabled={installDisabled}
                              onClick={() => {
                                void handleInstallExternalAgent(agent.id);
                              }}
                            >
                              <IconCloudDownload size={16} />
                              Install
                            </ActionButton>
                          ) : (
                            <>
                              <ActionButton
                                disabled={entitlement?.entitled === false}
                                onClick={() => {
                                  void handleAuthenticateExternalAgent(agent.id);
                                }}
                              >
                                <IconCheck size={16} />
                                Authenticate
                              </ActionButton>
                              <ActionButton
                                variant="danger"
                                disabled={setupInProgress}
                                onClick={() => {
                                  void handleRemoveExternalAgent(agent.id);
                                }}
                              >
                                Remove
                              </ActionButton>
                            </>
                          )}
                          <ActionButton
                            disabled={setDefaultDisabled}
                            onClick={() => {
                              void handleSetExternalAgentDefault(agent.id);
                            }}
                          >
                            <IconCheck size={16} />
                            Set default
                          </ActionButton>
                        </div>
                      </div>
                    </SettingsRow>
                  );
                })}
              </>
            ) : null}

            {pane === "configuration" ? (
              <>
                <SectionLabel>Engine Selection</SectionLabel>

                <SettingsRow
                  title="Global Default"
                  description="Default analysis engine used when an action-specific engine is not configured."
                >
                  <div className="flex w-full flex-col items-end gap-2">
                    <SelectControl
                      label="Global default analysis engine"
                      value={engineValue(globalEngine)}
                      disabled={
                        !preferences ||
                        (catalog.length === 0 && externalAgents.length === 0)
                      }
                      onChange={(value) => {
                        void handleSetEnginePreference(value, null);
                      }}
                    >
                      {engineValue(globalEngine) ? null : (
                        <option value="">
                          ---
                        </option>
                      )}
                      <optgroup label="Local models">
                        {catalog.map((model) => (
                          <option
                            key={model.id}
                            value={`local:${model.id}`}
                          >
                            {model.displayName}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="External agents">
                        {externalAgents.map((agent) => (
                          <option
                            key={agent.id}
                            value={`external:${agent.id}`}
                            disabled={!agent.status.available}
                          >
                            {agent.displayName}
                          </option>
                        ))}
                      </optgroup>
                    </SelectControl>
                    {globalEngine?.type === "external_agent" ? (
                      <ExternalAgentConfigControls
                        agentId={globalEngine.agentId}
                        scopeLabel="Global default"
                        actionKind={null}
                        preferences={preferences}
                        config={externalConfigByAgentId[globalEngine.agentId]}
                        loading={
                          externalConfigLoadingByAgentId[globalEngine.agentId]
                        }
                        error={
                          externalConfigErrorsByAgentId[globalEngine.agentId]
                        }
                        onChange={(agentId, actionKind, configId, value) => {
                          void handleSetExternalConfigPreference(
                            agentId,
                            actionKind,
                            configId,
                            value,
                          );
                        }}
                      />
                    ) : null}
                  </div>
                </SettingsRow>

                <SectionLabel>Actions</SectionLabel>

                {ACTIONS.map((action) => {
                  const selectedEngine = selectedEngineForAction(action.kind);
                  const selectedModelId =
                    selectedEngine?.type === "local_model"
                      ? selectedEngine.modelId ?? ""
                      : "";
                  const selectedExternalAgent =
                    selectedEngine?.type === "external_agent"
                      ? externalAgentById.get(selectedEngine.agentId)
                      : null;
                  const selectedModelStatus = selectedModelId
                    ? modelStatuses[selectedModelId]
                    : null;
                  const selectedModel = selectedModelId
                    ? modelById.get(selectedModelId)
                    : null;
                  const warmMetadataAvailable = hasWarmMetadata(selectedModel);
                  const selectedMissing =
                    !selectedEngine ||
                    (selectedEngine.type === "local_model" &&
                      (!selectedModelId || selectedModelStatus?.ready === false)) ||
                    (selectedEngine.type === "external_agent" &&
                      !selectedExternalAgent?.status.available);
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
                          label={`${action.label} analysis engine`}
                          value={engineValue(selectedEngine)}
                          disabled={
                            !preferences ||
                            (catalog.length === 0 && externalAgents.length === 0)
                          }
                          onChange={(value) => {
                            void handleSetEnginePreference(value, action.kind);
                          }}
                        >
                          <option value="">
                            ---
                          </option>
                          <optgroup label="Local models">
                            {catalog.map((model) => (
                              <option
                                key={model.id}
                                value={`local:${model.id}`}
                              >
                                {model.displayName}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="External agents">
                            {externalAgents.map((agent) => (
                              <option
                                key={agent.id}
                                value={`external:${agent.id}`}
                                disabled={!agent.status.available}
                              >
                                {agent.displayName}
                              </option>
                            ))}
                          </optgroup>
                        </SelectControl>
                        {selectedExternalAgent ? (
                          <ValuePill>{statusLabel(selectedExternalAgent)}</ValuePill>
                        ) : null}
                        {selectedEngine?.type === "external_agent" ? (
                          <ExternalAgentConfigControls
                            agentId={selectedEngine.agentId}
                            scopeLabel={action.label}
                            actionKind={action.kind}
                            preferences={preferences}
                            config={
                              externalConfigByAgentId[selectedEngine.agentId]
                            }
                            loading={
                              externalConfigLoadingByAgentId[
                                selectedEngine.agentId
                              ]
                            }
                            error={
                              externalConfigErrorsByAgentId[
                                selectedEngine.agentId
                              ]
                            }
                            onChange={(agentId, actionKind, configId, value) => {
                              void handleSetExternalConfigPreference(
                                agentId,
                                actionKind,
                                configId,
                                value,
                              );
                            }}
                          />
                        ) : null}
                        {selectedModel && !externalEngineSelected ? (
                          <WarmModelCheckbox
                            checked={warmModelIds.includes(selectedModel.id)}
                            disabled={
                              !warmMetadataAvailable ||
                              !selectedModelStatus?.ready ||
                              setupInProgress ||
                              Boolean(warmSavingModelIds[selectedModel.id])
                            }
                            reason={
                              !warmMetadataAvailable
                                ? "Restart Gitano to enable warmup for this model."
                                : !selectedModelStatus?.ready
                                  ? "Download the model before keeping it warm."
                                  : null
                            }
                            onChange={(checked) => {
                              handleWarmToggle(selectedModel.id, checked);
                            }}
                          />
                        ) : null}
                      </div>
                    </SettingsRow>
                  );
                })}

                <SectionLabel>Prompts</SectionLabel>

                {ACTIONS.map((action) => {
                  const defaultPrompt = DEFAULT_ACTION_PROMPTS[action.kind];
                  const persistedOverride =
                    preferences?.actionPromptOverrides?.[action.kind] ?? null;
                  const hasOverride = Boolean(persistedOverride?.trim());
                  const value =
                    promptDrafts[action.kind] ??
                    persistedOverride ??
                    defaultPrompt;
                  const normalizedValue = value.trim();
                  const normalizedDefault = defaultPrompt.trim();
                  const normalizedSaved = (
                    persistedOverride ?? defaultPrompt
                  ).trim();
                  const saving = Boolean(
                    promptSavingActionKinds[action.kind],
                  );
                  const isDefaultValue =
                    normalizedValue === normalizedDefault;
                  const isSavedValue = normalizedValue === normalizedSaved;

                  return (
                    <PromptOverrideRow
                      key={action.kind}
                      action={action}
                      value={value}
                      hasOverride={hasOverride}
                      canSave={
                        !saving &&
                        normalizedValue.length > 0 &&
                        !isSavedValue &&
                        !isDefaultValue
                      }
                      canUseDefault={
                        !saving && (hasOverride || !isDefaultValue)
                      }
                      onChange={(value) => {
                        setPromptDrafts((current) => ({
                          ...current,
                          [action.kind]: value,
                        }));
                      }}
                      onSave={() => {
                        void handleSetActionPromptOverride(
                          action.kind,
                          promptDrafts[action.kind] ??
                            preferences?.actionPromptOverrides?.[
                              action.kind
                            ] ??
                            DEFAULT_ACTION_PROMPTS[action.kind],
                        );
                      }}
                      onUseDefault={() => {
                        setPromptDrafts((current) => ({
                          ...current,
                          [action.kind]: DEFAULT_ACTION_PROMPTS[action.kind],
                        }));
                        void handleSetActionPromptOverride(action.kind, null);
                      }}
                    />
                  );
                })}
              </>
            ) : null}
          </div>
          </div>
        </main>
        {warmConfirmation ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={warmConfirmation.title}
              className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
            >
              <div className="border-b border-border bg-background-emphasis px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {warmConfirmation.title}
                </h3>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm leading-5 text-zinc-200">
                  {warmConfirmation.description}
                </p>
                <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                  {warmConfirmation.details}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border bg-background-emphasis px-4 py-3">
                <button
                  type="button"
                  className="h-8 rounded border border-border bg-background px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                  onClick={() => {
                    setWarmConfirmation(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-8 rounded border border-blue-500/50 bg-blue-500/20 px-3 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30"
                  onClick={() => {
                    const modelId = warmConfirmation.modelId;
                    setWarmConfirmation(null);
                    void handleSetWarmPreference(modelId, true);
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
