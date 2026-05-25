import React from "react";
import { useStagedLinesStore } from "@/features/working-changes";
import { useDiffInteraction } from "../diff-interaction-context/diff-interaction-context";
import type { DiffHunkProps, StageableBlock } from "../../types";
import {
  buildSplitRows,
  ContextRows,
  EMPTY_SET,
  ExpandContextButton,
  getStageableBlocks,
  SplitDiffRows,
  UnifiedDiffRows,
} from "./diff-hunk-rendering";

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
  const diffInteraction = useDiffInteraction();
  const canRenderGutters = !hunk.is_new_file && canStage;
  const splitRows = React.useMemo(
    () => (displayMode === "split" ? buildSplitRows(hunk.lines, blocks) : []),
    [displayMode, hunk.lines, blocks],
  );
  const renderLineAccessory = diffInteraction.renderLineAccessory;
  const renderLineBelow = diffInteraction.renderLineBelow;
  const renderLineBelowFullWidth = diffInteraction.renderLineBelowFullWidth;
  const canExpandContext =
    !hunk.is_new_file && canStage && !!handleExpandContext;

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

      {canExpandContext ? (
        <>
          <ExpandContextButton
            onClick={() => handleExpandContext?.(hunkIdx, "Above", 10)}
          >
            Show 10 lines above
          </ExpandContextButton>
          <ContextRows
            displayMode={displayMode}
            lines={extraContext?.above ?? []}
            keyPrefix="above"
            canRenderGutters={canRenderGutters}
          />
        </>
      ) : null}

      {displayMode === "split" ? (
        <SplitDiffRows
          rows={splitRows}
          filePath={filePath}
          hunkIdx={hunkIdx}
          canRenderGutters={canRenderGutters}
          stagedSet={stagedSet}
          wholeFileStaged={wholeFileStaged}
          renderLineAccessory={renderLineAccessory}
          renderLineBelow={renderLineBelow}
          renderLineBelowFullWidth={renderLineBelowFullWidth}
          handleStageBlock={handleStageBlock}
          handleLineMouseDown={handleLineMouseDown}
          handleLineMouseEnter={handleLineMouseEnter}
        />
      ) : (
        <UnifiedDiffRows
          lines={hunk.lines}
          filePath={filePath}
          hunkIdx={hunkIdx}
          canRenderGutters={canRenderGutters}
          stagedSet={stagedSet}
          wholeFileStaged={wholeFileStaged}
          blockByLineIdx={blockByLineIdx}
          renderLineAccessory={renderLineAccessory}
          renderLineBelow={renderLineBelow}
          renderLineBelowFullWidth={renderLineBelowFullWidth}
          handleStageBlock={handleStageBlock}
          handleLineMouseDown={handleLineMouseDown}
          handleLineMouseEnter={handleLineMouseEnter}
        />
      )}

      {canExpandContext ? (
        <>
          <ContextRows
            displayMode={displayMode}
            lines={extraContext?.below ?? []}
            keyPrefix="below"
            canRenderGutters={canRenderGutters}
          />
          <ExpandContextButton
            onClick={() => handleExpandContext?.(hunkIdx, "Below", 10)}
          >
            Show 10 lines below
          </ExpandContextButton>
        </>
      ) : null}
    </div>
  );
};

export default React.memo(DiffHunk);
