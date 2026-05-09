import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFileHunksStore } from "../store/hunks";
import { useStagedLinesStore } from "../store/staging";
import DiffHunk from "./DiffHunk";
import FloatingCommitBar from "./FloatingCommitBar";

// Types for backend data
interface DiffLine {
  kind: "Add" | "Del" | "Context";
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
  is_new_file: boolean;
}

type ContextDirection = "Above" | "Below";

/**
 * To move the controls to the external top bar:
 * 1. Remove this component's internal header (name, counters, buttons).
 * 2. Expose a getFileActionsData() function that returns the data needed for the top bar.
 * 3. The parent should call getFileActionsData() and render the controls where appropriate.
 * 4. Alternatively, you can pass the prebuilt visual block as 'fileActionsBar' and it will render above the diff.
 */
interface DiffViewerProps {
  repoPath: string;
  filePath: string;
  sha?: string;
  context?: number;
  onFileActionsData?: (data: {
    filePath: string;
    insertions: number;
    deletions: number;
    canStage: boolean;
    canDiscard: boolean;
    canRemove: boolean;
    onStage: () => void;
    onDiscard: () => void;
    onRemove: () => void;
  }) => void;
  /**
   * If provided, this visual block is rendered above the scrollable diff area.
   * Example: <DiffViewer fileActionsBar={<MyBar filePath=... ... />} ... />
   */
  fileActionsBar?: React.ReactNode;
}

const CONTEXT_DEFAULT = 3;

const DiffViewer: React.FC<DiffViewerProps> = ({
  repoPath,
  filePath,
  sha,
  context = CONTEXT_DEFAULT,
  onFileActionsData,
}) => {
  // Local state for hunks when sha is defined
  const [localHunks, setLocalHunks] = useState<DiffHunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Store extra context above and below for each hunk
  const [extraContext, setExtraContext] = useState<
    Record<number, { above: DiffLine[]; below: DiffLine[] }>
  >({});
  // Global state for staged lines
  const stagedLines = useStagedLinesStore(
    useShallow((s) => s.stagedLines[filePath] || {})
  );
  const setStagedLinesGlobal = useStagedLinesStore(
    useShallow((s) => s.setStagedLines)
  );
  // Hunk hover state
  const [hoveredHunkIdx, setHoveredHunkIdx] = useState<number | null>(null);
  // State for drag-based multi-selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragHunkIdx, setDragHunkIdx] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<"add" | "remove" | null>(null);
  // Determine whether lines can be selected (working directory only)
  const canStage = sha === undefined;
  const canSelectLines = canStage;
  const [commitBarOpen, setCommitBarOpen] = useState(false);

  // Read hunks from the global store only when there is no sha
  const { hunks: storeHunks } = useFileHunksStore();
  const hunks = sha ? localHunks : storeHunks;

  // Clear extra context when the file or commit changes
  useEffect(() => {
    setExtraContext({});
  }, [filePath, sha]);

  // If sha is defined, request hunks from the backend
  useEffect(() => {
    if (!sha) return;
    setLoading(true);
    setError(null);
    invoke<DiffHunk[]>("get_commit_file_diff", {
      path: repoPath,
      sha,
      filePath,
      context,
    })
      .then((res) => {
        setLocalHunks(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLocalHunks([]);
        setLoading(false);
      });
  }, [repoPath, filePath, sha, context]);

  // Logic to expose action data to the parent
  useEffect(() => {
    if (!onFileActionsData) return;
    let insertions = 0;
    let deletions = 0;
    hunks.forEach((hunk) => {
      hunk.lines.forEach((line) => {
        if (line.kind === "Add") insertions++;
        if (line.kind === "Del") deletions++;
      });
    });
    let onlyAdd = hunks.length > 0;
    let onlyDel = hunks.length > 0;
    hunks.forEach((hunk) => {
      hunk.lines.forEach((line) => {
        if (line.kind !== "Add") onlyAdd = false;
        if (line.kind !== "Del") onlyDel = false;
      });
    });
    const canRemove = onlyAdd || onlyDel;
    const canStage = Object.values(stagedLines).some(
      (set) => set instanceof Set && set.size > 0
    );
    const canDiscard = hunks.length > 0;
    onFileActionsData({
      filePath,
      insertions,
      deletions,
      canStage,
      canDiscard,
      canRemove,
      onStage: () => {
        const staged = Object.entries(stagedLines).flatMap(([hunkIdx, set]) =>
          set instanceof Set
            ? Array.from(set).map((lineIdx) => ({
                hunkIdx: Number(hunkIdx),
                lineIdx,
              }))
            : []
        );
        console.log("Stage file", filePath, staged);
      },
      onDiscard: () => {
        console.log("Discard file", filePath);
      },
      onRemove: () => {
        console.log("Remove file", filePath);
      },
    });
  }, [filePath, hunks, stagedLines, onFileActionsData]);

  // Always compute modification counts
  let insertions = 0;
  let deletions = 0;
  hunks.forEach((hunk) => {
    hunk.lines.forEach((line) => {
      if (line.kind === "Add") insertions++;
      if (line.kind === "Del") deletions++;
    });
  });

  // Request more context above or below
  const handleExpandContext = async (
    hunkIdx: number,
    direction: ContextDirection,
    lines: number
  ) => {
    try {
      const prevHunk = extraContext[hunkIdx] || {
        above: [] as DiffLine[],
        below: [] as DiffLine[],
      };
      const offset =
        direction === "Above" ? prevHunk.above.length : prevHunk.below.length;
      const res = await invoke<DiffLine[]>("get_diff_context", {
        path: repoPath,
        filePath,
        hunkIndex: hunkIdx,
        direction,
        lines,
        context,
        offset,
      });
      setExtraContext((prev) => {
        const prevHunk = prev[hunkIdx] || {
          above: [] as DiffLine[],
          below: [] as DiffLine[],
        };
        if (direction === "Above") {
          return {
            ...prev,
            [hunkIdx]: { ...prevHunk, above: [...res, ...prevHunk.above] },
          };
        } else {
          return {
            ...prev,
            [hunkIdx]: { ...prevHunk, below: [...prevHunk.below, ...res] },
          };
        }
      });
    } catch (e) {
      setError(String(e));
    }
  };

  // Handler to select or deselect a line
  const handleToggleLineStage = (hunkIdx: number, lineIdx: number) => {
    if (!canSelectLines) return;
    const prevSet: Set<number> = stagedLines[hunkIdx]
      ? new Set<number>(Array.from(stagedLines[hunkIdx] as Set<number>))
      : new Set<number>();
    if (prevSet.has(lineIdx)) {
      prevSet.delete(lineIdx);
    } else {
      prevSet.add(lineIdx);
    }
    setStagedLinesGlobal(filePath, hunkIdx, prevSet);
  };

  // Handler to stage or deselect a contiguous block within a hunk
  const handleStageBlock = (hunkIdx: number, lineIdxs: number[]) => {
    if (!canSelectLines) return;
    const currentStaged = stagedLines[hunkIdx] || new Set<number>();
    const areAllLinesStaged = lineIdxs.every((lineIdx) =>
      currentStaged.has(lineIdx)
    );

    if (areAllLinesStaged) {
      const updated = new Set(currentStaged);
      lineIdxs.forEach((lineIdx) => updated.delete(lineIdx));
      setStagedLinesGlobal(filePath, hunkIdx, updated);
    } else {
      const updated = new Set(currentStaged);
      lineIdxs.forEach((lineIdx) => updated.add(lineIdx));
      setStagedLinesGlobal(filePath, hunkIdx, updated);
    }
  };

  // Global mouseup handler to finish a drag gesture
  useEffect(() => {
    if (!isDragging) return;
    const handleUp = () => {
      setIsDragging(false);
      setDragHunkIdx(null);
      setDragMode(null);
    };
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [isDragging]);

  // Handler for mousedown on a line
  const handleLineMouseDown = (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean
  ) => {
    if (!canSelectLines || !isStageable) return;
    setIsDragging(true);
    setDragHunkIdx(hunkIdx);
    setDragMode(isStaged ? "remove" : "add");
    // Select or deselect the initial line
    handleToggleLineStage(hunkIdx, lineIdx);
  };

  // Handler for mouseenter on a line during drag
  const handleLineMouseEnter = (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean
  ) => {
    if (
      !canSelectLines ||
      !isDragging ||
      dragHunkIdx !== hunkIdx ||
      !isStageable
    )
      return;
    if (dragMode === "add" && !isStaged) {
      handleToggleLineStage(hunkIdx, lineIdx);
    } else if (dragMode === "remove" && isStaged) {
      handleToggleLineStage(hunkIdx, lineIdx);
    }
  };

  return (
    <div className="bg-background-emphasis h-full flex flex-col font-mono text-sm">
      {/* Scrollable diff area */}
      <div className={`flex-1 overflow-auto px-4${canStage ? " pb-40" : ""}`}>
        {loading && <div className="text-blue-400">Loading diff...</div>}
        {error && <div className="text-red-400">{error}</div>}
        {hunks.length === 0 && !loading && !error && <div>No changes.</div>}
        {hunks.map((hunk, idx) => (
          <DiffHunk
            key={idx}
            hunk={hunk}
            hunkIdx={idx}
            stagedLines={stagedLines}
            extraContext={extraContext}
            hoveredHunkIdx={hoveredHunkIdx}
            setHoveredHunkIdx={setHoveredHunkIdx}
            handleExpandContext={handleExpandContext}
            handleLineMouseDown={handleLineMouseDown}
            handleLineMouseEnter={handleLineMouseEnter}
            handleStageBlock={handleStageBlock}
            canStage={canStage}
          />
        ))}
      </div>
      {/* Floating commit bar only when canStage is true (working directory) */}
      {canStage && (
        <FloatingCommitBar
          expanded={commitBarOpen}
          onExpand={() => setCommitBarOpen(true)}
          onCollapse={() => setCommitBarOpen(false)}
          repoPath={repoPath}
        />
      )}
    </div>
  );
};

export default DiffViewer;
