import React from "react";
import { IconCheck } from "./icons";

// Types for backend data
interface DiffLine {
  kind: "Add" | "Del" | "Context";
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

interface DiffHunkType {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
  is_new_file?: boolean;
}

type ContextDirection = "Above" | "Below";

interface DiffHunkProps {
  hunk: DiffHunkType;
  hunkIdx: number;
  stagedLines: Record<number, Set<number>>;
  extraContext: Record<number, { above: DiffLine[]; below: DiffLine[] }>;
  hoveredHunkIdx: number | null;
  setHoveredHunkIdx: React.Dispatch<React.SetStateAction<number | null>>;
  handleExpandContext: (
    hunkIdx: number,
    direction: ContextDirection,
    lines: number
  ) => void;
  handleLineMouseDown: (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean
  ) => void;
  handleLineMouseEnter: (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean
  ) => void;
  handleStageBlock: (hunkIdx: number, lineIdxs: number[]) => void;
  canStage?: boolean;
}

const DiffHunk: React.FC<DiffHunkProps> = ({
  hunk,
  hunkIdx,
  stagedLines,
  extraContext,
  hoveredHunkIdx,
  setHoveredHunkIdx,
  handleExpandContext,
  handleLineMouseDown,
  handleLineMouseEnter,
  handleStageBlock,
  canStage = false,
}) => {
  const isHovered = hoveredHunkIdx === hunkIdx;
  const blocks = getStageableBlocks(hunk.lines);

  return (
    <div
      className={`mb-6 border border-border rounded bg-background ${
        isHovered ? "ring-2 ring-blue-400/40" : ""
      }`}
      onMouseEnter={() => setHoveredHunkIdx(hunkIdx)}
      onMouseLeave={() => setHoveredHunkIdx(null)}>
      {/* Hunk header with secondary actions */}
      <div className="flex items-center justify-between px-4 py-1 bg-zinc-800 gap-2">
        <span className="text-purple-300 text-xs font-mono">{hunk.header}</span>
        {canStage && (
          <div className="flex items-center gap-2 ml-auto">
            {hunk.is_new_file ? (
              <>
                <button
                  className="px-2 py-1 text-xs bg-green-700 hover:bg-green-800 text-white rounded"
                  onClick={() => {
                    console.log("Stage new file", hunkIdx);
                  }}>
                  Stage
                </button>
                <button
                  className="px-2 py-1 text-xs bg-red-700 hover:bg-red-800 text-white rounded"
                  onClick={() => {
                    console.log("Remove new file", hunkIdx);
                  }}>
                  Remove
                </button>
              </>
            ) : (
              <button
                className="px-2 py-1 text-xs bg-green-700 hover:bg-green-800 text-white rounded disabled:opacity-50"
                disabled={!(stagedLines[hunkIdx] && stagedLines[hunkIdx].size > 0)}
                onClick={() => {
                  const staged = stagedLines[hunkIdx]
                    ? Array.from(stagedLines[hunkIdx])
                    : [];
                  console.log("Stage lines for hunk", hunkIdx, staged);
                }}>
                Stage
              </button>
            )}
          </div>
        )}
      </div>
      {/* Expand context above, only for non-new files when canStage is true */}
      {!hunk.is_new_file && canStage && (
        <>
          <div className="flex justify-center py-1">
            <button
              className="text-xs text-blue-400 hover:underline"
              onClick={() => handleExpandContext(hunkIdx, "Above", 10)}>
              Show 10 lines above
            </button>
          </div>
          {/* Extra lines above */}
          {extraContext[hunkIdx]?.above?.map((line, i) => (
            <DiffLineRow
              key={"above-" + i}
              line={line}
              showLineGutter={false}
            />
          ))}
        </>
      )}
      {/* Hunk lines */}
      {hunk.lines.map((line, lineIdx) => {
        const isStageable = line.kind === "Add" || line.kind === "Del";
        const isStaged = stagedLines[hunkIdx]?.has(lineIdx);
        const block = blocks.find(
          ({ startLineIdx, endLineIdx }) =>
            lineIdx >= startLineIdx && lineIdx <= endLineIdx
        );
        const isBlockStart = block?.startLineIdx === lineIdx;
        const blockStagedCount = block
          ? block.lineIdxs.filter((idx) => stagedLines[hunkIdx]?.has(idx)).length
          : 0;
        const isBlockFullyStaged =
          !!block &&
          block.lineIdxs.length > 0 &&
          blockStagedCount === block.lineIdxs.length;
        const isBlockPartiallyStaged =
          !!block &&
          blockStagedCount > 0 &&
          blockStagedCount < block.lineIdxs.length;

        return (
          <DiffLineRow
            key={lineIdx}
            line={line}
            showHunkGutter={!hunk.is_new_file && canStage}
            showLineGutter={!hunk.is_new_file && isStageable}
            isBlockStart={isBlockStart}
            isBlockFullyStaged={isBlockFullyStaged}
            isBlockPartiallyStaged={isBlockPartiallyStaged}
            onBlockMouseDown={
              block && !hunk.is_new_file && canStage
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleStageBlock(hunkIdx, block.lineIdxs);
                  }
                : undefined
            }
            isStaged={isStaged}
            onMouseDown={
              hunk.is_new_file
                ? undefined
                : (e) => {
                    e.preventDefault();
                    handleLineMouseDown(
                      hunkIdx,
                      lineIdx,
                      isStageable,
                      isStaged
                    );
                  }
            }
            onMouseEnter={
              hunk.is_new_file
                ? undefined
                : () =>
                    handleLineMouseEnter(
                      hunkIdx,
                      lineIdx,
                      isStageable,
                      isStaged
                    )
            }
          />
        );
      })}
      {/* Extra lines below, only for non-new files when canStage is true */}
      {!hunk.is_new_file && canStage && (
        <>
          {extraContext[hunkIdx]?.below?.map((line, i) => (
            <DiffLineRow
              key={"below-" + i}
              line={line}
              showLineGutter={false}
            />
          ))}
          {/* Expand context below */}
          <div className="flex justify-center py-1">
            <button
              className="text-xs text-blue-400 hover:underline"
              onClick={() => handleExpandContext(hunkIdx, "Below", 10)}>
              Show 10 lines below
            </button>
          </div>
        </>
      )}
    </div>
  );
};

function getStageableBlocks(lines: DiffLine[]) {
  const blocks: { startLineIdx: number; endLineIdx: number; lineIdxs: number[] }[] = [];
  let currentBlock: { startLineIdx: number; endLineIdx: number; lineIdxs: number[] } | null =
    null;

  lines.forEach((line, idx) => {
    const isStageable = line.kind === "Add" || line.kind === "Del";

    if (!isStageable) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      return;
    }

    if (!currentBlock) {
      currentBlock = {
        startLineIdx: idx,
        endLineIdx: idx,
        lineIdxs: [idx],
      };
      return;
    }

    currentBlock.endLineIdx = idx;
    currentBlock.lineIdxs.push(idx);
  });

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

// Component that renders a diff line with checks, colors, and line numbers
const DiffLineRow: React.FC<{
  line: DiffLine;
  showHunkGutter?: boolean;
  isBlockStart?: boolean;
  isBlockFullyStaged?: boolean;
  isBlockPartiallyStaged?: boolean;
  onBlockMouseDown?: (e: React.MouseEvent) => void;
  showLineGutter?: boolean;
  isStaged?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}> = ({
  line,
  showHunkGutter = true,
  isBlockStart = false,
  isBlockFullyStaged = false,
  isBlockPartiallyStaged = false,
  onBlockMouseDown,
  showLineGutter = false,
  isStaged = false,
  onMouseDown,
  onMouseEnter,
}) => {
  let baseColor = "";
  if (line.kind === "Add") baseColor = "text-green-400 bg-green-900/20";
  else if (line.kind === "Del") baseColor = "text-red-400 bg-red-900/20";
  else baseColor = "text-zinc-200";
  return (
    <div
      className={`flex items-center px-4 ${baseColor} text-xs font-mono group transition-colors duration-100`}
      style={{
        fontVariantNumeric: "tabular-nums",
        cursor: showLineGutter ? "pointer" : undefined,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}>
      <span
        className={`flex h-7 w-6 items-center justify-center select-none transition-colors ${
          showHunkGutter
            ? onBlockMouseDown
              ? isBlockFullyStaged || isBlockPartiallyStaged
                ? "bg-blue-600 text-white"
                : "bg-white/6 text-zinc-400"
              : ""
            : ""
        }`}>
        {showHunkGutter ? (
          <button
            type="button"
            aria-label={isBlockFullyStaged ? "Deselect block" : "Select block"}
            className="flex h-full w-full items-center justify-center"
            onMouseDown={onBlockMouseDown}>
            {isBlockStart ? (
              isBlockFullyStaged ? (
                <IconCheck size={12} className="text-white" />
              ) : isBlockPartiallyStaged ? (
                <span className="block h-0.5 w-2 rounded bg-white" />
              ) : null
            ) : null}
          </button>
        ) : null}
      </span>
      <span
        className={`flex h-7 w-6 items-center justify-center select-none transition-colors ${
          showLineGutter
            ? isStaged
              ? "bg-blue-600 text-white"
              : "bg-transparent text-zinc-500"
            : "bg-transparent"
        }`}>
        {showLineGutter && isStaged ? (
          <IconCheck
            size={14}
            className="text-white"
          />
        ) : null}
      </span>
      <span className="w-10 text-right pr-2 text-zinc-200 select-none block">
        {line.old_lineno ?? ""}
      </span>
      <span className="w-10 text-right pr-2 text-zinc-200 select-none block">
        {line.new_lineno ?? ""}
      </span>
      {/* Content */}
      <span className="flex-1 min-w-0 whitespace-pre-wrap">{line.content}</span>
    </div>
  );
};

export default DiffHunk;
