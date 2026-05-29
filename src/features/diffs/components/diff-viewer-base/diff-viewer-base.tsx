import { useEffect, useMemo, useRef, useState } from "react";
import DiffHunk from "../diff-hunk/diff-hunk";
import { useDiffInteraction } from "../diff-interaction-context/diff-interaction-context";
import type {
  ContextDirection,
  DiffDisplayMode,
  DiffHunk as DiffHunkData,
  DiffLine as DiffLineData,
} from "../../types";

export type DiffViewerBaseProps = {
  filePath: string;
  hunks: DiffHunkData[];
  loading?: boolean;
  error?: string | null;
  extraContext?: Record<number, { above: DiffLineData[]; below: DiffLineData[] }>;
  displayMode?: DiffDisplayMode;
  onDisplayModeChange?: (mode: DiffDisplayMode) => void;
  onExpandContext?: (
    hunkIdx: number,
    direction: ContextDirection,
    lines: number,
  ) => void;
  onLineMouseDown?: (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean,
  ) => void;
  onLineMouseEnter?: (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean,
  ) => void;
  onStageBlock?: (hunkIdx: number, lineIdxs: number[]) => void;
  canStage?: boolean;
  scrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
};

export const DIFF_RENDER_LINE_CAP = 5000;

export function getDiffLineCount(hunks: DiffHunkData[]) {
  return hunks.reduce((total, hunk) => total + hunk.lines.length, 0);
}

export function getBoundedDiffHunks(
  hunks: DiffHunkData[],
  lineCap = DIFF_RENDER_LINE_CAP,
) {
  let visibleLineCount = 0;
  const visibleHunks: DiffHunkData[] = [];

  for (const hunk of hunks) {
    if (visibleLineCount >= lineCap) break;

    const remainingLineCount = lineCap - visibleLineCount;
    if (hunk.lines.length <= remainingLineCount) {
      visibleHunks.push(hunk);
      visibleLineCount += hunk.lines.length;
      continue;
    }

    visibleHunks.push({
      ...hunk,
      lines: hunk.lines.slice(0, remainingLineCount),
    });
    visibleLineCount = lineCap;
  }

  return {
    hiddenLineCount: Math.max(getDiffLineCount(hunks) - visibleLineCount, 0),
    visibleHunks,
  };
}

export default function DiffViewerBase({
  filePath,
  hunks,
  loading = false,
  error = null,
  extraContext = {},
  displayMode = "unified",
  onDisplayModeChange,
  onExpandContext,
  onLineMouseDown,
  onLineMouseEnter,
  onStageBlock,
  canStage = false,
  onScrollTopChange,
  scrollTop = 0,
}: DiffViewerBaseProps) {
  const [hoveredHunkIdx, setHoveredHunkIdx] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const diffInteraction = useDiffInteraction();
  const fileHeaderBelow = diffInteraction.renderFileHeaderBelow?.({ filePath });
  const { hiddenLineCount, visibleHunks } = useMemo(
    () => getBoundedDiffHunks(hunks),
    [hunks],
  );

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollTop;
  }, [filePath, hunks.length, loading, scrollTop]);

  return (
    <div className="flex h-full flex-col bg-background-emphasis text-sm">
      <div className="flex items-center justify-end gap-2 border-b border-border bg-background px-4 py-2">
        {(["unified", "split"] as DiffDisplayMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`rounded px-2 py-1 text-xs transition-colors ${
              displayMode === mode
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
            onClick={() => onDisplayModeChange?.(mode)}
          >
            {mode === "unified" ? "Unified" : "Split"}
          </button>
        ))}
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto px-4 pt-4"
        onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
      >
        {loading ? <div className="text-blue-400">Loading diff...</div> : null}
        {error ? <div className="text-red-400">{error}</div> : null}
        {hunks.length === 0 && !loading && !error ? <div>No changes.</div> : null}
        {fileHeaderBelow ? <div className="mb-3">{fileHeaderBelow}</div> : null}
        {hiddenLineCount > 0 ? (
          <div className="mb-3 rounded border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            Large diff limited to the first {DIFF_RENDER_LINE_CAP.toLocaleString()} lines.{" "}
            {hiddenLineCount.toLocaleString()} lines hidden.
          </div>
        ) : null}
        {visibleHunks.map((hunk, idx) => (
          <DiffHunk
            key={idx}
            hunk={hunk}
            filePath={filePath}
            hunkIdx={idx}
            extraContext={extraContext[idx]}
            isHovered={hoveredHunkIdx === idx}
            setHoveredHunkIdx={setHoveredHunkIdx}
            handleExpandContext={onExpandContext}
            handleLineMouseDown={onLineMouseDown}
            handleLineMouseEnter={onLineMouseEnter}
            handleStageBlock={onStageBlock}
            canStage={canStage}
            displayMode={displayMode}
          />
        ))}
      </div>
    </div>
  );
}
