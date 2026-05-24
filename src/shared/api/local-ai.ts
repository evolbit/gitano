import { invokeCommand } from "@/shared/platform/tauri/command";
import { listenToEvent } from "@/shared/platform/tauri/events";

export const LOCAL_AI_PROGRESS_EVENT = "local-ai-progress";
export const LOCAL_AI_RUN_PROGRESS_EVENT = "local-ai-run-progress";
export const EXTERNAL_AI_AGENT_PROGRESS_EVENT = "external-ai-agent-progress";
export const EXTERNAL_AI_RUN_EVENT = "external-ai-run-event";

export type LocalAiActionKind =
  | "commitMessage"
  | "commitAnalysis"
  | "branchAnalysis"
  | "branchReview"
  | "mergeConflictSuggestions";

export type LocalAiEntitlementStatus = {
  entitled: boolean;
  source: "developmentStub" | "license" | "missing";
  reason: string | null;
};

export type LocalAiModelQualityTier =
  | "fast"
  | "recommended"
  | "better"
  | "max"
  | "experimental";

export type LocalAiModelWarmMemoryClass =
  | "small"
  | "medium"
  | "large"
  | "veryLarge";

export type LocalAiModelRequirements = {
  minMemoryGb: number;
  recommendedMemoryGb: number;
  minDiskFreeGb: number;
  recommendedDiskFreeGb: number;
};

export type LocalAiModelEntry = {
  id: string;
  displayName: string;
  provider: string;
  qualityTier: LocalAiModelQualityTier;
  downloadSizeGb: number;
  contextWindow: number;
  actionSuitability: LocalAiActionKind[];
  warmMemoryEstimateGb?: number;
  warmMemoryClass?: LocalAiModelWarmMemoryClass;
  minRequirements: LocalAiModelRequirements;
  recommendedRequirements: LocalAiModelRequirements;
};

export type AnalysisEngine =
  | { type: "local_model"; modelId: string | null }
  | { type: "external_agent"; agentId: string };

export type LocalAiPreferences = {
  globalModelId: string;
  actionModelIds: Record<string, string>;
  analysisEngine?: AnalysisEngine;
  actionEngines?: Record<string, AnalysisEngine>;
  externalAgentOptionValues?: Record<string, Record<string, string>>;
  actionExternalAgentOptionValues?: Record<
    string,
    Record<string, Record<string, string>>
  >;
  actionPromptOverrides?: Record<string, string>;
  warmModelIds?: string[];
  keepAliveMinutes?: number;
};

export type LocalAiMachineProfile = {
  os: string;
  arch: string;
  cpuCount: number;
  totalMemoryGb: number | null;
  availableMemoryGb: number | null;
  modelStoragePath: string;
  modelStorageFreeDiskGb: number | null;
};

export type LocalAiCompatibilityLevel =
  | "compatible"
  | "limited"
  | "likelyTooLarge"
  | "insufficientDisk"
  | "runtimeUnavailable";

export type LocalAiCompatibility = {
  modelId: string;
  level: LocalAiCompatibilityLevel;
  blocking: boolean;
  reasons: string[];
  recommendedModelId: string | null;
  machine: LocalAiMachineProfile;
};

export type LocalAiRuntimeStatus = {
  available: boolean;
  endpoint: string;
  error: string | null;
};

export type LocalAiRuntimeSetupStatus = {
  runtime: LocalAiRuntimeStatus;
  managed: boolean;
  installed: boolean;
  installedVersion: string | null;
  latestCompatibleVersion: string;
  modelStoragePath: string;
  canInstall: boolean;
};

export type LocalAiModelStatus = {
  runtime: LocalAiRuntimeStatus;
  modelId: string;
  installed: boolean;
  digest: string | null;
  sizeBytes: number | null;
  running: boolean;
  ready: boolean;
};

export type LocalAiProgressState =
  | "queued"
  | "installingRuntime"
  | "startingRuntime"
  | "downloading"
  | "verifying"
  | "completed"
  | "failed";

export type LocalAiDownloadProgress = {
  operationId: string;
  modelId: string;
  state: LocalAiProgressState;
  status: string;
  completedBytes: number | null;
  totalBytes: number | null;
  percentage: number | null;
  error: string | null;
};

export type LocalAiRunProgressState =
  | "resolvingCommit"
  | "readingCommitDiff"
  | "resolvingRefs"
  | "determiningDiffBase"
  | "readingComparisonDiff"
  | "checkingCache"
  | "cacheHit"
  | "runningModel"
  | "formattingResult"
  | "completed"
  | "failed";

export type LocalAiRunProgress = {
  runId: string;
  actionKind: LocalAiActionKind;
  state: LocalAiRunProgressState;
  message: string;
  error: string | null;
};

export type LocalAiPrepareModelRequest = {
  modelId: string;
  allowLimited?: boolean;
};

export type LocalAiPrepareModelResponse = {
  operationId: string;
};

export type LocalAiPrepareRuntimeRequest = {
  forceReinstall?: boolean;
};

export type LocalAiPrepareRuntimeResponse = {
  operationId: string;
};

export type LocalAiSetModelPreferenceRequest = {
  modelId: string;
  actionKind?: LocalAiActionKind | null;
};

export type LocalAiSetAnalysisEnginePreferenceRequest = {
  engine: AnalysisEngine;
  actionKind?: LocalAiActionKind | null;
};

export type ExternalAiAgentInstallKind = "binary" | "npx";

export type ExternalAiAgentInstallSource = {
  kind: ExternalAiAgentInstallKind;
  package: string | null;
  archive: string | null;
  command: string[];
};

export type ExternalAiAgentStatusState =
  | "notInstalled"
  | "ready"
  | "unavailable"
  | "unsupportedPlatform"
  | "failed";

export type ExternalAiAgentAuthMethod = {
  id: string;
  displayName: string;
};

export type ExternalAiAgentStatus = {
  agentId: string;
  installed: boolean;
  authenticated: boolean;
  available: boolean;
  state: ExternalAiAgentStatusState;
  version: string | null;
  authMethods?: ExternalAiAgentAuthMethod[];
  error: string | null;
};

export type ExternalAiAgentEntry = {
  id: string;
  displayName: string;
  provider: string;
  description: string;
  version: string;
  repository: string | null;
  license: string | null;
  installSource: ExternalAiAgentInstallSource | null;
  status: ExternalAiAgentStatus;
};

export type ExternalAiAgentProgressState =
  | "queued"
  | "downloading"
  | "installing"
  | "completed"
  | "failed";

export type ExternalAiAgentProgress = {
  operationId: string;
  agentId: string;
  state: ExternalAiAgentProgressState;
  status: string;
  completedBytes: number | null;
  totalBytes: number | null;
  percentage: number | null;
  error: string | null;
};

export type ExternalAiAgentInstallRequest = {
  agentId: string;
};

export type ExternalAiAgentInstallResponse = {
  operationId: string;
};

export type ExternalAiAgentCommandRequest = {
  agentId: string;
};

export type ExternalAiAgentSessionConfigRequest = {
  agentId: string;
  repoPath?: string | null;
};

export type ExternalAiAgentConfigOptionValue = {
  value: string;
  name: string;
  description: string | null;
};

export type ExternalAiAgentConfigOption = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  type: string;
  currentValue: string;
  options: ExternalAiAgentConfigOptionValue[];
};

export type ExternalAiAgentSessionConfig = {
  agentId: string;
  options: ExternalAiAgentConfigOption[];
};

export type ExternalAiAgentConfigPreferenceRequest = {
  agentId: string;
  actionKind?: LocalAiActionKind | null;
  configId: string;
  value?: string | null;
};

export type LocalAiSetActionPromptOverrideRequest = {
  actionKind: LocalAiActionKind;
  prompt?: string | null;
};

export type ExternalAiRunEventKind =
  | "text"
  | "thought"
  | "plan"
  | "toolCall"
  | "toolCallUpdate"
  | "permissionDenied"
  | "fileRead"
  | "error"
  | "completed";

export type ExternalAiRunEvent = {
  runId: string;
  actionKind: LocalAiActionKind;
  agentId: string;
  kind: ExternalAiRunEventKind;
  message: string;
  raw: unknown | null;
};

export type ExternalAiPromptRequest = {
  agentId: string;
  repoPath: string;
  runId: string;
  actionKind: LocalAiActionKind;
  prompt: string;
  externalAgentOptionOverrides?: Record<string, string>;
};

export type ExternalAiPromptResponse = {
  agentId: string;
  stopReason: string;
  transcript: string;
};

export type ExternalAiCancelRequest = {
  runId: string;
};

export type LocalAiSetModelWarmPreferenceRequest = {
  modelId: string;
  warm: boolean;
};

export type LocalAiWarmModelFailure = {
  modelId: string;
  error: string;
};

export type LocalAiWarmModelsResponse = {
  warmedModelIds: string[];
  failures: LocalAiWarmModelFailure[];
};

export type LocalAiRunRequest = {
  repoPath: string;
  actionKind: LocalAiActionKind;
  runId?: string | null;
  modelId?: string | null;
  forceRefresh?: boolean;
  commitSha?: string | null;
  baseRef?: string | null;
  headRef?: string | null;
  comparisonMode?: string | null;
  externalAgentOptionOverrides?: Record<string, string>;
};

export type LocalAiFindingSeverity = "info" | "low" | "medium" | "high";

export type LocalAiFinding = {
  severity: LocalAiFindingSeverity;
  title: string;
  explanation: string;
  filePath: string | null;
  line: number | null;
  suggestion: string | null;
};

export type LocalAiCommitMessageResult = {
  message: string;
  alternatives: string[];
};

export type LocalAiAnalysisResult = {
  summary: string;
  riskAssessment: string | null;
  changedAreas: string[];
  behavioralChanges?: string[];
  potentialRegressions?: string[];
  testGaps?: string[];
  recommendations?: string[];
  actionItems?: string[];
  findings: LocalAiFinding[];
};

export type LocalAiReviewLineSide = "old" | "new";
export type LocalAiReviewConfidence = "low" | "medium" | "high";

export type LocalAiBranchReviewFinding = {
  severity: LocalAiFindingSeverity;
  confidence: LocalAiReviewConfidence;
  title: string;
  explanation: string;
  impact: string;
  recommendation: string;
  suggestedComment: string;
  filePath: string;
  side: LocalAiReviewLineSide;
  line: number;
  endLine: number | null;
};

export type LocalAiBranchReviewNote = {
  severity: LocalAiFindingSeverity;
  confidence: LocalAiReviewConfidence;
  title: string;
  explanation: string;
  recommendation: string;
  suggestedComment: string | null;
  filePath: string | null;
};

export type LocalAiBranchReviewResult = {
  summary: string;
  findings: LocalAiBranchReviewFinding[];
  notes: LocalAiBranchReviewNote[];
};

export type LocalAiConflictFileSuggestion = {
  filePath: string;
  summary: string;
  suggestion: string;
};

export type LocalAiConflictSuggestionsResult = {
  summary: string;
  files: LocalAiConflictFileSuggestion[];
};

export type LocalAiStructuredResult =
  | { kind: "commitMessage"; data: LocalAiCommitMessageResult }
  | { kind: "analysis"; data: LocalAiAnalysisResult }
  | { kind: "branchReview"; data: LocalAiBranchReviewResult }
  | { kind: "conflictSuggestions"; data: LocalAiConflictSuggestionsResult };

export type LocalAiRunMetadata = {
  omittedFiles: string[];
  omittedSections: string[];
};

export type LocalAiRunResult = {
  actionKind: LocalAiActionKind;
  modelId: string;
  modelDigest: string;
  promptVersion: string;
  inputDigest: string;
  fromCache: boolean;
  metadata: LocalAiRunMetadata;
  result: LocalAiStructuredResult;
};

const LOCAL_AI_PREFERENCE_OVERRIDES_KEY =
  "gitano:local-ai-preference-overrides";

type LocalAiPreferenceOverrides = {
  clearedActionModelIds?: string[];
};

let lastKnownLocalAiPreferences: LocalAiPreferences | null = null;

function readPreferenceOverrides(): LocalAiPreferenceOverrides {
  try {
    const raw = globalThis.localStorage?.getItem(
      LOCAL_AI_PREFERENCE_OVERRIDES_KEY,
    );
    if (!raw) return {};

    const parsed = JSON.parse(raw) as LocalAiPreferenceOverrides;
    return {
      clearedActionModelIds: Array.isArray(parsed.clearedActionModelIds)
        ? parsed.clearedActionModelIds.filter(
            (actionKind): actionKind is string => typeof actionKind === "string",
          )
        : [],
    };
  } catch {
    return {};
  }
}

function writePreferenceOverrides(overrides: LocalAiPreferenceOverrides) {
  try {
    const clearedActionModelIds = [
      ...new Set(overrides.clearedActionModelIds ?? []),
    ];
    if (clearedActionModelIds.length === 0) {
      globalThis.localStorage?.removeItem(LOCAL_AI_PREFERENCE_OVERRIDES_KEY);
      return;
    }

    globalThis.localStorage?.setItem(
      LOCAL_AI_PREFERENCE_OVERRIDES_KEY,
      JSON.stringify({ clearedActionModelIds }),
    );
  } catch {
    // localStorage is a best-effort compatibility layer for older backends.
  }
}

function markActionModelCleared(actionKind: LocalAiActionKind) {
  const overrides = readPreferenceOverrides();
  writePreferenceOverrides({
    clearedActionModelIds: [
      ...(overrides.clearedActionModelIds ?? []),
      actionKind,
    ],
  });
}

function unmarkActionModelCleared(actionKind: LocalAiActionKind) {
  const overrides = readPreferenceOverrides();
  writePreferenceOverrides({
    clearedActionModelIds: (overrides.clearedActionModelIds ?? []).filter(
      (clearedActionKind) => clearedActionKind !== actionKind,
    ),
  });
}

function applyPreferenceOverrides(
  preferences: LocalAiPreferences,
): LocalAiPreferences {
  const analysisEngine =
    preferences.analysisEngine ??
    ({
      type: "local_model",
      modelId: preferences.globalModelId || null,
    } satisfies AnalysisEngine);
  const actionEngines = {
    ...Object.fromEntries(
      Object.entries(preferences.actionModelIds ?? {}).map(
        ([actionKind, modelId]) =>
          [
            actionKind,
            { type: "local_model", modelId } satisfies AnalysisEngine,
          ] as const,
      ),
    ),
    ...(preferences.actionEngines ?? {}),
  };
  const normalizedPreferences = {
    ...preferences,
    analysisEngine,
    actionEngines,
    externalAgentOptionValues:
      preferences.externalAgentOptionValues ?? {},
    actionExternalAgentOptionValues:
      preferences.actionExternalAgentOptionValues ?? {},
    actionPromptOverrides: preferences.actionPromptOverrides ?? {},
    warmModelIds: preferences.warmModelIds ?? [],
    keepAliveMinutes: preferences.keepAliveMinutes ?? 30,
  };
  const overrides = readPreferenceOverrides();
  const clearedActionModelIds = overrides.clearedActionModelIds ?? [];
  if (clearedActionModelIds.length === 0) {
    lastKnownLocalAiPreferences = normalizedPreferences;
    return normalizedPreferences;
  }

  const actionModelIds = { ...normalizedPreferences.actionModelIds };
  const nextActionEngines = { ...normalizedPreferences.actionEngines };
  clearedActionModelIds.forEach((actionKind) => {
    delete actionModelIds[actionKind];
    delete nextActionEngines[actionKind];
  });

  const nextPreferences = {
    ...normalizedPreferences,
    actionModelIds,
    actionEngines: nextActionEngines,
  };
  lastKnownLocalAiPreferences = nextPreferences;
  return nextPreferences;
}

function isUnsupportedEmptyModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() === "Unsupported local AI model:";
}

export function getLocalAiEntitlementStatus() {
  return invokeCommand<LocalAiEntitlementStatus>(
    "ai_get_entitlement_status",
  );
}

export function getLocalAiModelCatalog() {
  return invokeCommand<LocalAiModelEntry[]>("ai_get_model_catalog");
}

export function getExternalAiAgentCatalog() {
  return invokeCommand<ExternalAiAgentEntry[]>(
    "ai_get_external_agent_catalog",
  );
}

export function getExternalAiAgentStatus(agentId: string) {
  return invokeCommand<ExternalAiAgentStatus>(
    "ai_get_external_agent_status",
    { agentId },
  );
}

export function getExternalAiAgentSessionConfig(
  request: ExternalAiAgentSessionConfigRequest,
) {
  return invokeCommand<ExternalAiAgentSessionConfig>(
    "ai_get_external_agent_session_config",
    {
      request: {
        agentId: request.agentId,
        repoPath: request.repoPath ?? null,
      },
    },
  );
}

export async function getLocalAiModelPreferences() {
  const preferences = await invokeCommand<LocalAiPreferences>(
    "ai_get_model_preferences",
  );
  return applyPreferenceOverrides(preferences);
}

export async function setLocalAiModelPreference(
  request: LocalAiSetModelPreferenceRequest,
) {
  const actionKind = request.actionKind ?? null;
  const modelId = request.modelId.trim();
  const nextRequest = {
    ...request,
    modelId,
    actionKind,
  };

  try {
    const preferences = await invokeCommand<LocalAiPreferences>(
      "ai_set_model_preference",
      {
        request: nextRequest,
      },
    );

    if (actionKind && modelId) {
      unmarkActionModelCleared(actionKind);
    } else if (actionKind && !modelId) {
      markActionModelCleared(actionKind);
    }

    return applyPreferenceOverrides(preferences);
  } catch (error) {
    if (actionKind && !modelId && isUnsupportedEmptyModelError(error)) {
      markActionModelCleared(actionKind);
      let preferences = lastKnownLocalAiPreferences;
      try {
        preferences = await invokeCommand<LocalAiPreferences>(
          "ai_get_model_preferences",
        );
      } catch {
        if (!preferences) {
          throw error;
        }
      }
      return applyPreferenceOverrides(preferences);
    }

    throw error;
  }
}

export async function setLocalAiAnalysisEnginePreference(
  request: LocalAiSetAnalysisEnginePreferenceRequest,
) {
  const preferences = await invokeCommand<LocalAiPreferences>(
    "ai_set_analysis_engine_preference",
    {
      request: {
        engine: request.engine,
        actionKind: request.actionKind ?? null,
      },
    },
  );

  return applyPreferenceOverrides(preferences);
}

export function setExternalAiAgentAsDefault(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<LocalAiPreferences>(
    "ai_set_external_agent_as_default",
    { request },
  ).then(applyPreferenceOverrides);
}

export function setExternalAiAgentConfigPreference(
  request: ExternalAiAgentConfigPreferenceRequest,
) {
  return invokeCommand<LocalAiPreferences>(
    "ai_set_external_agent_config_preference",
    {
      request: {
        agentId: request.agentId,
        actionKind: request.actionKind ?? null,
        configId: request.configId,
        value: request.value ?? null,
      },
    },
  ).then(applyPreferenceOverrides);
}

export function setLocalAiActionPromptOverride(
  request: LocalAiSetActionPromptOverrideRequest,
) {
  return invokeCommand<LocalAiPreferences>(
    "ai_set_action_prompt_override",
    {
      request: {
        actionKind: request.actionKind,
        prompt: request.prompt ?? null,
      },
    },
  ).then(applyPreferenceOverrides);
}

export function installExternalAiAgent(
  request: ExternalAiAgentInstallRequest,
) {
  return invokeCommand<ExternalAiAgentInstallResponse>(
    "ai_install_external_agent",
    { request },
  );
}

export function removeExternalAiAgent(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<void>("ai_remove_external_agent", { request });
}

export function authenticateExternalAiAgent(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<ExternalAiAgentStatus>(
    "ai_authenticate_external_agent",
    { request },
  );
}

export function logoutExternalAiAgent(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<ExternalAiAgentStatus>(
    "ai_logout_external_agent",
    { request },
  );
}

export function runExternalAiPrompt(request: ExternalAiPromptRequest) {
  return invokeCommand<ExternalAiPromptResponse>(
    "ai_run_external_agent_prompt",
    { request },
  );
}

export function cancelExternalAiRun(request: ExternalAiCancelRequest) {
  return invokeCommand<void>("ai_cancel_external_agent_run", { request });
}

export async function setLocalAiModelWarmPreference(
  request: LocalAiSetModelWarmPreferenceRequest,
) {
  const preferences = await invokeCommand<LocalAiPreferences>(
    "ai_set_model_warm_preference",
    {
      request: {
        modelId: request.modelId.trim(),
        warm: request.warm,
      },
    },
  );

  return applyPreferenceOverrides(preferences);
}

export function getLocalAiMachineProfile() {
  return invokeCommand<LocalAiMachineProfile>("ai_get_machine_profile");
}

export function getLocalAiModelStatus(modelId?: string | null) {
  return invokeCommand<LocalAiModelStatus>("ai_get_model_status", {
    modelId,
  });
}

export function getLocalAiRuntimeStatus() {
  return invokeCommand<LocalAiRuntimeSetupStatus>("ai_get_runtime_status");
}

export function getLocalAiModelCompatibility(modelId: string) {
  return invokeCommand<LocalAiCompatibility>(
    "ai_get_model_compatibility",
    { modelId },
  );
}

export function prepareLocalAiModel(request: LocalAiPrepareModelRequest) {
  return invokeCommand<LocalAiPrepareModelResponse>("ai_prepare_model", {
    request,
  });
}

export function prepareLocalAiRuntime(request: LocalAiPrepareRuntimeRequest) {
  return invokeCommand<LocalAiPrepareRuntimeResponse>("ai_prepare_runtime", {
    request,
  });
}

export function deleteLocalAiModel(modelId: string) {
  return invokeCommand<void>("ai_delete_model", { modelId });
}

export function warmConfiguredLocalAiModels() {
  return invokeCommand<LocalAiWarmModelsResponse>(
    "ai_warm_configured_models",
  );
}

export function runLocalAiAction(request: LocalAiRunRequest) {
  return invokeCommand<LocalAiRunResult>("ai_run_action", { request });
}

export function listenToLocalAiProgress(
  handler: (progress: LocalAiDownloadProgress) => void,
) {
  return listenToEvent<LocalAiDownloadProgress>(
    LOCAL_AI_PROGRESS_EVENT,
    (event) => handler(event.payload),
  );
}

export function listenToLocalAiRunProgress(
  handler: (progress: LocalAiRunProgress) => void,
) {
  return listenToEvent<LocalAiRunProgress>(
    LOCAL_AI_RUN_PROGRESS_EVENT,
    (event) => handler(event.payload),
  );
}

export function listenToExternalAiAgentProgress(
  handler: (progress: ExternalAiAgentProgress) => void,
) {
  return listenToEvent<ExternalAiAgentProgress>(
    EXTERNAL_AI_AGENT_PROGRESS_EVENT,
    (event) => handler(event.payload),
  );
}

export function listenToExternalAiRunEvents(
  handler: (event: ExternalAiRunEvent) => void,
) {
  return listenToEvent<ExternalAiRunEvent>(
    EXTERNAL_AI_RUN_EVENT,
    (event) => handler(event.payload),
  );
}
