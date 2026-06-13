import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  acceptConflictSide,
  markConflictResolved,
  writeConflictResult,
} from "@/shared/api/git/conflicts";
import {
  GIT_CONFLICT_AI_DECISION_CHOICE,
  GIT_CONFLICT_SIDE,
} from "@/shared/types/git-conflicts";
import type {
  GitConflictAiDecision,
  GitConflictFileDetail,
  GitConflictSide,
} from "@/shared/types/git-conflicts";
import { replaceProjectedResultRegionWithContent } from "../components/conflict-resolution-surface/utils/conflict-result-projection";
import { hasUnresolvedConflictMarkers } from "../components/conflict-resolution-surface/utils/conflict-text";
import {
  ACCEPTED_REGION_LABEL,
  combineRegionTexts,
  fileSideText,
  MARK_RESOLVED_BLOCKED_REASON,
  pendingIdsForRegions,
  PENDING_REGIONS_BLOCKED_REASON,
  resultProjectionFromDetail,
  sideHasText,
} from "./conflict-result-state-utils";

type UseConflictResultStateOptions = {
  repoPath: string;
  filePath: string;
  detail: GitConflictFileDetail | null;
  activeRegionIndex: number;
  onResolved?: () => void;
};

type AcceptedRegionUndo = {
  regionId: string;
  label: string;
  side: GitConflictSide | null;
};

function acceptedRegionFromAiDecision(
  regionId: string,
  decision: GitConflictAiDecision | null,
): AcceptedRegionUndo {
  if (!decision) {
    return {
      regionId,
      label: ACCEPTED_REGION_LABEL.Ai,
      side: null,
    };
  }

  switch (decision.selectedChoice) {
    case GIT_CONFLICT_AI_DECISION_CHOICE.Current:
      return {
        regionId,
        label: ACCEPTED_REGION_LABEL.Current,
        side: GIT_CONFLICT_SIDE.Current,
      };
    case GIT_CONFLICT_AI_DECISION_CHOICE.Incoming:
      return {
        regionId,
        label: ACCEPTED_REGION_LABEL.Incoming,
        side: GIT_CONFLICT_SIDE.Incoming,
      };
    case GIT_CONFLICT_AI_DECISION_CHOICE.Combination:
      return {
        regionId,
        label: ACCEPTED_REGION_LABEL.Combination,
        side: null,
      };
    case GIT_CONFLICT_AI_DECISION_CHOICE.Custom:
    default:
      return {
        regionId,
        label: ACCEPTED_REGION_LABEL.Ai,
        side: null,
      };
  }
}

export function useConflictResultState({
  repoPath,
  filePath,
  detail,
  activeRegionIndex,
  onResolved,
}: UseConflictResultStateOptions) {
  const [workingDetail, setWorkingDetail] =
    useState<GitConflictFileDetail | null>(detail);
  const [resetDetail, setResetDetail] =
    useState<GitConflictFileDetail | null>(detail);
  const [content, setContent] = useState(
    () => resultProjectionFromDetail(detail).content,
  );
  const [resultRegions, setResultRegions] = useState(
    () => resultProjectionFromDetail(detail).regions,
  );
  const [pendingRegionIds, setPendingRegionIds] = useState(() =>
    pendingIdsForRegions(resultProjectionFromDetail(detail).regions),
  );
  const [dirty, setDirty] = useState(false);
  const [acceptedRegionUndoById, setAcceptedRegionUndoById] = useState<
    Record<string, AcceptedRegionUndo>
  >({});

  useEffect(() => {
    const projection = resultProjectionFromDetail(detail);

    setWorkingDetail(detail);
    setResetDetail(detail);
    setContent(projection.content);
    setResultRegions(projection.regions);
    setPendingRegionIds(pendingIdsForRegions(projection.regions));
    setDirty(false);
    setAcceptedRegionUndoById({});
  }, [detail]);

  const activeRegion = resultRegions[activeRegionIndex] ?? null;
  const activeAcceptedRegion = activeRegion
    ? acceptedRegionUndoById[activeRegion.id]
    : null;
  const acceptedRegion = activeAcceptedRegion
    ? {
        regionId: activeAcceptedRegion.regionId,
        label: activeAcceptedRegion.label,
      }
    : null;
  const acceptedRegionSide = activeAcceptedRegion?.side ?? null;
  const acceptedRegions = Object.values(acceptedRegionUndoById).map(
    (region) => ({
      regionId: region.regionId,
      label: region.label,
    }),
  );
  const acceptedRegionSidesById = Object.fromEntries(
    Object.values(acceptedRegionUndoById).map((region) => [
      region.regionId,
      region.side,
    ]),
  );
  const canAcceptRegion = Boolean(activeRegion && workingDetail?.result.text);
  const canAcceptFile =
    sideHasText(workingDetail, GIT_CONFLICT_SIDE.Current) ||
    sideHasText(workingDetail, GIT_CONFLICT_SIDE.Incoming);
  const markResolvedBlockedReason = hasUnresolvedConflictMarkers(content)
    ? MARK_RESOLVED_BLOCKED_REASON
    : pendingRegionIds.size > 0
      ? PENDING_REGIONS_BLOCKED_REASON
      : null;

  const writeMutation = useMutation({
    mutationFn: writeConflictResult,
  });
  const acceptSideMutation = useMutation({
    mutationFn: acceptConflictSide,
  });
  const markResolvedMutation = useMutation({
    mutationFn: markConflictResolved,
  });

  const applyUpdatedDetail = useCallback((updated: GitConflictFileDetail) => {
    const projection = resultProjectionFromDetail(updated);

    setWorkingDetail(updated);
    setContent(projection.content);
    setResultRegions(projection.regions);
    setPendingRegionIds(pendingIdsForRegions(projection.regions));
    setDirty(false);
    setAcceptedRegionUndoById({});
    return updated;
  }, []);

  const setResultContent = useCallback(
    (nextContent: string) => {
      setContent(nextContent);
      setDirty(true);
      setAcceptedRegionUndoById({});
      setPendingRegionIds((current) => {
        if (!activeRegion || !current.has(activeRegion.id)) return current;

        const next = new Set(current);
        next.delete(activeRegion.id);
        return next;
      });
    },
    [activeRegion],
  );

  const saveResult = useCallback(async () => {
    if (!workingDetail) return null;

    const updated = await writeMutation.mutateAsync({
      repoPath,
      filePath,
      content,
      expectedIndexSignature: workingDetail.signatures.indexSignature,
      expectedResultSignature: workingDetail.signatures.resultSignature,
    });

    return applyUpdatedDetail(updated);
  }, [applyUpdatedDetail, content, filePath, repoPath, workingDetail, writeMutation]);

  const acceptFileSide = useCallback(
    async (side: GitConflictSide) => {
      if (!workingDetail) return null;

      const acceptedText = fileSideText(workingDetail, side);
      if (acceptedText !== null) {
        if (resultRegions.length === 0) {
          setContent(acceptedText);
          setResultRegions([]);
          setPendingRegionIds(new Set<string>());
          setDirty(true);
          setAcceptedRegionUndoById({});
          return workingDetail;
        }

        let nextContent = content;
        let nextRegions = resultRegions;
        const nextPendingRegionIds = new Set(pendingRegionIds);
        const acceptedLabel =
          side === GIT_CONFLICT_SIDE.Incoming
            ? ACCEPTED_REGION_LABEL.Incoming
            : ACCEPTED_REGION_LABEL.Current;
        const nextAcceptedRegions: Record<string, AcceptedRegionUndo> = {};

        resultRegions.forEach((region) => {
          const targetRegion = nextRegions.find((item) => item.id === region.id);
          if (!targetRegion) return;

          const replacementText =
            side === GIT_CONFLICT_SIDE.Incoming
              ? targetRegion.incomingText
              : targetRegion.currentText;
          const nextProjection = replaceProjectedResultRegionWithContent({
            region: targetRegion,
            regions: nextRegions,
            replacementText,
            resultText: nextContent,
          });

          nextContent = nextProjection.content;
          nextRegions = nextProjection.regions;
          nextPendingRegionIds.delete(region.id);
          nextAcceptedRegions[region.id] = {
            regionId: region.id,
            label: acceptedLabel,
            side,
          };
        });

        setContent(nextContent);
        setResultRegions(nextRegions);
        setPendingRegionIds(nextPendingRegionIds);
        setDirty(true);
        setAcceptedRegionUndoById(nextAcceptedRegions);
        return workingDetail;
      }

      const updated = await acceptSideMutation.mutateAsync({
        repoPath,
        filePath,
        side,
        expectedIndexSignature: workingDetail.signatures.indexSignature,
        expectedResultSignature: workingDetail.signatures.resultSignature,
      });

      return applyUpdatedDetail(updated);
    },
    [
      acceptSideMutation,
      applyUpdatedDetail,
      content,
      filePath,
      pendingRegionIds,
      repoPath,
      resultRegions,
      workingDetail,
    ],
  );

  const applyRegionReplacement = useCallback(
    (
      regionId: string,
      replacementText: string,
      acceptedLabel?: string,
      acceptedSide: GitConflictSide | null = null,
    ) => {
      const region = resultRegions.find((item) => item.id === regionId);
      if (!region) return;

      const nextProjection = replaceProjectedResultRegionWithContent({
        region,
        regions: resultRegions,
        replacementText,
        resultText: content,
      });
      const nextPendingRegionIds = new Set(pendingRegionIds);
      nextPendingRegionIds.delete(region.id);

      setContent(nextProjection.content);
      setResultRegions(nextProjection.regions);
      setPendingRegionIds(nextPendingRegionIds);
      setDirty(true);
      setAcceptedRegionUndoById((current) => {
        const next = { ...current };

        if (acceptedLabel) {
          next[region.id] = {
            regionId: region.id,
            label: acceptedLabel,
            side: acceptedSide,
          };
        } else {
          delete next[region.id];
        }

        return next;
      });
    },
    [content, pendingRegionIds, resultRegions],
  );

  const applyAiFileResult = useCallback(
    (nextContent: string, decisions: GitConflictAiDecision[]) => {
      const decisionsByRegionId = new Map(
        decisions.map((decision) => [decision.regionId, decision]),
      );
      const nextAcceptedRegions = Object.fromEntries(
        resultRegions.map((region) => [
          region.id,
          acceptedRegionFromAiDecision(
            region.id,
            decisionsByRegionId.get(region.id) ?? null,
          ),
        ]),
      );

      setContent(nextContent);
      setPendingRegionIds(new Set<string>());
      setDirty(true);
      setAcceptedRegionUndoById(nextAcceptedRegions);
    },
    [resultRegions],
  );

  const acceptRegionSide = useCallback(
    (side: GitConflictSide, regionId?: string) => {
      const targetRegion = regionId
        ? resultRegions.find((region) => region.id === regionId)
        : activeRegion;
      if (!targetRegion) return;

      const incoming = side === GIT_CONFLICT_SIDE.Incoming;

      applyRegionReplacement(
        targetRegion.id,
        incoming ? targetRegion.incomingText : targetRegion.currentText,
        incoming
          ? ACCEPTED_REGION_LABEL.Incoming
          : ACCEPTED_REGION_LABEL.Current,
        side,
      );
    },
    [activeRegion, applyRegionReplacement, resultRegions],
  );

  const acceptCombination = useCallback(
    (firstSide: GitConflictSide, regionId?: string) => {
      const targetRegion = regionId
        ? resultRegions.find((region) => region.id === regionId)
        : activeRegion;
      if (!targetRegion) return;

      const replacementText =
        firstSide === GIT_CONFLICT_SIDE.Current
          ? combineRegionTexts(
              targetRegion.currentText,
              targetRegion.incomingText,
              content,
            )
          : combineRegionTexts(
              targetRegion.incomingText,
              targetRegion.currentText,
              content,
            );

      applyRegionReplacement(
        targetRegion.id,
        replacementText,
        ACCEPTED_REGION_LABEL.Combination,
        null,
      );
    },
    [activeRegion, applyRegionReplacement, content, resultRegions],
  );

  const removeAcceptedRegionSide = useCallback(
    (regionId?: string) => {
      const targetRegionId = regionId ?? acceptedRegion?.regionId;
      const region = resultRegions.find((item) => item.id === targetRegionId);
      if (!region) return;

      const nextProjection = replaceProjectedResultRegionWithContent({
        region,
        regions: resultRegions,
        replacementText: region.unresolvedText,
        resultText: content,
      });
      const nextPendingRegionIds = new Set(pendingRegionIds);
      nextPendingRegionIds.add(region.id);

      setContent(nextProjection.content);
      setResultRegions(nextProjection.regions);
      setPendingRegionIds(nextPendingRegionIds);
      setDirty(
        nextProjection.content !== resultProjectionFromDetail(workingDetail).content,
      );
      setAcceptedRegionUndoById((current) => {
        const next = { ...current };
        delete next[region.id];
        return next;
      });
    },
    [acceptedRegion, content, pendingRegionIds, resultRegions, workingDetail],
  );

  const resetResult = useCallback(() => {
    if (!resetDetail) return;

    const projection = resultProjectionFromDetail(resetDetail);
    const currentProjection = resultProjectionFromDetail(workingDetail);
    const latestSignatures =
      workingDetail?.signatures ?? resetDetail.signatures;

    setWorkingDetail({
      ...resetDetail,
      signatures: latestSignatures,
    });
    setContent(projection.content);
    setResultRegions(projection.regions);
    setPendingRegionIds(pendingIdsForRegions(projection.regions));
    setDirty(projection.content !== currentProjection.content);
    setAcceptedRegionUndoById({});
  }, [resetDetail, workingDetail]);

  const acceptCurrentRegion = useCallback(
    (regionId?: string) => acceptRegionSide(GIT_CONFLICT_SIDE.Current, regionId),
    [acceptRegionSide],
  );

  const acceptIncomingRegion = useCallback(
    (regionId?: string) => acceptRegionSide(GIT_CONFLICT_SIDE.Incoming, regionId),
    [acceptRegionSide],
  );

  const acceptCurrentFirstCombination = useCallback(
    (regionId?: string) =>
      acceptCombination(GIT_CONFLICT_SIDE.Current, regionId),
    [acceptCombination],
  );

  const acceptIncomingFirstCombination = useCallback(
    (regionId?: string) =>
      acceptCombination(GIT_CONFLICT_SIDE.Incoming, regionId),
    [acceptCombination],
  );

  const markResolved = useCallback(async () => {
    if (hasUnresolvedConflictMarkers(content) || pendingRegionIds.size > 0) {
      return;
    }

    let detailForResolve = workingDetail;

    if (dirty) {
      detailForResolve = await saveResult();
    }

    if (!detailForResolve) return;

    await markResolvedMutation.mutateAsync({
      repoPath,
      filePath,
      expectedIndexSignature: detailForResolve.signatures.indexSignature,
      expectedResultSignature: detailForResolve.signatures.resultSignature,
    });
    onResolved?.();
  }, [
    dirty,
    filePath,
    content,
    pendingRegionIds.size,
    markResolvedMutation,
    onResolved,
    repoPath,
    saveResult,
    workingDetail,
  ]);

  const actionInFlight = useMemo(
    () =>
      writeMutation.isPending ||
      acceptSideMutation.isPending ||
      markResolvedMutation.isPending,
    [
      acceptSideMutation.isPending,
      markResolvedMutation.isPending,
      writeMutation.isPending,
    ],
  );

  return {
    detail: workingDetail,
    content,
    resultRegions,
    dirty,
    acceptedRegion,
    acceptedRegionSide,
    acceptedRegions,
    acceptedRegionSidesById,
    canAcceptRegion,
    canAcceptFile,
    markResolvedBlockedReason,
    actionInFlight,
    setResultContent,
    saveResult,
    acceptCurrentRegion,
    acceptIncomingRegion,
    acceptCurrentFirstCombination,
    acceptIncomingFirstCombination,
    applyAiFileResult,
    applyRegionReplacement,
    removeAcceptedRegionSide,
    resetResult,
    acceptCurrentFile: () => acceptFileSide(GIT_CONFLICT_SIDE.Current),
    acceptIncomingFile: () => acceptFileSide(GIT_CONFLICT_SIDE.Incoming),
    markResolved,
  };
}
