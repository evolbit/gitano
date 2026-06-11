import { GIT_CONFLICT_SIDE } from "@/shared/types/git-conflicts";
import type {
  GitConflictRegion,
  GitConflictSide,
} from "@/shared/types/git-conflicts";
import type { ConflictResolutionRegion } from "./conflict-result-projection";
import { splitConflictTextLines } from "./conflict-text";

function splitSideTextLines(text: string) {
  if (text.length === 0) return [];

  return splitConflictTextLines(text);
}

function findSequenceFrom(
  lines: string[],
  sequence: string[],
  startIndex: number,
) {
  if (sequence.length === 0) return null;

  for (
    let index = Math.max(0, startIndex);
    index <= lines.length - sequence.length;
    index += 1
  ) {
    let matched = true;

    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (lines[index + offset] !== sequence[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) return index;
  }

  return null;
}

function sideTextForRegion(
  region: ConflictResolutionRegion,
  side: GitConflictSide,
) {
  if (side === GIT_CONFLICT_SIDE.Current) return region.currentText;
  if (side === GIT_CONFLICT_SIDE.Incoming) return region.incomingText;

  return "";
}

function fallbackRegion(region: ConflictResolutionRegion): GitConflictRegion {
  return {
    id: region.id,
    resultStartLine: region.resultStartLine,
    resultSeparatorLine: null,
    resultEndLine: region.resultEndLine,
  };
}

export function buildSidePaneRegions({
  regions,
  side,
  sideText,
}: {
  regions: ConflictResolutionRegion[];
  side: GitConflictSide;
  sideText: string | null;
}): GitConflictRegion[] {
  if (!sideText) return regions.map(fallbackRegion);

  const sideLines = splitConflictTextLines(sideText);
  let searchCursor = 0;

  return regions.map((region) => {
    const targetLines = splitSideTextLines(sideTextForRegion(region, side));
    const matchIndex = findSequenceFrom(sideLines, targetLines, searchCursor);

    if (matchIndex === null) {
      return fallbackRegion(region);
    }

    searchCursor = matchIndex + targetLines.length;

    return {
      id: region.id,
      resultStartLine: matchIndex + 1,
      resultSeparatorLine: null,
      resultEndLine: matchIndex + targetLines.length,
    };
  });
}
