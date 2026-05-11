import React from "react";
import { useStagedLinesStore } from "../../store/staging";
import { IconCheck } from "../icons";
import type {
  DiffHunkProps,
  DiffLine,
  SplitCell,
  SplitRow,
  StageableBlock,
} from "./types";

const DiffHunk: React.FC<DiffHunkProps> = ({
  hunk,
  filePath,
  hunkIdx,
  extraContext,
  isHovered,
  setHoveredHunkIdx,
  handleExpandContext,
  handleLineMouseDown,
  handleLineMouseEnter,
  handleStageBlock,
  canStage = false,
  displayMode = "unified",
}) => {
  const stagedSet = useStagedLinesStore(
    (s) => (s.stagedLines[filePath]?.[hunkIdx] as Set<number> | undefined) ?? EMPTY_SET,
  );
  const wholeFileStaged = useStagedLinesStore(
    (s) => !!s.stagedLines[filePath]?.isWholeFileStaged,
  );
  const blocks = React.useMemo(() => getStageableBlocks(hunk.lines), [hunk.lines]);
  const blockByLineIdx = React.useMemo(() => {
    const index = new Map<number, StageableBlock>();
    blocks.forEach((block) => {
      block.lineIdxs.forEach((lineIdx) => index.set(lineIdx, block));
    });
    return index;
  }, [blocks]);
  const canRenderGutters = !hunk.is_new_file && canStage;
  const splitRows = React.useMemo(
    () => (displayMode === "split" ? buildSplitRows(hunk.lines, blocks) : []),
    [displayMode, hunk.lines, blocks],
  );

  return (
    <div
      className={`mb-6 first:mt-4 border border-border rounded bg-background ${
        isHovered ? "ring-2 ring-blue-400/40" : ""
      }`}
      onMouseEnter={() => setHoveredHunkIdx(hunkIdx)}
      onMouseLeave={() => setHoveredHunkIdx(null)}
    >
      <div className="flex items-center justify-between px-4 py-1 bg-zinc-800 gap-2">
        <span
          className="text-purple-300 font-mono"
          style={{ fontSize: "var(--diff-font-size)" }}
        >
          {hunk.header}
        </span>
      </div>

      {!hunk.is_new_file && canStage && (
        <>
          <div className="flex justify-center py-1">
            <button
              className="text-xs text-blue-400 hover:underline"
              onClick={() => handleExpandContext(hunkIdx, "Above", 10)}
            >
              Show 10 lines above
            </button>
          </div>
          {extraContext?.above?.map((line, i) =>
            displayMode === "split" ? (
              <SplitContextRow key={`above-${i}`} line={line} />
            ) : (
              <UnifiedLineRow
                key={`above-${i}`}
                line={line}
                showHunkGutter={false}
                showLineGutter={false}
              />
            ),
          )}
        </>
      )}

      {displayMode === "split"
        ? splitRows.map((row) => {
            const rowStageCount = row.lineIdxs.filter((idx) =>
              stagedSet.has(idx),
            ).length;
            const isRowChecked =
              row.lineIdxs.length > 0 &&
              (wholeFileStaged || rowStageCount === row.lineIdxs.length);
            const isRowIndeterminate =
              !wholeFileStaged &&
              rowStageCount > 0 &&
              rowStageCount < row.lineIdxs.length;
            const blockStageCount = row.block
              ? row.block.lineIdxs.filter((idx) => stagedSet.has(idx)).length
              : 0;
            const isBlockFullyStaged =
              !!row.block &&
              row.block.lineIdxs.length > 0 &&
              (wholeFileStaged || blockStageCount === row.block.lineIdxs.length);
            const isBlockPartiallyStaged =
              !wholeFileStaged &&
              !!row.block &&
              blockStageCount > 0 &&
              blockStageCount < row.block.lineIdxs.length;

            return (
              <SplitDiffRow
                key={row.key}
                row={row}
                canStage={canRenderGutters}
                isBlockFullyStaged={isBlockFullyStaged}
                isBlockPartiallyStaged={isBlockPartiallyStaged}
                isRowChecked={isRowChecked}
                isRowIndeterminate={isRowIndeterminate}
                onBlockMouseDown={
                  row.block && canRenderGutters
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleStageBlock(hunkIdx, row.block!.lineIdxs);
                      }
                    : undefined
                }
                onLineGutterMouseDown={
                  canRenderGutters && row.lineIdxs.length > 0
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleStageBlock(hunkIdx, row.lineIdxs);
                      }
                    : undefined
                }
                onLeftMouseDown={
                  row.left && canRenderGutters
                    ? (event) => {
                        event.preventDefault();
                        handleLineMouseDown(
                          hunkIdx,
                          row.left!.lineIdx,
                          true,
                          wholeFileStaged || stagedSet.has(row.left!.lineIdx),
                        );
                      }
                    : undefined
                }
                onLeftMouseEnter={
                  row.left && canRenderGutters
                    ? () =>
                        handleLineMouseEnter(
                          hunkIdx,
                          row.left!.lineIdx,
                          true,
                          wholeFileStaged || stagedSet.has(row.left!.lineIdx),
                        )
                    : undefined
                }
                onRightMouseDown={
                  row.right && canRenderGutters
                    ? (event) => {
                        event.preventDefault();
                        handleLineMouseDown(
                          hunkIdx,
                          row.right!.lineIdx,
                          true,
                          wholeFileStaged || stagedSet.has(row.right!.lineIdx),
                        );
                      }
                    : undefined
                }
                onRightMouseEnter={
                  row.right && canRenderGutters
                    ? () =>
                        handleLineMouseEnter(
                          hunkIdx,
                          row.right!.lineIdx,
                          true,
                          wholeFileStaged || stagedSet.has(row.right!.lineIdx),
                        )
                    : undefined
                }
              />
            );
          })
        : hunk.lines.map((line, lineIdx) => {
            const isStageable = line.kind === "Add" || line.kind === "Del";
            const isStaged =
              isStageable && (wholeFileStaged || stagedSet.has(lineIdx));
            const block = blockByLineIdx.get(lineIdx);
            const isBlockStart = block?.startLineIdx === lineIdx;
            const blockStagedCount = block
              ? block.lineIdxs.filter((idx) => stagedSet.has(idx)).length
              : 0;
            const isBlockFullyStaged =
              !!block &&
              block.lineIdxs.length > 0 &&
              (wholeFileStaged || blockStagedCount === block.lineIdxs.length);
            const isBlockPartiallyStaged =
              !wholeFileStaged &&
              !!block &&
              blockStagedCount > 0 &&
              blockStagedCount < block.lineIdxs.length;

            return (
              <UnifiedLineRow
                key={lineIdx}
                line={line}
                showHunkGutter={canRenderGutters}
                showLineGutter={canRenderGutters && isStageable}
                isBlockStart={isBlockStart}
                isBlockFullyStaged={isBlockFullyStaged}
                isBlockPartiallyStaged={isBlockPartiallyStaged}
                onBlockMouseDown={
                  block && canRenderGutters
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleStageBlock(hunkIdx, block.lineIdxs);
                      }
                    : undefined
                }
                isStaged={isStaged}
                onMouseDown={
                  canRenderGutters
                    ? (event) => {
                        event.preventDefault();
                        handleLineMouseDown(hunkIdx, lineIdx, isStageable, isStaged);
                      }
                    : undefined
                }
                onMouseEnter={
                  canRenderGutters
                    ? () =>
                        handleLineMouseEnter(hunkIdx, lineIdx, isStageable, isStaged)
                    : undefined
                }
              />
            );
          })}

      {!hunk.is_new_file && canStage && (
        <>
          {extraContext?.below?.map((line, i) =>
            displayMode === "split" ? (
              <SplitContextRow key={`below-${i}`} line={line} />
            ) : (
              <UnifiedLineRow
                key={`below-${i}`}
                line={line}
                showHunkGutter={false}
                showLineGutter={false}
              />
            ),
          )}
          <div className="flex justify-center py-1">
            <button
              className="text-xs text-blue-400 hover:underline"
              onClick={() => handleExpandContext(hunkIdx, "Below", 10)}
            >
              Show 10 lines below
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const EMPTY_SET = new Set<number>();

function getStageableBlocks(lines: DiffLine[]): StageableBlock[] {
  const blocks: StageableBlock[] = [];
  let currentBlock: StageableBlock | null = null;

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

function buildSplitRows(lines: DiffLine[], blocks: StageableBlock[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const block = blocks.find((candidate) => candidate.startLineIdx === idx);

    if (!block) {
      const line = lines[idx];
      rows.push({
        key: `ctx-${idx}`,
        left: { line, lineIdx: idx },
        right: { line, lineIdx: idx },
        lineIdxs: [],
        isBlockStart: false,
      });
      idx += 1;
      continue;
    }

    const deletions: SplitCell[] = [];
    const additions: SplitCell[] = [];

    for (let lineIdx = block.startLineIdx; lineIdx <= block.endLineIdx; lineIdx += 1) {
      const line = lines[lineIdx];
      if (line.kind === "Del") {
        deletions.push({ line, lineIdx });
      } else if (line.kind === "Add") {
        additions.push({ line, lineIdx });
      }
    }

    const rowCount = Math.max(deletions.length, additions.length);
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const left = deletions[rowIndex];
      const right = additions[rowIndex];
      rows.push({
        key: `blk-${block.startLineIdx}-${rowIndex}`,
        left,
        right,
        lineIdxs: [left?.lineIdx, right?.lineIdx].filter(
          (lineIdx): lineIdx is number => lineIdx !== undefined,
        ),
        block,
        isBlockStart: rowIndex === 0,
      });
    }

    idx = block.endLineIdx + 1;
  }

  return rows;
}

const UnifiedLineRow: React.FC<{
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
  const baseColor = getLineTone(line);
  const contentTone =
    line.kind === "Add"
      ? "bg-green-900/20"
      : line.kind === "Del"
        ? "bg-red-900/20"
        : "bg-transparent";

  return (
    <div
      className="flex items-stretch font-mono group"
      style={{
        fontSize: "var(--diff-font-size)",
        fontVariantNumeric: "tabular-nums",
        cursor: showLineGutter ? "pointer" : undefined,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      <CenterBlockGutter
        show={showHunkGutter}
        isBlockStart={isBlockStart}
        isBlockFullyStaged={isBlockFullyStaged}
        isBlockPartiallyStaged={isBlockPartiallyStaged}
        onMouseDown={onBlockMouseDown}
      />
      <CenterLineGutter
        show={showLineGutter}
        isChecked={isStaged}
        isIndeterminate={false}
        onMouseDown={onMouseDown}
      />
      <div className={`flex flex-1 items-start px-4 ${baseColor} ${contentTone}`}>
        <span className="block w-10 select-none pr-2 pt-1 text-right text-zinc-200">
          {line.old_lineno ?? ""}
        </span>
        <span className="block w-10 select-none pr-2 pt-1 text-right text-zinc-200">
          {line.new_lineno ?? ""}
        </span>
        <span className="min-w-0 flex-1 whitespace-pre-wrap pt-1">{line.content}</span>
      </div>
    </div>
  );
};

const SplitDiffRow: React.FC<{
  row: SplitRow;
  canStage: boolean;
  isBlockFullyStaged: boolean;
  isBlockPartiallyStaged: boolean;
  isRowChecked: boolean;
  isRowIndeterminate: boolean;
  onBlockMouseDown?: (e: React.MouseEvent) => void;
  onLineGutterMouseDown?: (e: React.MouseEvent) => void;
  onLeftMouseDown?: (e: React.MouseEvent) => void;
  onLeftMouseEnter?: () => void;
  onRightMouseDown?: (e: React.MouseEvent) => void;
  onRightMouseEnter?: () => void;
}> = ({
  row,
  canStage,
  isBlockFullyStaged,
  isBlockPartiallyStaged,
  isRowChecked,
  isRowIndeterminate,
  onBlockMouseDown,
  onLineGutterMouseDown,
  onLeftMouseDown,
  onLeftMouseEnter,
  onRightMouseDown,
  onRightMouseEnter,
}) => {
  const leftTone = row.left ? getLineTone(row.left.line) : "bg-background";
  const rightTone = row.right ? getLineTone(row.right.line) : "bg-background";
  return (
    <div
      className="grid items-stretch font-mono"
      style={{
        fontSize: "var(--diff-font-size)",
        fontVariantNumeric: "tabular-nums",
        gridTemplateColumns: "minmax(0,1fr) 2.5rem 1.5rem 1.5rem 2.5rem minmax(0,1fr)",
      }}
    >
      <SplitSideCell
        cell={row.left}
        tone={leftTone}
        onMouseDown={onLeftMouseDown}
        onMouseEnter={onLeftMouseEnter}
      />
      <span
        className={`flex items-start justify-end pr-2 pt-1 select-none text-zinc-200 ${leftTone}`}
      >
        {row.left?.line.old_lineno ?? ""}
      </span>
      <CenterBlockGutter
        show={canStage && !!row.block}
        isBlockStart={row.isBlockStart}
        isBlockFullyStaged={isBlockFullyStaged}
        isBlockPartiallyStaged={isBlockPartiallyStaged}
        onMouseDown={onBlockMouseDown}
      />
      <CenterLineGutter
        show={canStage && row.lineIdxs.length > 0}
        isChecked={isRowChecked}
        isIndeterminate={isRowIndeterminate}
        onMouseDown={onLineGutterMouseDown}
      />
      <span
        className={`flex items-start justify-end pr-2 pt-1 select-none text-zinc-200 ${rightTone}`}
      >
        {row.right?.line.new_lineno ?? ""}
      </span>
      <SplitSideCell
        cell={row.right}
        tone={rightTone}
        onMouseDown={onRightMouseDown}
        onMouseEnter={onRightMouseEnter}
      />
    </div>
  );
};

const SplitContextRow: React.FC<{ line: DiffLine }> = ({ line }) => (
  <div
    className="grid items-stretch font-mono text-zinc-200"
    style={{
      fontSize: "var(--diff-font-size)",
      fontVariantNumeric: "tabular-nums",
      gridTemplateColumns: "minmax(0,1fr) 2.5rem 1.5rem 1.5rem 2.5rem minmax(0,1fr)",
    }}
  >
    <span className="px-4 pt-1 whitespace-pre-wrap">{line.content}</span>
    <span className="flex items-start justify-end pr-2 pt-1">{line.old_lineno ?? ""}</span>
    <span />
    <span />
    <span className="flex items-start justify-end pr-2 pt-1">{line.new_lineno ?? ""}</span>
    <span className="px-4 pt-1 whitespace-pre-wrap">{line.content}</span>
  </div>
);

const SplitSideCell: React.FC<{
  cell?: SplitCell;
  tone: string;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}> = ({ cell, tone, onMouseDown, onMouseEnter }) => (
  <div
    className={`px-4 pt-1 whitespace-pre-wrap min-w-0 ${tone} ${
      cell && onMouseDown ? "cursor-pointer" : ""
    }`}
    onMouseDown={cell ? onMouseDown : undefined}
    onMouseEnter={cell ? onMouseEnter : undefined}
  >
    {cell?.line.content ?? ""}
  </div>
);

const CenterBlockGutter: React.FC<{
  show: boolean;
  isBlockStart: boolean;
  isBlockFullyStaged: boolean;
  isBlockPartiallyStaged: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  className?: string;
}> = ({
  show,
  isBlockStart,
  isBlockFullyStaged,
  isBlockPartiallyStaged,
  onMouseDown,
  className = "",
}) => (
  <span
    className={`flex min-h-7 h-full self-stretch w-6 shrink-0 items-center justify-center select-none transition-colors duration-75 ease-out ${
      show
        ? onMouseDown
          ? isBlockFullyStaged || isBlockPartiallyStaged
            ? "bg-blue-600 text-white"
            : "bg-zinc-600/30 text-zinc-400"
          : "bg-zinc-800 text-zinc-500"
        : "bg-zinc-800 text-zinc-500"
    } ${className}`}
  >
    {show ? (
      <button
        type="button"
        aria-label={isBlockFullyStaged ? "Deselect block" : "Select block"}
        className="flex h-full w-full items-center justify-center"
        onMouseDown={onMouseDown}
      >
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
);

const CenterLineGutter: React.FC<{
  show: boolean;
  isChecked: boolean;
  isIndeterminate: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}> = ({ show, isChecked, isIndeterminate, onMouseDown }) => (
  <span
    className={`flex min-h-7 h-full self-stretch w-6 shrink-0 items-center justify-center select-none transition-colors duration-75 ease-out ${
      show
        ? isChecked || isIndeterminate
          ? "bg-blue-600 text-white"
          : "bg-zinc-600/30 text-zinc-500"
        : "bg-zinc-800 text-zinc-500"
    }`}
  >
    {show ? (
      <button
        type="button"
        className="flex h-full w-full items-center justify-center"
        onMouseDown={onMouseDown}
      >
        {isChecked ? (
          <IconCheck size={14} className="text-white" />
        ) : isIndeterminate ? (
          <span className="block h-0.5 w-2 rounded bg-white" />
        ) : null}
      </button>
    ) : null}
  </span>
);

function getLineTone(line: DiffLine) {
  if (line.kind === "Add") return "text-green-400 bg-green-900/20";
  if (line.kind === "Del") return "text-red-400 bg-red-900/20";
  return "text-zinc-200";
}

export default React.memo(DiffHunk);
