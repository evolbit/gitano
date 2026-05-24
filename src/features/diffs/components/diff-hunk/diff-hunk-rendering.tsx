import React from "react";
import { IconCheck } from "@/shared/components/icons/icons";
import {
  createDiffLineAnchor,
  type DiffLineAnchor,
} from "../diff-interaction-context/diff-interaction-context";
import type {
  DiffDisplayMode,
  DiffHunkProps,
  DiffLine,
  SplitCell,
  SplitRow,
  StageableBlock,
} from "../../types";

export const EMPTY_SET = new Set<number>();
const SOURCE_WRAP_CLASS = "min-w-0 whitespace-pre-wrap break-words";
const SOURCE_WRAP_STYLE: React.CSSProperties = { overflowWrap: "anywhere" };

type StageState = {
  isFullyStaged: boolean;
  isPartiallyStaged: boolean;
};

type DiffLineRenderer = (anchor: DiffLineAnchor) => React.ReactNode;

type DiffRowsCommonProps = {
  filePath: string;
  hunkIdx: number;
  canRenderGutters: boolean;
  stagedSet: ReadonlySet<number>;
  wholeFileStaged: boolean;
  renderLineAccessory?: DiffLineRenderer;
  renderLineBelow?: DiffLineRenderer;
  renderLineBelowFullWidth?: DiffLineRenderer;
  handleStageBlock?: DiffHunkProps["handleStageBlock"];
  handleLineMouseDown?: DiffHunkProps["handleLineMouseDown"];
  handleLineMouseEnter?: DiffHunkProps["handleLineMouseEnter"];
};

export const SplitDiffRows: React.FC<
  DiffRowsCommonProps & {
    rows: SplitRow[];
  }
> = ({
  rows,
  filePath,
  hunkIdx,
  canRenderGutters,
  stagedSet,
  wholeFileStaged,
  renderLineAccessory,
  renderLineBelow,
  renderLineBelowFullWidth,
  handleStageBlock,
  handleLineMouseDown,
  handleLineMouseEnter,
}) => (
  <>
    {rows.map((row) => {
      const rowStageState = getStageState(
        row.lineIdxs,
        stagedSet,
        wholeFileStaged,
      );
      const blockStageState = getBlockStageState(
        row.block,
        stagedSet,
        wholeFileStaged,
      );
      const left = row.left;
      const right = row.right;

      return (
        <SplitDiffRow
          key={row.key}
          row={row}
          filePath={filePath}
          hunkIdx={hunkIdx}
          canStage={canRenderGutters}
          isBlockFullyStaged={blockStageState.isFullyStaged}
          isBlockPartiallyStaged={blockStageState.isPartiallyStaged}
          isRowChecked={rowStageState.isFullyStaged}
          isRowIndeterminate={rowStageState.isPartiallyStaged}
          renderLineAccessory={renderLineAccessory}
          renderLineBelow={renderLineBelow}
          renderLineBelowFullWidth={renderLineBelowFullWidth}
          onBlockMouseDown={
            row.block && canRenderGutters && handleStageBlock
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleStageBlock(hunkIdx, row.block!.lineIdxs);
                }
              : undefined
          }
          onLineGutterMouseDown={
            canRenderGutters && row.lineIdxs.length > 0 && handleStageBlock
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleStageBlock(hunkIdx, row.lineIdxs);
                }
              : undefined
          }
          onLeftMouseDown={
            left && canRenderGutters && handleLineMouseDown
              ? (event) => {
                  event.preventDefault();
                  handleLineMouseDown(
                    hunkIdx,
                    left.lineIdx,
                    true,
                    wholeFileStaged || stagedSet.has(left.lineIdx),
                  );
                }
              : undefined
          }
          onLeftMouseEnter={
            left && canRenderGutters && handleLineMouseEnter
              ? () =>
                  handleLineMouseEnter(
                    hunkIdx,
                    left.lineIdx,
                    true,
                    wholeFileStaged || stagedSet.has(left.lineIdx),
                  )
              : undefined
          }
          onRightMouseDown={
            right && canRenderGutters && handleLineMouseDown
              ? (event) => {
                  event.preventDefault();
                  handleLineMouseDown(
                    hunkIdx,
                    right.lineIdx,
                    true,
                    wholeFileStaged || stagedSet.has(right.lineIdx),
                  );
                }
              : undefined
          }
          onRightMouseEnter={
            right && canRenderGutters && handleLineMouseEnter
              ? () =>
                  handleLineMouseEnter(
                    hunkIdx,
                    right.lineIdx,
                    true,
                    wholeFileStaged || stagedSet.has(right.lineIdx),
                  )
              : undefined
          }
        />
      );
    })}
  </>
);

export const UnifiedDiffRows: React.FC<
  DiffRowsCommonProps & {
    lines: DiffLine[];
    blockByLineIdx: Map<number, StageableBlock>;
  }
> = ({
  lines,
  filePath,
  hunkIdx,
  canRenderGutters,
  stagedSet,
  wholeFileStaged,
  blockByLineIdx,
  renderLineAccessory,
  renderLineBelow,
  renderLineBelowFullWidth,
  handleStageBlock,
  handleLineMouseDown,
  handleLineMouseEnter,
}) => (
  <>
    {lines.map((line, lineIdx) => {
      const isStageable = line.kind === "Add" || line.kind === "Del";
      const isStaged =
        isStageable && (wholeFileStaged || stagedSet.has(lineIdx));
      const block = blockByLineIdx.get(lineIdx);
      const isBlockStart = block?.startLineIdx === lineIdx;
      const blockStageState = getBlockStageState(
        block,
        stagedSet,
        wholeFileStaged,
      );
      const anchor = createDiffLineAnchor({
        filePath,
        hunkIdx,
        lineIdx,
        line,
      });

      return (
        <UnifiedLineRow
          key={lineIdx}
          line={line}
          anchor={anchor}
          lineAccessory={renderLineAccessory?.(anchor)}
          lineBelow={renderLineBelow?.(anchor)}
          lineBelowFullWidth={renderLineBelowFullWidth?.(anchor)}
          showHunkGutter={canRenderGutters}
          showLineGutter={canRenderGutters && isStageable}
          isBlockStart={isBlockStart}
          isBlockFullyStaged={blockStageState.isFullyStaged}
          isBlockPartiallyStaged={blockStageState.isPartiallyStaged}
          onBlockMouseDown={
            block && canRenderGutters && handleStageBlock
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleStageBlock(hunkIdx, block.lineIdxs);
                }
              : undefined
          }
          isStaged={isStaged}
          onMouseDown={
            canRenderGutters && handleLineMouseDown
              ? (event) => {
                  event.preventDefault();
                  handleLineMouseDown(
                    hunkIdx,
                    lineIdx,
                    isStageable,
                    isStaged,
                  );
                }
              : undefined
          }
          onMouseEnter={
            canRenderGutters && handleLineMouseEnter
              ? () =>
                  handleLineMouseEnter(
                    hunkIdx,
                    lineIdx,
                    isStageable,
                    isStaged,
                  )
              : undefined
          }
        />
      );
    })}
  </>
);

export const ExpandContextButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
}> = ({ children, onClick }) => (
  <div className="flex justify-center py-1">
    <button
      className="text-xs text-blue-400 hover:underline"
      onClick={onClick}
    >
      {children}
    </button>
  </div>
);

export const ContextRows: React.FC<{
  displayMode: DiffDisplayMode;
  lines: DiffLine[];
  keyPrefix: string;
}> = ({ displayMode, lines, keyPrefix }) => (
  <>
    {lines.map((line, index) =>
      displayMode === "split" ? (
        <SplitContextRow key={`${keyPrefix}-${index}`} line={line} />
      ) : (
        <UnifiedLineRow
          key={`${keyPrefix}-${index}`}
          line={line}
          showHunkGutter={false}
          showLineGutter={false}
        />
      ),
    )}
  </>
);

export function getStageableBlocks(lines: DiffLine[]): StageableBlock[] {
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

export function buildSplitRows(
  lines: DiffLine[],
  blocks: StageableBlock[],
): SplitRow[] {
  const rows: SplitRow[] = [];
  const blockByStartLineIdx = new Map(
    blocks.map((block) => [block.startLineIdx, block]),
  );
  let idx = 0;

  while (idx < lines.length) {
    const block = blockByStartLineIdx.get(idx);

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

    for (
      let lineIdx = block.startLineIdx;
      lineIdx <= block.endLineIdx;
      lineIdx += 1
    ) {
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

function getStageState(
  lineIdxs: number[],
  stagedSet: ReadonlySet<number>,
  wholeFileStaged: boolean,
): StageState {
  const stagedCount = lineIdxs.filter((idx) => stagedSet.has(idx)).length;

  return {
    isFullyStaged:
      lineIdxs.length > 0 &&
      (wholeFileStaged || stagedCount === lineIdxs.length),
    isPartiallyStaged:
      !wholeFileStaged && stagedCount > 0 && stagedCount < lineIdxs.length,
  };
}

function getBlockStageState(
  block: StageableBlock | undefined,
  stagedSet: ReadonlySet<number>,
  wholeFileStaged: boolean,
): StageState {
  return block
    ? getStageState(block.lineIdxs, stagedSet, wholeFileStaged)
    : { isFullyStaged: false, isPartiallyStaged: false };
}

const UnifiedLineRow: React.FC<{
  line: DiffLine;
  anchor?: DiffLineAnchor;
  lineAccessory?: React.ReactNode;
  lineBelow?: React.ReactNode;
  lineBelowFullWidth?: React.ReactNode;
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
  lineAccessory,
  lineBelow,
  lineBelowFullWidth,
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
  const contentTone = getLineContentTone(line);

  return (
    <div>
      <div
        className="group flex items-stretch font-mono"
        style={{
          fontSize: "var(--diff-font-size)",
          fontVariantNumeric: "tabular-nums",
          cursor: showLineGutter ? "pointer" : undefined,
        }}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
      >
        {showHunkGutter || showLineGutter ? (
          <>
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
          </>
        ) : null}
        <div
          className={`flex min-w-0 flex-1 items-start px-4 ${baseColor} ${contentTone}`}
        >
          <span className="block w-10 shrink-0 select-none pr-2 pt-1 text-right text-zinc-200">
            {line.old_lineno ?? ""}
          </span>
          <span className="block w-10 shrink-0 select-none pr-2 pt-1 text-right text-zinc-200">
            {line.new_lineno ?? ""}
          </span>
          {lineAccessory ? (
            <span className="mr-2 flex min-h-7 w-7 shrink-0 items-start justify-center pt-0.5">
              {lineAccessory}
            </span>
          ) : null}
          <span
            className={`${SOURCE_WRAP_CLASS} flex-1 pt-1`}
            style={SOURCE_WRAP_STYLE}
          >
            {line.content}
          </span>
        </div>
      </div>
      {lineBelow ? (
        <div className="border-t border-border/40 bg-background px-16 py-2 font-sans">
          {lineBelow}
        </div>
      ) : null}
      {lineBelowFullWidth ? (
        <div className="border-t border-border/40 bg-background px-8 py-3 font-sans">
          {lineBelowFullWidth}
        </div>
      ) : null}
    </div>
  );
};

const SplitDiffRow: React.FC<{
  row: SplitRow;
  filePath: string;
  hunkIdx: number;
  canStage: boolean;
  isBlockFullyStaged: boolean;
  isBlockPartiallyStaged: boolean;
  isRowChecked: boolean;
  isRowIndeterminate: boolean;
  renderLineAccessory?: (anchor: DiffLineAnchor) => React.ReactNode;
  renderLineBelow?: (anchor: DiffLineAnchor) => React.ReactNode;
  renderLineBelowFullWidth?: (anchor: DiffLineAnchor) => React.ReactNode;
  onBlockMouseDown?: (e: React.MouseEvent) => void;
  onLineGutterMouseDown?: (e: React.MouseEvent) => void;
  onLeftMouseDown?: (e: React.MouseEvent) => void;
  onLeftMouseEnter?: () => void;
  onRightMouseDown?: (e: React.MouseEvent) => void;
  onRightMouseEnter?: () => void;
}> = ({
  row,
  filePath,
  hunkIdx,
  canStage,
  isBlockFullyStaged,
  isBlockPartiallyStaged,
  isRowChecked,
  isRowIndeterminate,
  renderLineAccessory,
  renderLineBelow,
  renderLineBelowFullWidth,
  onBlockMouseDown,
  onLineGutterMouseDown,
  onLeftMouseDown,
  onLeftMouseEnter,
  onRightMouseDown,
  onRightMouseEnter,
}) => {
  const leftTone = row.left ? getLineTone(row.left.line) : "bg-background";
  const rightTone = row.right ? getLineTone(row.right.line) : "bg-background";
  const leftAnchor = row.left
    ? createDiffLineAnchor({
        filePath,
        hunkIdx,
        lineIdx: row.left.lineIdx,
        line: row.left.line,
        side: "old",
      })
    : undefined;
  const rightAnchor = row.right
    ? createDiffLineAnchor({
        filePath,
        hunkIdx,
        lineIdx: row.right.lineIdx,
        line: row.right.line,
        side: "new",
      })
    : undefined;
  const fullWidthBelow = [
    leftAnchor ? renderLineBelowFullWidth?.(leftAnchor) : null,
    rightAnchor ? renderLineBelowFullWidth?.(rightAnchor) : null,
  ].filter(Boolean);
  return (
    <>
      <div
        className="grid items-stretch font-mono"
        style={{
          fontSize: "var(--diff-font-size)",
          fontVariantNumeric: "tabular-nums",
          gridTemplateColumns:
            "minmax(0,1fr) 2.5rem 1.5rem 1.5rem 2.5rem minmax(0,1fr)",
        }}
      >
        <SplitSideCell
          cell={row.left}
          tone={leftTone}
          lineAccessory={
            leftAnchor ? renderLineAccessory?.(leftAnchor) : undefined
          }
          lineBelow={leftAnchor ? renderLineBelow?.(leftAnchor) : undefined}
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
          lineAccessory={
            rightAnchor ? renderLineAccessory?.(rightAnchor) : undefined
          }
          lineBelow={rightAnchor ? renderLineBelow?.(rightAnchor) : undefined}
          onMouseDown={onRightMouseDown}
          onMouseEnter={onRightMouseEnter}
        />
      </div>
      {fullWidthBelow.length > 0 ? (
        <div className="space-y-3 border-t border-border/40 bg-background px-8 py-3 font-sans">
          {fullWidthBelow.map((content, index) => (
            <React.Fragment key={index}>{content}</React.Fragment>
          ))}
        </div>
      ) : null}
    </>
  );
};

const SplitContextRow: React.FC<{ line: DiffLine }> = ({ line }) => (
  <div
    className="grid items-stretch font-mono text-zinc-200"
    style={{
      fontSize: "var(--diff-font-size)",
      fontVariantNumeric: "tabular-nums",
      gridTemplateColumns:
        "minmax(0,1fr) 2.5rem 1.5rem 1.5rem 2.5rem minmax(0,1fr)",
    }}
  >
    <span
      className={`${SOURCE_WRAP_CLASS} px-4 pt-1`}
      style={SOURCE_WRAP_STYLE}
    >
      {line.content}
    </span>
    <span className="flex items-start justify-end pr-2 pt-1">
      {line.old_lineno ?? ""}
    </span>
    <span />
    <span />
    <span className="flex items-start justify-end pr-2 pt-1">
      {line.new_lineno ?? ""}
    </span>
    <span
      className={`${SOURCE_WRAP_CLASS} px-4 pt-1`}
      style={SOURCE_WRAP_STYLE}
    >
      {line.content}
    </span>
  </div>
);

const SplitSideCell: React.FC<{
  cell?: SplitCell;
  tone: string;
  lineAccessory?: React.ReactNode;
  lineBelow?: React.ReactNode;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}> = ({ cell, tone, lineAccessory, lineBelow, onMouseDown, onMouseEnter }) => (
  <div
    className={`min-w-0 px-4 pt-1 ${tone} ${
      cell && onMouseDown ? "cursor-pointer" : ""
    }`}
    onMouseDown={cell ? onMouseDown : undefined}
    onMouseEnter={cell ? onMouseEnter : undefined}
  >
    <div className="flex min-w-0 items-start">
      {lineAccessory ? (
        <span className="mr-2 flex min-h-7 w-7 shrink-0 items-start justify-center pt-0.5">
          {lineAccessory}
        </span>
      ) : null}
      <span
        className={`${SOURCE_WRAP_CLASS} flex-1`}
        style={SOURCE_WRAP_STYLE}
      >
        {cell?.line.content ?? ""}
      </span>
    </div>
    {lineBelow ? (
      <div className="mt-1 border-t border-border/40 bg-background/80 py-2 font-sans">
        {lineBelow}
      </div>
    ) : null}
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
    className={`flex min-h-7 h-full self-stretch w-6 shrink-0 items-center justify-center select-none transition-colors duration-75 ease-out ${getBlockGutterTone(
      show,
      !!onMouseDown,
      isBlockFullyStaged || isBlockPartiallyStaged,
    )} ${className}`}
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
    className={`flex min-h-7 h-full self-stretch w-6 shrink-0 items-center justify-center select-none transition-colors duration-75 ease-out ${getLineGutterTone(
      show,
      isChecked || isIndeterminate,
    )}`}
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

function getBlockGutterTone(
  show: boolean,
  hasMouseHandler: boolean,
  hasStagedLines: boolean,
) {
  if (!show || !hasMouseHandler) return "bg-zinc-800 text-zinc-500";
  if (hasStagedLines) return "bg-blue-600 text-white";
  return "bg-zinc-600/30 text-zinc-400";
}

function getLineGutterTone(show: boolean, hasStagedLines: boolean) {
  if (!show) return "bg-zinc-800 text-zinc-500";
  if (hasStagedLines) return "bg-blue-600 text-white";
  return "bg-zinc-600/30 text-zinc-500";
}

function getLineTone(line: DiffLine) {
  if (line.kind === "Add") return "text-green-400 bg-green-900/20";
  if (line.kind === "Del") return "text-red-400 bg-red-900/20";
  return "text-zinc-200";
}

function getLineContentTone(line: DiffLine) {
  if (line.kind === "Add") return "bg-green-900/20";
  if (line.kind === "Del") return "bg-red-900/20";
  return "bg-transparent";
}
