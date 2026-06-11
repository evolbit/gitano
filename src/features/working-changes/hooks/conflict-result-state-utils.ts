import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_SIDE,
} from "@/shared/types/git-conflicts";
import type {
  GitConflictFileDetail,
  GitConflictSide,
} from "@/shared/types/git-conflicts";
import {
  buildConflictResultProjection,
  type ConflictResolutionRegion,
} from "../components/conflict-resolution-surface/utils/conflict-result-projection";

export const ACCEPTED_REGION_LABEL = {
  Combination: "Combination",
  Current: "Current",
  Incoming: "Incoming",
} as const;

export const MARK_RESOLVED_BLOCKED_REASON =
  "Resolve or remove remaining conflict markers before marking this file resolved.";

export const PENDING_REGIONS_BLOCKED_REASON =
  "Accept, edit, or remove the remaining conflict regions before marking this file resolved.";

export function resultProjectionFromDetail(
  detail: GitConflictFileDetail | null,
) {
  return buildConflictResultProjection({
    baseText: detail?.base?.text ?? null,
    regions: detail?.regions ?? [],
    resultText: detail?.result.text ?? "",
  });
}

export function pendingIdsForRegions(regions: ConflictResolutionRegion[]) {
  return new Set(regions.map((region) => region.id));
}

function lineEndingForText(text: string) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function combineRegionTexts(
  firstText: string,
  secondText: string,
  referenceText: string,
) {
  if (!firstText) return secondText;
  if (!secondText) return firstText;

  return [firstText, secondText].join(lineEndingForText(referenceText));
}

export function sideHasText(
  detail: GitConflictFileDetail | null,
  side: GitConflictSide,
) {
  return fileSideText(detail, side) !== null;
}

export function fileSideText(
  detail: GitConflictFileDetail | null,
  side: GitConflictSide,
) {
  const version =
    side === GIT_CONFLICT_SIDE.Current
      ? detail?.current
      : side === GIT_CONFLICT_SIDE.Incoming
        ? detail?.incoming
        : null;

  if (
    version?.contentKind === GIT_CONFLICT_CONTENT_KIND.Text &&
    version.text !== null
  ) {
    return version.text;
  }

  return null;
}
