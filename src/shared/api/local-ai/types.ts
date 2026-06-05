import type {
  GitConflictAiCandidate,
  GitConflictAiCandidateScope,
} from "@/shared/types/git-conflicts";

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
  source: "license" | "staleValidation" | "invalid" | "missing";
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
  conflictScope?: GitConflictAiCandidateScope | null;
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

export type LocalAiConflictCandidateResult = {
  filePath: string;
  scope: GitConflictAiCandidateScope;
  summary: string;
  candidate: GitConflictAiCandidate;
};

export type LocalAiStructuredResult =
  | { kind: "commitMessage"; data: LocalAiCommitMessageResult }
  | { kind: "analysis"; data: LocalAiAnalysisResult }
  | { kind: "branchReview"; data: LocalAiBranchReviewResult }
  | { kind: "conflictSuggestions"; data: LocalAiConflictSuggestionsResult }
  | { kind: "conflictCandidate"; data: LocalAiConflictCandidateResult };

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
