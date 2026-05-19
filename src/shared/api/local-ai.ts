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
  minRequirements: LocalAiModelRequirements;
  recommendedRequirements: LocalAiModelRequirements;
};

export type LocalAiPreferences = {
  globalModelId: string;
  actionModelIds: Record<string, string>;
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
  modelId: string | null;
  actionKind?: LocalAiActionKind | null;
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

export function getLocalAiEntitlementStatus() {
  return invokeCommand<LocalAiEntitlementStatus>(
    "ai_get_entitlement_status",
  );
}

export function getLocalAiModelCatalog() {
  return invokeCommand<LocalAiModelEntry[]>("ai_get_model_catalog");
}

export function getLocalAiModelPreferences() {
  return invokeCommand<LocalAiPreferences>("ai_get_model_preferences");
}

export function setLocalAiModelPreference(
  request: LocalAiSetModelPreferenceRequest,
) {
  return invokeCommand<LocalAiPreferences>("ai_set_model_preference", {
    request,
  });
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
