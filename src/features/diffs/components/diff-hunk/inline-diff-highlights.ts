import type { DiffLine, StageableBlock } from "../../types";

export type InlineDiffHighlightRange = {
  start: number;
  end: number;
};

export type InlineDiffHighlightRangesByLine = ReadonlyMap<
  number,
  InlineDiffHighlightRange
>;

type ChangedLine = {
  lineIdx: number;
  content: string;
};

type InlineChangedRanges = {
  deleted: InlineDiffHighlightRange;
  added: InlineDiffHighlightRange;
};

const ADDED_LINE_KIND: DiffLine["kind"] = "Add";
const DELETED_LINE_KIND: DiffLine["kind"] = "Del";

export function buildInlineDiffHighlightRanges(
  lines: DiffLine[],
  blocks: StageableBlock[],
): InlineDiffHighlightRangesByLine {
  const rangesByLine = new Map<number, InlineDiffHighlightRange>();

  blocks.forEach((block) => {
    const deletedLines: ChangedLine[] = [];
    const addedLines: ChangedLine[] = [];

    for (
      let lineIdx = block.startLineIdx;
      lineIdx <= block.endLineIdx;
      lineIdx += 1
    ) {
      const line = lines[lineIdx];

      if (line.kind === DELETED_LINE_KIND) {
        deletedLines.push({ lineIdx, content: line.content });
      } else if (line.kind === ADDED_LINE_KIND) {
        addedLines.push({ lineIdx, content: line.content });
      }
    }

    const pairCount = Math.min(deletedLines.length, addedLines.length);

    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const deletedLine = deletedLines[pairIndex];
      const addedLine = addedLines[pairIndex];
      const ranges = getInlineChangedRanges(
        deletedLine.content,
        addedLine.content,
      );

      if (!ranges) continue;
      if (hasVisibleRange(ranges.deleted)) {
        rangesByLine.set(deletedLine.lineIdx, ranges.deleted);
      }
      if (hasVisibleRange(ranges.added)) {
        rangesByLine.set(addedLine.lineIdx, ranges.added);
      }
    }
  });

  return rangesByLine;
}

export function getInlineChangedRanges(
  deletedContent: string,
  addedContent: string,
): InlineChangedRanges | null {
  if (deletedContent === addedContent) return null;

  const prefixLength = getCommonPrefixLength(deletedContent, addedContent);
  const suffixLength = getCommonSuffixLength(
    deletedContent,
    addedContent,
    prefixLength,
  );
  const deletedRange = {
    start: prefixLength,
    end: deletedContent.length - suffixLength,
  };
  const addedRange = {
    start: prefixLength,
    end: addedContent.length - suffixLength,
  };

  if (!hasVisibleRange(deletedRange) && !hasVisibleRange(addedRange)) {
    return null;
  }

  return {
    deleted: deletedRange,
    added: addedRange,
  };
}

function getCommonPrefixLength(first: string, second: string) {
  const maxLength = Math.min(first.length, second.length);
  let length = 0;

  while (length < maxLength && first[length] === second[length]) {
    length += 1;
  }

  return length;
}

function getCommonSuffixLength(
  first: string,
  second: string,
  prefixLength: number,
) {
  const firstRemainingLength = first.length - prefixLength;
  const secondRemainingLength = second.length - prefixLength;
  const maxLength = Math.min(firstRemainingLength, secondRemainingLength);
  let length = 0;

  while (
    length < maxLength &&
    first[first.length - 1 - length] === second[second.length - 1 - length]
  ) {
    length += 1;
  }

  return length;
}

function hasVisibleRange(range: InlineDiffHighlightRange) {
  return range.start < range.end;
}
