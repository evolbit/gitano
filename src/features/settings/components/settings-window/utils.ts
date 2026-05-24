import type {
  AnalysisEngine,
  ExternalAiAgentConfigOption,
  ExternalAiAgentEntry,
  ExternalAiAgentProgress,
  ExternalAiAgentSessionConfig,
  LocalAiActionKind,
  LocalAiDownloadProgress,
  LocalAiModelEntry,
  LocalAiModelStatus,
  LocalAiModelWarmMemoryClass,
  LocalAiPreferences,
  LocalAiRuntimeSetupStatus,
} from "@/shared/api/local-ai";
import { ACTIONS, DEFAULT_ACTION_PROMPTS } from "./config";

export function formatContext(tokens: number) {
  return tokens >= 1024 ? `${Math.round(tokens / 1024)}K` : `${tokens}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatGigabytes(value: number | null | undefined) {
  if (!isFiniteNumber(value)) {
    return "Unknown";
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}GB`;
}

export function getWarmMemoryEstimateGb(
  model: LocalAiModelEntry | null | undefined,
) {
  return isFiniteNumber(model?.warmMemoryEstimateGb)
    ? model.warmMemoryEstimateGb
    : null;
}

export function getWarmMemoryClass(
  model: LocalAiModelEntry | null | undefined,
) {
  return model?.warmMemoryClass ?? null;
}

export function hasWarmMetadata(
  model: LocalAiModelEntry | null | undefined,
) {
  return (
    getWarmMemoryEstimateGb(model) !== null &&
    getWarmMemoryClass(model) !== null
  );
}

export function formatWarmMemoryClass(
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

export function formatWarmMemoryDetails(model: LocalAiModelEntry) {
  const estimate = getWarmMemoryEstimateGb(model);
  if (estimate === null) {
    return "Warm memory unavailable";
  }

  return `${formatWarmMemoryClass(getWarmMemoryClass(model))} warm, about ${formatGigabytes(estimate)}`;
}

export function modelDescription(model: LocalAiModelEntry, usage: string[]) {
  const usageText = usage.length > 0 ? ` - Used by: ${usage.join(", ")}` : "";
  return `${model.id} - ${model.downloadSizeGb.toFixed(1)}GB download - ${formatContext(model.contextWindow)} context - ${formatWarmMemoryDetails(model)}${usageText}`;
}

function externalAgentAuthMethods(agent: ExternalAiAgentEntry) {
  return agent.status.authMethods?.map((method) => method.displayName).join(", ");
}

export function externalAgentDescription(agent: ExternalAiAgentEntry) {
  const license = agent.license ? ` - ${agent.license}` : "";
  const authMethods = externalAgentAuthMethods(agent);
  const auth = authMethods ? ` - Auth: ${authMethods}` : "";
  return `${agent.provider} - ${agent.description} - ${agent.version}${license}${auth}`;
}

export function formatActionLabel(kind: string) {
  return ACTIONS.find((action) => action.kind === kind)?.label ?? kind;
}

export function getModelStatusLabel(
  status: LocalAiModelStatus | null | undefined,
) {
  if (!status) return "Unknown";
  if (status.ready) return status.running ? "Running" : "Downloaded";
  if (!status.runtime.available) return "Runtime unavailable";
  return "Not downloaded";
}

export function runtimeStatusLabel(status: LocalAiRuntimeSetupStatus | null) {
  if (status?.runtime.available) return "Running";
  if (status?.installed) return "Installed";
  return "Not installed";
}

export function queuedLocalProgress(
  operationId: string,
  modelId: string,
  status: string,
): LocalAiDownloadProgress {
  return {
    operationId,
    modelId,
    state: "queued",
    status,
    completedBytes: null,
    totalBytes: null,
    percentage: null,
    error: null,
  };
}

export function queuedExternalProgress(
  operationId: string,
  agentId: string,
  status: string,
): ExternalAiAgentProgress {
  return {
    operationId,
    agentId,
    state: "queued",
    status,
    completedBytes: null,
    totalBytes: null,
    percentage: null,
    error: null,
  };
}

export function removeRecordEntry<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

export function warmDisabledReason({
  externalEngineSelected,
  warmMetadataAvailable,
  modelReady,
}: {
  externalEngineSelected: boolean;
  warmMetadataAvailable: boolean;
  modelReady: boolean;
}) {
  if (externalEngineSelected) {
    return "Warmup is unavailable while an external agent is selected.";
  }
  if (!warmMetadataAvailable) {
    return "Restart Gitano to enable warmup for this model.";
  }
  if (!modelReady) {
    return "Download the model before keeping it warm.";
  }
  return null;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : String(error || fallback);
}

export function isUnsupportedEmptyModelError(error: unknown) {
  return errorMessage(error, "").trim() === "Unsupported local AI model:";
}

export function describeWarmupFailures(
  failures: ReadonlyArray<{ modelId: string; error: string }>,
) {
  return failures
    .map((failure) => `${failure.modelId}: ${failure.error}`)
    .join("\n");
}

export function warmModelIdsWithToggle(
  currentModelIds: readonly string[],
  modelId: string,
  warm: boolean,
) {
  if (!warm) {
    return currentModelIds.filter((warmModelId) => warmModelId !== modelId);
  }

  return Array.from(new Set([...currentModelIds, modelId]));
}

export function localModelEngine(modelId: string | null): AnalysisEngine {
  return {
    type: "local_model",
    modelId,
  };
}

export function engineValue(engine: AnalysisEngine | null | undefined) {
  if (!engine) return "";
  if (engine.type === "external_agent") return `external:${engine.agentId}`;
  return engine.modelId ? `local:${engine.modelId}` : "";
}

export function engineFromValue(value: string): AnalysisEngine | null {
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

export function preferenceGlobalEngine(preferences: LocalAiPreferences | null) {
  if (!preferences) return null;
  return (
    preferences.analysisEngine ??
    localModelEngine(preferences.globalModelId.trim() || null)
  );
}

export function preferenceActionEngine(
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

export function hasExternalEngine(preferences: LocalAiPreferences | null) {
  if (!preferences) return false;
  const globalEngine = preferenceGlobalEngine(preferences);
  return (
    globalEngine?.type === "external_agent" ||
    Object.values(preferences.actionEngines ?? {}).some(
      (engine) => engine.type === "external_agent",
    )
  );
}

export function externalAgentGlobalOptionValues(
  preferences: LocalAiPreferences | null,
  agentId: string,
) {
  return preferences?.externalAgentOptionValues?.[agentId] ?? {};
}

export function externalAgentActionOptionValues(
  preferences: LocalAiPreferences | null,
  actionKind: LocalAiActionKind,
  agentId: string,
) {
  return (
    preferences?.actionExternalAgentOptionValues?.[actionKind]?.[agentId] ?? {}
  );
}

export function externalAgentEffectiveOptionValue(
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

export function externalAgentOptionLabel(
  option: ExternalAiAgentConfigOption,
  value: string,
) {
  return option.options.find((item) => item.value === value)?.name ?? value;
}

export function selectableExternalConfigOptions(
  config: ExternalAiAgentSessionConfig | null | undefined,
) {
  return (config?.options ?? []).filter(
    (option) => option.type === "select" && option.options.length > 0,
  );
}

export function statusLabel(agent: ExternalAiAgentEntry) {
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

export function promptDraftsFromPreferences(
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
