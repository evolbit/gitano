import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  acceptConflictSide,
  markConflictResolved,
  writeConflictResult,
} from "@/shared/api/git/conflicts";
import {
  GIT_CONFLICT_SIDE,
} from "@/shared/types/git-conflicts";
import type {
  GitConflictFileDetail,
  GitConflictSide,
} from "@/shared/types/git-conflicts";
import {
  type ConflictResolutionRegion,
  replaceProjectedResultRegionWithContent,
} from "../components/conflict-resolution-surface/utils/conflict-result-projection";
import { hasUnresolvedConflictMarkers } from "../components/conflict-resolution-surface/utils/conflict-text";
import {
  ACCEPTED_REGION_LABEL,
  combineRegionTexts,
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
  previousContent: string;
  previousPendingRegionIds: Set<string>;
  previousRegions: ConflictResolutionRegion[];
};

export function useConflictResultState({
  repoPath,
  filePath,
  detail,
  activeRegionIndex,
  onResolved,
}: UseConflictResultStateOptions) {
  const [workingDetail, setWorkingDetail] =
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
  const [acceptedRegionUndo, setAcceptedRegionUndo] =
    useState<AcceptedRegionUndo | null>(null);

  useEffect(() => {
    const projection = resultProjectionFromDetail(detail);

    setWorkingDetail(detail);
    setContent(projection.content);
    setResultRegions(projection.regions);
    setPendingRegionIds(pendingIdsForRegions(projection.regions));
    setDirty(false);
    setAcceptedRegionUndo(null);
  }, [detail]);

  const activeRegion = resultRegions[activeRegionIndex] ?? null;
  const acceptedRegionLabel =
    activeRegion && acceptedRegionUndo?.regionId === activeRegion.id
      ? acceptedRegionUndo.label
      : null;
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
    setAcceptedRegionUndo(null);
    return updated;
  }, []);

  const setResultContent = useCallback(
    (nextContent: string) => {
      setContent(nextContent);
      setDirty(true);
      setAcceptedRegionUndo(null);
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
      filePath,
      repoPath,
      workingDetail,
    ],
  );

  const applyRegionReplacement = useCallback(
    (
      regionId: string,
      replacementText: string,
      acceptedLabel?: string,
    ) => {
      const region = resultRegions.find((item) => item.id === regionId);
      if (!region) return;

      const nextProjection = replaceProjectedResultRegionWithContent({
        region,
        regions: resultRegions,
        replacementText,
        resultText: content,
      });
      const previousPendingRegionIds = new Set(pendingRegionIds);
      const nextPendingRegionIds = new Set(pendingRegionIds);
      nextPendingRegionIds.delete(region.id);

      setContent(nextProjection.content);
      setResultRegions(nextProjection.regions);
      setPendingRegionIds(nextPendingRegionIds);
      setDirty(true);
      setAcceptedRegionUndo(
        acceptedLabel
          ? {
              regionId: region.id,
              label: acceptedLabel,
              previousContent: content,
              previousPendingRegionIds,
              previousRegions: resultRegions,
            }
          : null,
      );
    },
    [content, pendingRegionIds, resultRegions],
  );

  const acceptRegionSide = useCallback(
    (side: GitConflictSide) => {
      if (!activeRegion) return;

      const incoming = side === GIT_CONFLICT_SIDE.Incoming;

      applyRegionReplacement(
        activeRegion.id,
        incoming ? activeRegion.incomingText : activeRegion.currentText,
        incoming
          ? ACCEPTED_REGION_LABEL.Incoming
          : ACCEPTED_REGION_LABEL.Current,
      );
    },
    [activeRegion, applyRegionReplacement],
  );

  const acceptCombination = useCallback(
    (firstSide: GitConflictSide) => {
      if (!activeRegion) return;

      const replacementText =
        firstSide === GIT_CONFLICT_SIDE.Current
          ? combineRegionTexts(
              activeRegion.currentText,
              activeRegion.incomingText,
              content,
            )
          : combineRegionTexts(
              activeRegion.incomingText,
              activeRegion.currentText,
              content,
            );

      applyRegionReplacement(
        activeRegion.id,
        replacementText,
        ACCEPTED_REGION_LABEL.Combination,
      );
    },
    [activeRegion, applyRegionReplacement, content],
  );

  const removeAcceptedRegionSide = useCallback(() => {
    if (!acceptedRegionUndo) return;

    setContent(acceptedRegionUndo.previousContent);
    setResultRegions(acceptedRegionUndo.previousRegions);
    setPendingRegionIds(acceptedRegionUndo.previousPendingRegionIds);
    setDirty(
      acceptedRegionUndo.previousContent !==
        resultProjectionFromDetail(workingDetail).content,
    );
    setAcceptedRegionUndo(null);
  }, [acceptedRegionUndo, workingDetail]);

  const acceptCurrentRegion = useCallback(
    () => acceptRegionSide(GIT_CONFLICT_SIDE.Current),
    [acceptRegionSide],
  );

  const acceptIncomingRegion = useCallback(
    () => acceptRegionSide(GIT_CONFLICT_SIDE.Incoming),
    [acceptRegionSide],
  );

  const acceptCurrentFirstCombination = useCallback(
    () => acceptCombination(GIT_CONFLICT_SIDE.Current),
    [acceptCombination],
  );

  const acceptIncomingFirstCombination = useCallback(
    () => acceptCombination(GIT_CONFLICT_SIDE.Incoming),
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
    acceptedRegionLabel,
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
    applyRegionReplacement,
    removeAcceptedRegionSide,
    acceptCurrentFile: () => acceptFileSide(GIT_CONFLICT_SIDE.Current),
    acceptIncomingFile: () => acceptFileSide(GIT_CONFLICT_SIDE.Incoming),
    markResolved,
  };
}
