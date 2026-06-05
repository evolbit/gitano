import { useCallback, useMemo, useState } from "react";
import { runLocalAiAction } from "@/shared/api/local-ai";
import {
  GIT_CONFLICT_AI_CANDIDATE_KIND,
  GIT_CONFLICT_AI_SCOPE_KIND,
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_SIZE_CLASS,
} from "@/shared/types/git-conflicts";
import { isAiSetupRequiredError } from "@/shared/utils/ai-setup-errors";
import type { ConflictResolutionRegion } from "../components/conflict-resolution-surface/utils/conflict-result-projection";
import type {
  GitConflictAiCandidate,
  GitConflictAiCandidateScope,
  GitConflictFileDetail,
  GitConflictRegion,
  GitConflictSignatures,
} from "@/shared/types/git-conflicts";

type ConflictAiScopeKind =
  (typeof GIT_CONFLICT_AI_SCOPE_KIND)[keyof typeof GIT_CONFLICT_AI_SCOPE_KIND];

type UseConflictAiFixOptions = {
  repoPath: string;
  filePath: string;
  detail: GitConflictFileDetail | null;
  activeRegion: GitConflictRegion | null;
  resultRegions: ConflictResolutionRegion[];
  onApplyFileContent: (content: string) => void;
  onApplyRegionContent: (regionId: string, content: string) => void;
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

function candidateSummary(candidate: GitConflictAiCandidate | null) {
  if (!candidate) return null;
  return candidate.summary.trim() || "AI conflict candidate";
}

export function useConflictAiFix({
  repoPath,
  filePath,
  detail,
  activeRegion,
  resultRegions,
  onApplyFileContent,
  onApplyRegionContent,
}: UseConflictAiFixOptions) {
  const [candidate, setCandidate] = useState<GitConflictAiCandidate | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupReason, setSetupReason] = useState<string | null>(null);
  const [lastScopeKind, setLastScopeKind] =
    useState<ConflictAiScopeKind | null>(null);

  const canRunRegion =
    Boolean(activeRegion) &&
    detail?.result.contentKind === GIT_CONFLICT_CONTENT_KIND.Text;
  const canRunFile =
    detail?.result.contentKind === GIT_CONFLICT_CONTENT_KIND.Text &&
    detail.result.size.sizeClass !== GIT_CONFLICT_SIZE_CLASS.VeryLarge;

  const runFix = useCallback(
    async (scopeKind: ConflictAiScopeKind, forceRefresh = false) => {
      if (!detail) return;
      if (scopeKind === GIT_CONFLICT_AI_SCOPE_KIND.Region && !activeRegion) {
        return;
      }

      const conflictScope: GitConflictAiCandidateScope =
        scopeKind === GIT_CONFLICT_AI_SCOPE_KIND.Region
          ? {
              kind: GIT_CONFLICT_AI_SCOPE_KIND.Region,
              filePath,
              regionId: activeRegion?.id ?? "",
            }
          : {
              kind: GIT_CONFLICT_AI_SCOPE_KIND.File,
              filePath,
            };
      const runId = createConflictAiRunId(scopeKind);
      setLoading(true);
      setError(null);
      setCandidate(null);
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

        setCandidate(result.result.data.candidate);
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
    [activeRegion, detail, filePath, repoPath],
  );

  const applyCandidate = useCallback(() => {
    if (!candidate || !detail) return;
    if (!signaturesMatch(candidate.inputSignatures, detail.signatures)) {
      setError("AI candidate is stale. Refresh conflict detail or rerun AI.");
      return;
    }

    if (candidate.kind === GIT_CONFLICT_AI_CANDIDATE_KIND.FullFileResult) {
      onApplyFileContent(candidate.content);
      setCandidate(null);
      setError(null);
      return;
    }

    const region = resultRegions.find(
      (item) => item.id === candidate.scope.regionId,
    );
    if (!region) {
      setError("AI candidate target is no longer available. Rerun AI.");
      return;
    }

    onApplyRegionContent(region.id, candidate.replacement);
    setCandidate(null);
    setError(null);
  }, [
    candidate,
    detail,
    onApplyFileContent,
    onApplyRegionContent,
    resultRegions,
  ]);

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
    setError(null);
  }, []);

  return useMemo(
    () => ({
      candidate,
      candidateSummary: candidateSummary(candidate),
      loading,
      error,
      setupOpen,
      setupReason,
      canRunRegion,
      canRunFile,
      runRegionFix: (forceRefresh = false) =>
        runFix(GIT_CONFLICT_AI_SCOPE_KIND.Region, forceRefresh),
      runFileFix: (forceRefresh = false) =>
        runFix(GIT_CONFLICT_AI_SCOPE_KIND.File, forceRefresh),
      applyCandidate,
      clearCandidate,
      closeSetup,
      retryAfterSetup,
    }),
    [
      applyCandidate,
      candidate,
      canRunFile,
      canRunRegion,
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
