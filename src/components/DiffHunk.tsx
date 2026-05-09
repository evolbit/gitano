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
  setStagedLines: (hunkIdx: number, lines: Set<number>) => void;
  extraContext: Record<number, { above: DiffLine[]; below: DiffLine[] }>;
  setExtraContext: React.Dispatch<
    React.SetStateAction<
      Record<number, { above: DiffLine[]; below: DiffLine[] }>
    >
  >;
  hoveredHunkIdx: number | null;
  setHoveredHunkIdx: React.Dispatch<React.SetStateAction<number | null>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  dragHunkIdx: number | null;
  setDragHunkIdx: React.Dispatch<React.SetStateAction<number | null>>;
  dragMode: "add" | "remove" | null;
  setDragMode: React.Dispatch<React.SetStateAction<"add" | "remove" | null>>;
  handleExpandContext: (
    hunkIdx: number,
    direction: ContextDirection,
    lines: number
  ) => void;
  handleToggleLineStage: (hunkIdx: number, lineIdx: number) => void;
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
  handleStageHunk: (hunkIdx: number) => void;
  canStage?: boolean;
}

const DiffHunk: React.FC<DiffHunkProps> = ({
  hunk,
  hunkIdx,
  stagedLines,
  setStagedLines,
  extraContext,
  setExtraContext,
  hoveredHunkIdx,
  setHoveredHunkIdx,
  isDragging,
  setIsDragging,
  dragHunkIdx,
  setDragHunkIdx,
  dragMode,
  setDragMode,
  handleExpandContext,
  handleToggleLineStage,
  handleLineMouseDown,
  handleLineMouseEnter,
  handleStageHunk,
  canStage = false,
}) => {
  const isHovered = hoveredHunkIdx === hunkIdx;
  return (
    <div
      className={`mb-6 border border-border rounded bg-background ${
        isHovered ? "ring-2 ring-blue-400/40" : ""
      }`}
      onMouseEnter={() => setHoveredHunkIdx(hunkIdx)}
      onMouseLeave={() => setHoveredHunkIdx(null)}>
      {/* Hunk header with buttons */}
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
                  Eliminar
                </button>
              </>
            ) : (
              <>
                <button
                  className="px-2 py-1 text-xs bg-blue-700 hover:bg-blue-800 text-white rounded"
                  onClick={() => handleStageHunk(hunkIdx)}>
                  {(() => {
                    // Count how many lines are stageable in this hunk
                    const stageableLines = hunk.lines.filter(
                      (line) => line.kind === "Add" || line.kind === "Del"
                    ).length;
                    // Count how many lines are currently staged
                    const stagedCount = stagedLines[hunkIdx]?.size || 0;
                    // If all stageable lines are staged, show "Deselect all"
                    return stagedCount === stageableLines
                      ? "Deselect all"
                      : "Select all";
                  })()}
                </button>
                <button
                  className="px-2 py-1 text-xs bg-green-700 hover:bg-green-800 text-white rounded disabled:opacity-50"
                  disabled={
                    !(stagedLines[hunkIdx] && stagedLines[hunkIdx].size > 0)
                  }
                  onClick={() => {
                    // Real staging logic should go here; for now it only logs
                    const staged = stagedLines[hunkIdx]
                      ? Array.from(stagedLines[hunkIdx])
                      : [];
                    console.log("Stage lines for hunk", hunkIdx, staged);
                  }}>
                  Stage
                </button>
              </>
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
              showChecks={false}
            />
          ))}
        </>
      )}
      {/* Hunk lines */}
      {hunk.lines.map((line, lineIdx) => {
        const isStageable = line.kind === "Add" || line.kind === "Del";
        const isStaged = stagedLines[hunkIdx]?.has(lineIdx);
        return (
          <DiffLineRow
            key={lineIdx}
            line={line}
            showChecks={!hunk.is_new_file && isStageable}
            isStaged={isStaged}
            onCheck={
              hunk.is_new_file
                ? undefined
                : () => handleToggleLineStage(hunkIdx, lineIdx)
            }
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
              showChecks={false}
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

// Component that renders a diff line with checks, colors, and line numbers
const DiffLineRow: React.FC<{
  line: DiffLine;
  showChecks?: boolean;
  isStaged?: boolean;
  onCheck?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}> = ({
  line,
  showChecks = false,
  isStaged = false,
  onCheck,
  onMouseDown,
  onMouseEnter,
}) => {
  let baseColor = "";
  if (line.kind === "Add") baseColor = "text-green-400 bg-green-900/20";
  else if (line.kind === "Del") baseColor = "text-red-400 bg-red-900/20";
  else baseColor = "text-zinc-200";
  // If it is staged, use a blue background and white text
  const stagedColor = isStaged ? "bg-blue-600 text-white" : baseColor;
  return (
    <div
      className={`flex items-center px-4 py-0.5 ${stagedColor} text-xs font-mono group transition-colors duration-100`}
      style={{
        fontVariantNumeric: "tabular-nums",
        cursor: showChecks ? "pointer" : undefined,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}>
      {/* Check column for old_lineno */}
      <span className="w-6 h-4 flex items-center justify-center select-none">
        {showChecks && line.old_lineno !== null && isStaged ? (
          <IconCheck
            size={14}
            className="text-white"
          />
        ) : null}
      </span>
      {/* Check column for new_lineno */}
      <span className="w-6 h-4 flex items-center justify-center select-none">
        {showChecks && line.new_lineno !== null && isStaged ? (
          <IconCheck
            size={14}
            className="text-white"
          />
        ) : null}
      </span>
      {/* Line numbers */}
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
