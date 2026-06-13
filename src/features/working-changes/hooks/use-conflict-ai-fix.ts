import { useCallback, useMemo, useState } from "react";
import { runLocalAiAction } from "@/shared/api/local-ai";
import {
  GIT_CONFLICT_AI_CANDIDATE_KIND,
  GIT_CONFLICT_AI_DECISION_CHOICE,
  GIT_CONFLICT_AI_SCOPE_KIND,
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_SIZE_CLASS,
} from "@/shared/types/git-conflicts";
import { isAiSetupRequiredError } from "@/shared/utils/ai-setup-errors";
import type {
  GitConflictAiCandidate,
  GitConflictAiCandidateScope,
  GitConflictAiDecision,
  GitConflictAiDecisionChoice,
  GitConflictFileDetail,
  GitConflictSignatures,
} from "@/shared/types/git-conflicts";

type ConflictAiScopeKind =
  (typeof GIT_CONFLICT_AI_SCOPE_KIND)[keyof typeof GIT_CONFLICT_AI_SCOPE_KIND];

type UseConflictAiFixOptions = {
  repoPath: string;
  filePath: string;
  detail: GitConflictFileDetail | null;
  onApplyFileContent: (content: string, decisions: GitConflictAiDecision[]) => void;
};

type LegacyConflictAiCandidate = GitConflictAiCandidate & {
  input_signatures?: GitConflictSignatures;
};

function createConflictAiRunId(scopeKind: ConflictAiScopeKind) {
  return `conflict-${scopeKind}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function signaturesMatch(
  expected: GitConflictSignatures,
  actual: GitConflictSignatures,
) {
  return (
    expected.indexSignature === actual.indexSignature &&
    expected.resultSignature === actual.resultSignature
  );
}

function candidateInputSignatures(candidate: GitConflictAiCandidate) {
  return (
    candidate.inputSignatures ??
    (candidate as LegacyConflictAiCandidate).input_signatures ??
    null
  );
}

function candidateSummary(candidate: GitConflictAiCandidate | null) {
  if (!candidate) return null;
  return candidate.summary.trim() || "AI conflict candidate";
}

function decisionChoiceLabel(choice: GitConflictAiDecisionChoice) {
  switch (choice) {
    case GIT_CONFLICT_AI_DECISION_CHOICE.Current:
      return "Current";
    case GIT_CONFLICT_AI_DECISION_CHOICE.Incoming:
      return "Incoming";
    case GIT_CONFLICT_AI_DECISION_CHOICE.Combination:
      return "Combination";
    case GIT_CONFLICT_AI_DECISION_CHOICE.Custom:
    default:
      return "Custom";
  }
}

function decisionDetails(decisions: GitConflictAiDecision[]) {
  return decisions
    .map((decision) => {
      const reason = decision.reason.trim();
      return `${decision.regionId}: ${decisionChoiceLabel(decision.selectedChoice)}${
        reason ? ` - ${reason}` : ""
      }`;
    })
    .join("\n");
}

function candidateDetails(candidate: GitConflictAiCandidate | null) {
  if (!candidate) return null;

  const explicitDetails = candidate.details?.trim();
  if (explicitDetails) return explicitDetails;

  const details = decisionDetails(candidate.decisions);
  return details || null;
}

function appliedDecisionSummary(summary: string) {
  return summary.trim() || "AI applied a full-file resolution.";
}

export function useConflictAiFix({
  repoPath,
  filePath,
  detail,
  onApplyFileContent,
}: UseConflictAiFixOptions) {
  const [candidate, setCandidate] = useState<GitConflictAiCandidate | null>(
    null,
  );
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);
  const [appliedDetails, setAppliedDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupReason, setSetupReason] = useState<string | null>(null);
  const [lastScopeKind, setLastScopeKind] =
    useState<ConflictAiScopeKind | null>(null);

  const canRunFile =
    detail?.result.contentKind === GIT_CONFLICT_CONTENT_KIND.Text &&
    detail.result.size.sizeClass !== GIT_CONFLICT_SIZE_CLASS.VeryLarge;

  const runFix = useCallback(
    async (scopeKind: ConflictAiScopeKind, forceRefresh = false) => {
      if (!detail) return;
      if (scopeKind !== GIT_CONFLICT_AI_SCOPE_KIND.File) {
        return;
      }

      const conflictScope: GitConflictAiCandidateScope = {
        kind: GIT_CONFLICT_AI_SCOPE_KIND.File,
        filePath,
      };
      const runId = createConflictAiRunId(scopeKind);
      setLoading(true);
      setError(null);
      setCandidate(null);
      setAppliedSummary(null);
      setAppliedDetails(null);
      setLastScopeKind(scopeKind);

      try {
        const result = await runLocalAiAction({
          repoPath,
          actionKind: "mergeConflictSuggestions",
          runId,
          forceRefresh,
          conflictScope,
        });

        if (result.result.kind !== "conflictCandidate") {
          throw new Error("AI did not return a reviewable conflict candidate.");
        }

        const nextCandidate = result.result.data.candidate;
        if (nextCandidate.kind !== GIT_CONFLICT_AI_CANDIDATE_KIND.FullFileResult) {
          throw new Error("AI did not return a full-file conflict resolution.");
        }
        const inputSignatures = candidateInputSignatures(nextCandidate);
        if (!inputSignatures) {
          throw new Error("AI candidate is missing conflict signatures. Rerun AI.");
        }
        if (!signaturesMatch(inputSignatures, detail.signatures)) {
          throw new Error("AI candidate is stale. Refresh conflict detail or rerun AI.");
        }

        onApplyFileContent(nextCandidate.content, nextCandidate.decisions);
        setAppliedSummary(appliedDecisionSummary(nextCandidate.summary));
        setAppliedDetails(candidateDetails(nextCandidate));
      } catch (actionError) {
        if (isAiSetupRequiredError(actionError)) {
          setSetupReason(
            actionError instanceof Error
              ? actionError.message
              : String(actionError || ""),
          );
          setSetupOpen(true);
        } else {
          setError(
            actionError instanceof Error
              ? actionError.message
              : String(actionError || "AI conflict fix failed."),
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [detail, filePath, onApplyFileContent, repoPath],
  );

  const closeSetup = useCallback(() => {
    setSetupOpen(false);
  }, []);

  const retryAfterSetup = useCallback(() => {
    if (!lastScopeKind) {
      setSetupOpen(false);
      return;
    }

    setSetupOpen(false);
    void runFix(lastScopeKind, true);
  }, [lastScopeKind, runFix]);

  const clearCandidate = useCallback(() => {
    setCandidate(null);
    setAppliedSummary(null);
    setAppliedDetails(null);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      candidate,
      candidateSummary: appliedSummary ?? candidateSummary(candidate),
      candidateDetails: appliedDetails ?? candidateDetails(candidate),
      loading,
      error,
      setupOpen,
      setupReason,
      canRunFile,
      runFileFix: (forceRefresh = false) =>
        runFix(GIT_CONFLICT_AI_SCOPE_KIND.File, forceRefresh),
      clearCandidate,
      closeSetup,
      retryAfterSetup,
    }),
    [
      appliedSummary,
      appliedDetails,
      candidate,
      canRunFile,
      clearCandidate,
      closeSetup,
      error,
      loading,
      retryAfterSetup,
      runFix,
      setupOpen,
      setupReason,
    ],
  );
}
