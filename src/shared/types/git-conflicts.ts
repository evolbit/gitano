import { ChangeType } from "./git";

export const GIT_CONFLICT_SIDE = {
  Base: "base",
  Current: "current",
  Incoming: "incoming",
  Result: "result",
} as const;

export const GIT_CONFLICT_CONTENT_KIND = {
  Text: "text",
  Binary: "binary",
  Missing: "missing",
  Symlink: "symlink",
  Submodule: "submodule",
  Unsupported: "unsupported",
} as const;

export const GIT_CONFLICT_KIND = {
  BothModified: "bothModified",
  AddAdd: "addAdd",
  DeletedByCurrent: "deletedByCurrent",
  DeletedByIncoming: "deletedByIncoming",
  Binary: "binary",
  Symlink: "symlink",
  Submodule: "submodule",
  MissingStage: "missingStage",
  Unsupported: "unsupported",
} as const;

export const GIT_CONFLICT_SIZE_CLASS = {
  Normal: "normal",
  Large: "large",
  VeryLarge: "veryLarge",
} as const;

export const GIT_CONFLICT_LINE_ENDING = {
  Lf: "lf",
  Crlf: "crlf",
  Mixed: "mixed",
  None: "none",
} as const;

export const GIT_CONFLICT_AI_SCOPE_KIND = {
  Region: "region",
  File: "file",
} as const;

export const GIT_CONFLICT_AI_CANDIDATE_KIND = {
  RegionReplacement: "regionReplacement",
  FullFileResult: "fullFileResult",
} as const;

export const GIT_CONFLICT_AI_DECISION_CHOICE = {
  Current: "current",
  Incoming: "incoming",
  Combination: "combination",
  Custom: "custom",
} as const;

export const GIT_CONFLICT_STALE_ERROR_CODE = "staleConflict";
export const GIT_CONFLICT_STALE_ERROR_MESSAGE =
  "Conflict state changed. Reload conflict details.";

export type GitConflictSide =
  (typeof GIT_CONFLICT_SIDE)[keyof typeof GIT_CONFLICT_SIDE];

export type GitConflictContentKind =
  (typeof GIT_CONFLICT_CONTENT_KIND)[keyof typeof GIT_CONFLICT_CONTENT_KIND];

export type GitConflictKind =
  (typeof GIT_CONFLICT_KIND)[keyof typeof GIT_CONFLICT_KIND];

export type GitConflictSizeClass =
  (typeof GIT_CONFLICT_SIZE_CLASS)[keyof typeof GIT_CONFLICT_SIZE_CLASS];

export type GitConflictLineEnding =
  (typeof GIT_CONFLICT_LINE_ENDING)[keyof typeof GIT_CONFLICT_LINE_ENDING];

export type GitConflictAiScopeKind =
  (typeof GIT_CONFLICT_AI_SCOPE_KIND)[keyof typeof GIT_CONFLICT_AI_SCOPE_KIND];

export type GitConflictAiCandidateKind =
  (typeof GIT_CONFLICT_AI_CANDIDATE_KIND)[keyof typeof GIT_CONFLICT_AI_CANDIDATE_KIND];

export type GitConflictAiDecisionChoice =
  (typeof GIT_CONFLICT_AI_DECISION_CHOICE)[keyof typeof GIT_CONFLICT_AI_DECISION_CHOICE];

export type GitConflictSize = {
  byteSize: number;
  lineCount: number;
  sizeClass: GitConflictSizeClass;
};

export type GitConflictVersion = {
  side: GitConflictSide;
  contentKind: GitConflictContentKind;
  text: string | null;
  size: GitConflictSize;
  lineEnding: GitConflictLineEnding;
  hasFinalNewline: boolean;
};

export type GitConflictRegion = {
  id: string;
  resultStartLine: number;
  resultSeparatorLine: number | null;
  resultEndLine: number;
};

export type GitConflictSignatures = {
  indexSignature: string;
  resultSignature: string;
};

export type GitConflictSummary = {
  path: string;
  status: ChangeType.Conflicted;
  conflictCount: number;
  conflictKinds: GitConflictKind[];
  contentKind: GitConflictContentKind;
  size: GitConflictSize;
  fileSignature: string;
};

export type GitConflictFileDetail = {
  path: string;
  status: ChangeType.Conflicted;
  base: GitConflictVersion | null;
  current: GitConflictVersion | null;
  incoming: GitConflictVersion | null;
  result: GitConflictVersion;
  regions: GitConflictRegion[];
  conflictKinds: GitConflictKind[];
  contentKind: GitConflictContentKind;
  signatures: GitConflictSignatures;
};

export type GitConflictContentRange = {
  path: string;
  side: GitConflictSide;
  startLine: number;
  lines: string[];
  totalLineCount: number;
  signature: string;
};

export type GitConflictAiCandidateScope =
  | {
      kind: typeof GIT_CONFLICT_AI_SCOPE_KIND.Region;
      filePath: string;
      regionId: string;
    }
  | {
      kind: typeof GIT_CONFLICT_AI_SCOPE_KIND.File;
      filePath: string;
    };

export type GitConflictAiDecision = {
  regionId: string;
  selectedChoice: GitConflictAiDecisionChoice;
  reason: string;
};

export type GitConflictAiCandidate =
  | {
      kind: typeof GIT_CONFLICT_AI_CANDIDATE_KIND.RegionReplacement;
      scope: Extract<
        GitConflictAiCandidateScope,
        { kind: typeof GIT_CONFLICT_AI_SCOPE_KIND.Region }
      >;
      summary: string;
      details?: string | null;
      replacement: string;
      decisions: GitConflictAiDecision[];
      inputSignatures: GitConflictSignatures;
    }
  | {
      kind: typeof GIT_CONFLICT_AI_CANDIDATE_KIND.FullFileResult;
      scope: Extract<
        GitConflictAiCandidateScope,
        { kind: typeof GIT_CONFLICT_AI_SCOPE_KIND.File }
      >;
      summary: string;
      details?: string | null;
      content: string;
      decisions: GitConflictAiDecision[];
      inputSignatures: GitConflictSignatures;
    };

export type GitConflictStaleError = {
  code: typeof GIT_CONFLICT_STALE_ERROR_CODE;
  message: typeof GIT_CONFLICT_STALE_ERROR_MESSAGE;
};
