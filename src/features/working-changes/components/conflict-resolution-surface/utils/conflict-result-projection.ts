import { GIT_CONFLICT_SIDE } from "@/shared/types/git-conflicts";
import type {
  GitConflictRegion,
  GitConflictSide,
} from "@/shared/types/git-conflicts";
import { splitConflictTextLines } from "./conflict-text";

const CONFLICT_CONTEXT_LINE_COUNT = 4;

export type ConflictResolutionRegion = GitConflictRegion & {
  baseText: string;
  currentText: string;
  incomingText: string;
  paddingLineCount: number;
  unresolvedText: string;
};

export type ConflictResultProjection = {
  content: string;
  regions: ConflictResolutionRegion[];
};

function splitReplacementTextLines(text: string) {
  if (text.length === 0) return [];

  return splitConflictTextLines(text);
}

function joinLineEndingForText(text: string) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function linesToText(lines: string[], referenceText: string) {
  return lines.join(joinLineEndingForText(referenceText));
}

function textLineCount(text: string) {
  return splitReplacementTextLines(text).length;
}

function conflictPaddingLineCount({
  currentText,
  incomingText,
  visibleLineCount,
}: {
  currentText: string;
  incomingText: string;
  visibleLineCount: number;
}) {
  return Math.max(
    0,
    Math.max(textLineCount(currentText), textLineCount(incomingText)) -
      visibleLineCount,
  );
}

function findSequenceFrom(
  lines: string[],
  sequence: string[],
  startIndex: number,
) {
  if (sequence.length === 0) return startIndex;

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

function findBaseRegionStart(
  baseLines: string[],
  beforeContext: string[],
  baseCursor: number,
) {
  for (
    let contextStart = 0;
    contextStart < beforeContext.length;
    contextStart += 1
  ) {
    const context = beforeContext.slice(contextStart);
    const matchIndex = findSequenceFrom(baseLines, context, baseCursor);

    if (matchIndex !== null) {
      return matchIndex + context.length;
    }
  }

  return baseCursor;
}

function findBaseRegionEnd(
  baseLines: string[],
  afterContext: string[],
  baseStart: number,
) {
  if (afterContext.length === 0) return baseLines.length;

  for (
    let contextLength = afterContext.length;
    contextLength > 0;
    contextLength -= 1
  ) {
    const context = afterContext.slice(0, contextLength);
    const matchIndex = findSequenceFrom(baseLines, context, baseStart);

    if (matchIndex !== null) {
      return matchIndex;
    }
  }

  return baseStart;
}

function markerRegionSideText(
  resultLines: string[],
  region: GitConflictRegion,
  side: GitConflictSide,
  referenceText: string,
) {
  const startIndex = region.resultStartLine - 1;
  const endIndex = region.resultEndLine - 1;
  const separatorIndex = region.resultSeparatorLine
    ? region.resultSeparatorLine - 1
    : -1;

  if (separatorIndex < startIndex || separatorIndex > endIndex) {
    return "";
  }

  const lines =
    side === GIT_CONFLICT_SIDE.Current
      ? resultLines.slice(startIndex + 1, separatorIndex)
      : resultLines.slice(separatorIndex + 1, endIndex);

  return linesToText(lines, referenceText);
}

function rawResolutionRegions(
  resultText: string,
  regions: GitConflictRegion[],
): ConflictResolutionRegion[] {
  const resultLines = splitConflictTextLines(resultText);

  return regions.map((region) => {
    const currentText = markerRegionSideText(
      resultLines,
      region,
      GIT_CONFLICT_SIDE.Current,
      resultText,
    );
    const incomingText = markerRegionSideText(
      resultLines,
      region,
      GIT_CONFLICT_SIDE.Incoming,
      resultText,
    );
    const visibleLineCount = region.resultEndLine - region.resultStartLine + 1;

    return {
      ...region,
      baseText: "",
      currentText,
      incomingText,
      paddingLineCount: conflictPaddingLineCount({
        currentText,
        incomingText,
        visibleLineCount,
      }),
      unresolvedText: linesToText(
        resultLines.slice(region.resultStartLine - 1, region.resultEndLine),
        resultText,
      ),
    };
  });
}

export function buildConflictResultProjection({
  baseText,
  regions,
  resultText,
}: {
  baseText: string | null;
  regions: GitConflictRegion[];
  resultText: string;
}): ConflictResultProjection {
  if (!baseText || regions.length === 0) {
    return {
      content: resultText,
      regions: rawResolutionRegions(resultText, regions),
    };
  }

  const resultLines = splitConflictTextLines(resultText);
  const baseLines = splitConflictTextLines(baseText);
  const outputLines: string[] = [];
  const projectedRegions: ConflictResolutionRegion[] = [];
  let rawCursor = 0;
  let baseCursor = 0;

  for (const region of regions) {
    const startIndex = region.resultStartLine - 1;
    const endIndex = region.resultEndLine - 1;

    outputLines.push(...resultLines.slice(rawCursor, startIndex));

    const beforeContext = resultLines.slice(
      Math.max(rawCursor, startIndex - CONFLICT_CONTEXT_LINE_COUNT),
      startIndex,
    );
    const afterContext = resultLines.slice(
      endIndex + 1,
      Math.min(resultLines.length, endIndex + 1 + CONFLICT_CONTEXT_LINE_COUNT),
    );
    const baseStart = findBaseRegionStart(baseLines, beforeContext, baseCursor);
    const baseEnd = findBaseRegionEnd(baseLines, afterContext, baseStart);
    const baseRegionLines = baseLines.slice(
      baseStart,
      Math.max(baseStart, baseEnd),
    );
    const unresolvedLines =
      baseRegionLines.length > 0 ? baseRegionLines : [""];
    const projectedStartLine = outputLines.length + 1;

    outputLines.push(...unresolvedLines);

    const currentText = markerRegionSideText(
      resultLines,
      region,
      GIT_CONFLICT_SIDE.Current,
      resultText,
    );
    const incomingText = markerRegionSideText(
      resultLines,
      region,
      GIT_CONFLICT_SIDE.Incoming,
      resultText,
    );

    projectedRegions.push({
      id: region.id,
      resultStartLine: projectedStartLine,
      resultSeparatorLine: null,
      resultEndLine: outputLines.length,
      baseText: linesToText(baseRegionLines, resultText),
      currentText,
      incomingText,
      paddingLineCount: conflictPaddingLineCount({
        currentText,
        incomingText,
        visibleLineCount: unresolvedLines.length,
      }),
      unresolvedText: linesToText(unresolvedLines, resultText),
    });

    baseCursor = Math.max(baseStart, baseEnd);
    rawCursor = endIndex + 1;
  }

  outputLines.push(...resultLines.slice(rawCursor));

  return {
    content: linesToText(outputLines, resultText),
    regions: projectedRegions,
  };
}

export function replaceProjectedResultRegionWithContent({
  region,
  regions,
  replacementText,
  resultText,
}: {
  region: ConflictResolutionRegion;
  regions: ConflictResolutionRegion[];
  replacementText: string;
  resultText: string;
}): ConflictResultProjection {
  const lines = splitConflictTextLines(resultText);
  const replacementLines = splitReplacementTextLines(replacementText);
  const startIndex = region.resultStartLine - 1;
  const endIndex = region.resultEndLine - 1;

  if (startIndex < 0 || endIndex < startIndex || startIndex >= lines.length) {
    return { content: resultText, regions };
  }

  const nextLines = [
    ...lines.slice(0, startIndex),
    ...replacementLines,
    ...lines.slice(endIndex + 1),
  ];
  const originalLineCount = endIndex - startIndex + 1;
  const lineDelta = replacementLines.length - originalLineCount;
  const replacementEndLine =
    region.resultStartLine + Math.max(1, replacementLines.length) - 1;
  const nextRegions = regions.map((item) => {
    if (item.id === region.id) {
      const visibleLineCount = Math.max(1, replacementLines.length);

      return {
        ...item,
        paddingLineCount: conflictPaddingLineCount({
          currentText: item.currentText,
          incomingText: item.incomingText,
          visibleLineCount,
        }),
        resultSeparatorLine: null,
        resultEndLine: replacementEndLine,
      };
    }

    if (item.resultStartLine > region.resultEndLine) {
      return {
        ...item,
        resultStartLine: item.resultStartLine + lineDelta,
        resultSeparatorLine: item.resultSeparatorLine
          ? item.resultSeparatorLine + lineDelta
          : null,
        resultEndLine: item.resultEndLine + lineDelta,
      };
    }

    return item;
  });

  return {
    content: linesToText(nextLines, resultText),
    regions: nextRegions,
  };
}
