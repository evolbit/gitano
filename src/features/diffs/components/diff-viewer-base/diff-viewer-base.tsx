import { useState } from "react";
import DiffHunk from "../diff-hunk/diff-hunk";
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
};

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
}: DiffViewerBaseProps) {
  const [hoveredHunkIdx, setHoveredHunkIdx] = useState<number | null>(null);

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
      <div className="flex-1 overflow-auto px-4 pt-4">
        {loading ? <div className="text-blue-400">Loading diff...</div> : null}
        {error ? <div className="text-red-400">{error}</div> : null}
        {hunks.length === 0 && !loading && !error ? <div>No changes.</div> : null}
        {hunks.map((hunk, idx) => (
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
