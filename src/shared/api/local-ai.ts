import { invokeCommand } from "@/shared/platform/tauri/command";
import { listenToEvent } from "@/shared/platform/tauri/events";

export const LOCAL_AI_PROGRESS_EVENT = "local-ai-progress";

export type LocalAiActionKind =
  | "commitMessage"
  | "commitAnalysis"
  | "branchAnalysis"
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

export type LocalAiPreferences = {
  globalModelId: string;
  actionModelIds: Record<string, string>;
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
  modelId?: string | null;
  forceRefresh?: boolean;
  commitSha?: string | null;
  baseRef?: string | null;
  headRef?: string | null;
  comparisonMode?: string | null;
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
  findings: LocalAiFinding[];
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
  const normalizedPreferences = {
    ...preferences,
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
  clearedActionModelIds.forEach((actionKind) => {
    delete actionModelIds[actionKind];
  });

  const nextPreferences = {
    ...normalizedPreferences,
    actionModelIds,
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
