import { GIT_CONFLICT_SIDE } from "@/shared/types/git-conflicts";
import type {
  GitConflictRegion,
  GitConflictSide,
} from "@/shared/types/git-conflicts";

export function splitConflictTextLines(text: string) {
  if (text.length === 0) return [""];

  return text.split(/\r\n|\n|\r/);
}

function joinLineEndingForText(text: string) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function isLineInConflictRegion(
  lineNumber: number,
  regions: GitConflictRegion[],
) {
  return regions.some(
    (region) =>
      lineNumber >= region.resultStartLine &&
      lineNumber <= region.resultEndLine,
  );
}

export function hasUnresolvedConflictMarkers(text: string) {
  let hasStart = false;
  let hasSeparator = false;

  for (const line of splitConflictTextLines(text)) {
    if (line.startsWith("<<<<<<<")) {
      hasStart = true;
      hasSeparator = false;
      continue;
    }

    if (hasStart && line.startsWith("=======")) {
      hasSeparator = true;
      continue;
    }

    if (hasStart && hasSeparator && line.startsWith(">>>>>>>")) {
      return true;
    }
  }

  return false;
}

export function replaceResultRegionWithSide(
  resultText: string,
  region: GitConflictRegion,
  side: GitConflictSide,
) {
  if (
    side !== GIT_CONFLICT_SIDE.Current &&
    side !== GIT_CONFLICT_SIDE.Incoming
  ) {
    return resultText;
  }

  const lines = splitConflictTextLines(resultText);
  const startIndex = region.resultStartLine - 1;
  const endIndex = region.resultEndLine - 1;
  const separatorIndex = region.resultSeparatorLine
    ? region.resultSeparatorLine - 1
    : -1;

  if (separatorIndex < startIndex || separatorIndex > endIndex) {
    return resultText;
  }

  const replacement =
    side === GIT_CONFLICT_SIDE.Current
      ? lines.slice(startIndex + 1, separatorIndex)
      : lines.slice(separatorIndex + 1, endIndex);
  const nextLines = [
    ...lines.slice(0, startIndex),
    ...replacement,
    ...lines.slice(endIndex + 1),
  ];

  return nextLines.join(joinLineEndingForText(resultText));
}

export function replaceResultRegionWithCombination(
  resultText: string,
  region: GitConflictRegion,
  firstSide: GitConflictSide,
) {
  if (
    firstSide !== GIT_CONFLICT_SIDE.Current &&
    firstSide !== GIT_CONFLICT_SIDE.Incoming
  ) {
    return resultText;
  }

  const lines = splitConflictTextLines(resultText);
  const startIndex = region.resultStartLine - 1;
  const endIndex = region.resultEndLine - 1;
  const separatorIndex = region.resultSeparatorLine
    ? region.resultSeparatorLine - 1
    : -1;

  if (separatorIndex < startIndex || separatorIndex > endIndex) {
    return resultText;
  }

  const currentLines = lines.slice(startIndex + 1, separatorIndex);
  const incomingLines = lines.slice(separatorIndex + 1, endIndex);
  const replacement =
    firstSide === GIT_CONFLICT_SIDE.Current
      ? [...currentLines, ...incomingLines]
      : [...incomingLines, ...currentLines];
  const nextLines = [
    ...lines.slice(0, startIndex),
    ...replacement,
    ...lines.slice(endIndex + 1),
  ];

  return nextLines.join(joinLineEndingForText(resultText));
}

export function replaceResultRegionWithContent(
  resultText: string,
  region: GitConflictRegion,
  replacementText: string,
) {
  const lines = splitConflictTextLines(resultText);
  const replacementLines = splitConflictTextLines(replacementText);
  const startIndex = region.resultStartLine - 1;
  const endIndex = region.resultEndLine - 1;

  if (startIndex < 0 || endIndex < startIndex || startIndex >= lines.length) {
    return resultText;
  }

  const nextLines = [
    ...lines.slice(0, startIndex),
    ...replacementLines,
    ...lines.slice(endIndex + 1),
  ];

  return nextLines.join(joinLineEndingForText(resultText));
}
