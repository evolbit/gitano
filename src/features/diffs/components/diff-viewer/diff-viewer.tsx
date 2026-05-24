import React, { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getCommitFileDiff,
  getDiffContext,
  getStashFileDiff,
} from "@/shared/api/git/diffs";
import { stageLines } from "@/shared/api/git/staging";
import { useFileHunksStore } from "@/features/diffs/stores/file-hunks-store";
import { useStagedLinesStore } from "@/features/working-changes";
import DiffViewerBase from "../diff-viewer-base/diff-viewer-base";
import {
  ContextDirection,
  DiffHunk as DiffHunkData,
  DiffLine as DiffLineData,
  DiffViewerProps,
} from "../../types";

const CONTEXT_DEFAULT = 3;

const DiffViewer: React.FC<DiffViewerProps> = ({
  repoPath,
  filePath,
  sha,
  context = CONTEXT_DEFAULT,
  onFileActionsData,
  onWorkingTreeStageChange,
  displayMode = "unified",
  onDisplayModeChange,
  diffSource = "commit",
}) => {
  // Local state for hunks when sha is defined
  const [localHunks, setLocalHunks] = useState<DiffHunkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Store extra context above and below for each hunk
  const [extraContext, setExtraContext] = useState<
    Record<number, { above: DiffLineData[]; below: DiffLineData[] }>
  >({});
  // Global state for staged lines
  const setStagedLinesGlobal = useStagedLinesStore(
    useShallow((s) => s.setStagedLines)
  );
  const setLineSelectionForFile = useStagedLinesStore(
    useShallow((s) => s.setLineSelectionForFile)
  );
  const setWholeFileStaged = useStagedLinesStore(
    useShallow((s) => s.setWholeFileStaged)
  );
  const hasAnyStagedLines = useStagedLinesStore(
    useShallow((s) => {
      const fileSelection = s.stagedLines[filePath] || {};
      return Object.values(fileSelection).some(
        (value) =>
          value === true || (value instanceof Set && value.size > 0)
      );
    })
  );
  const wholeFileStaged = useStagedLinesStore(
    (s) => !!s.stagedLines[filePath]?.isWholeFileStaged
  );
  // State for drag-based multi-selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragHunkIdx, setDragHunkIdx] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<"add" | "remove" | null>(null);
  const syncInFlightRef = useRef(false);
  const syncFrameRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read hunks from the global store only when there is no sha
  const { hunks: storeHunks } = useFileHunksStore();
  const hunks = sha ? localHunks : storeHunks;
  // Determine whether lines can be selected (working directory only)
  const canStage = sha === undefined;
  const isDeletedFile =
    hunks.length > 0 &&
    hunks.every((hunk) =>
      hunk.lines.every((line) => line.kind === "Del" || line.kind === "Context")
    );
  const canSelectLines = canStage && !isDeletedFile;

  const buildStageableSelection = useCallback(
    (excludedKeys?: Set<string>) => {
      const selection: Record<number, Set<number>> = {};

      hunks.forEach((hunk, hunkIdx) => {
        const lineSelection = new Set<number>();
        hunk.lines.forEach((line, lineIdx) => {
          if (line.kind !== "Add" && line.kind !== "Del") return;
          if (excludedKeys?.has(`${hunkIdx}:${lineIdx}`)) return;
          lineSelection.add(lineIdx);
        });
        if (lineSelection.size > 0) {
          selection[hunkIdx] = lineSelection;
        }
      });

      return selection;
    },
    [hunks],
  );

  const scheduleWorkingTreeRefresh = useCallback(() => {
    if (!onWorkingTreeStageChange) return;
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void onWorkingTreeStageChange();
    }, 120);
  }, [onWorkingTreeStageChange]);

  const syncLineSelection = useCallback(async (
    nextSelection?: Record<number, Set<number>>,
  ) => {
    if (!canSelectLines || syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    setError(null);

    try {
      const sourceSelection =
        nextSelection ??
        ((useStagedLinesStore.getState().stagedLines[filePath] || {}) as Record<
          number,
          Set<number>
        >);

      const hunksPayload: Record<number, number[]> = {};
      Object.entries(sourceSelection).forEach(([hunkIdx, lineSet]) => {
        if (!(lineSet instanceof Set) || lineSet.size === 0) return;
        hunksPayload[Number(hunkIdx)] = Array.from(lineSet).sort((a, b) => a - b);
      });

      await stageLines(repoPath, filePath, hunksPayload);
      scheduleWorkingTreeRefresh();
    } catch (err) {
      setError(String(err));
    } finally {
      syncInFlightRef.current = false;
    }
  }, [canSelectLines, filePath, repoPath, scheduleWorkingTreeRefresh]);

  const scheduleSelectionSync = useCallback(
    (nextSelection?: Record<number, Set<number>>) => {
      if (syncFrameRef.current !== null) {
        cancelAnimationFrame(syncFrameRef.current);
      }

      syncFrameRef.current = requestAnimationFrame(() => {
        syncFrameRef.current = null;
        void syncLineSelection(nextSelection);
      });
    },
    [syncLineSelection],
  );

  // Clear extra context when the file or commit changes
  useEffect(() => {
    setExtraContext({});
  }, [filePath, sha]);

  // If sha is defined, request hunks from the backend
  useEffect(() => {
    if (!sha) return;
    setLoading(true);
    setError(null);
    const getFileDiff =
      diffSource === "stash" ? getStashFileDiff : getCommitFileDiff;

    getFileDiff({
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
  }, [repoPath, filePath, sha, context, diffSource]);

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
    const canStage = hasAnyStagedLines;
    const canDiscard = hunks.length > 0;
    onFileActionsData({
      filePath,
      insertions,
      deletions,
      canStage,
      canDiscard,
      canRemove,
      onStage: () => {
        const staged = Object.entries(
          useStagedLinesStore.getState().stagedLines[filePath] || {}
        ).flatMap(([hunkIdx, set]) =>
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
  }, [filePath, hasAnyStagedLines, hunks, onFileActionsData]);

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
  const handleExpandContext = useCallback(async (
    hunkIdx: number,
    direction: ContextDirection,
    lines: number
  ) => {
    try {
      const prevHunk = extraContext[hunkIdx] || {
        above: [] as DiffLineData[],
        below: [] as DiffLineData[],
      };
      const offset =
        direction === "Above" ? prevHunk.above.length : prevHunk.below.length;
      const res = await getDiffContext({
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
          above: [] as DiffLineData[],
          below: [] as DiffLineData[],
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
  }, [context, extraContext, filePath, repoPath]);

  // Handler to select or deselect a line
  const handleToggleLineStage = useCallback((hunkIdx: number, lineIdx: number) => {
    if (!canSelectLines) return;
    if (wholeFileStaged) {
      const nextSelection = buildStageableSelection(
        new Set([`${hunkIdx}:${lineIdx}`]),
      );
      setWholeFileStaged(filePath, false);
      setLineSelectionForFile(filePath, nextSelection);
      return nextSelection[hunkIdx];
    }
    const currentSelection = useStagedLinesStore.getState().stagedLines[filePath] || {};
    const prevSet: Set<number> = currentSelection[hunkIdx]
      ? new Set<number>(Array.from(currentSelection[hunkIdx] as Set<number>))
      : new Set<number>();
    if (prevSet.has(lineIdx)) {
      prevSet.delete(lineIdx);
    } else {
      prevSet.add(lineIdx);
    }
    setStagedLinesGlobal(filePath, hunkIdx, prevSet);
    return prevSet;
  }, [
    buildStageableSelection,
    canSelectLines,
    filePath,
    setLineSelectionForFile,
    setStagedLinesGlobal,
    setWholeFileStaged,
    wholeFileStaged,
  ]);

  // Handler to stage or deselect a contiguous block within a hunk
  const handleStageBlock = useCallback(async (hunkIdx: number, lineIdxs: number[]) => {
    if (!canSelectLines) return;
    if (wholeFileStaged) {
      const nextSelection = buildStageableSelection(
        new Set(lineIdxs.map((lineIdx) => `${hunkIdx}:${lineIdx}`)),
      );
      setWholeFileStaged(filePath, false);
      setLineSelectionForFile(filePath, nextSelection);
      scheduleSelectionSync(nextSelection);
      return;
    }
    const currentSelection = useStagedLinesStore.getState().stagedLines[filePath] || {};
    const currentStaged = (currentSelection[hunkIdx] as Set<number> | undefined) || new Set<number>();
    const areAllLinesStaged = lineIdxs.every((lineIdx) =>
      currentStaged.has(lineIdx)
    );

    const nextSelection = {
      ...(useStagedLinesStore.getState().stagedLines[filePath] || {}),
    } as Record<number, Set<number>>;

    if (areAllLinesStaged) {
      const updated = new Set(currentStaged);
      lineIdxs.forEach((lineIdx) => updated.delete(lineIdx));
      setStagedLinesGlobal(filePath, hunkIdx, updated);
      nextSelection[hunkIdx] = updated;
      scheduleSelectionSync(nextSelection);
      return;
    }

    const updated = new Set(currentStaged);
    lineIdxs.forEach((lineIdx) => updated.add(lineIdx));
    setStagedLinesGlobal(filePath, hunkIdx, updated);
    nextSelection[hunkIdx] = updated;
    scheduleSelectionSync(nextSelection);
  }, [
    buildStageableSelection,
    canSelectLines,
    filePath,
    scheduleSelectionSync,
    setLineSelectionForFile,
    setStagedLinesGlobal,
    setWholeFileStaged,
    wholeFileStaged,
  ]);

  // Global mouseup handler to finish a drag gesture
  useEffect(() => {
    if (!isDragging) return;
    const handleUp = () => {
      scheduleSelectionSync();
      setIsDragging(false);
      setDragHunkIdx(null);
      setDragMode(null);
    };
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [isDragging, scheduleSelectionSync]);

  useEffect(
    () => () => {
      if (syncFrameRef.current !== null) {
        cancelAnimationFrame(syncFrameRef.current);
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    },
    [],
  );

  // Handler for mousedown on a line
  const handleLineMouseDown = useCallback((
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean
  ) => {
    if (!canSelectLines || !isStageable) return;
    setIsDragging(true);
    setDragHunkIdx(hunkIdx);
    setDragMode(isStaged ? "remove" : "add");
    handleToggleLineStage(hunkIdx, lineIdx);
  }, [canSelectLines, handleToggleLineStage]);

  // Handler for mouseenter on a line during drag
  const handleLineMouseEnter = useCallback((
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
  }, [canSelectLines, dragHunkIdx, dragMode, handleToggleLineStage, isDragging]);

  return (
    <DiffViewerBase
      filePath={filePath}
      hunks={hunks}
      loading={loading}
      error={error}
      extraContext={extraContext}
      displayMode={displayMode}
      onDisplayModeChange={onDisplayModeChange}
      onExpandContext={handleExpandContext}
      onLineMouseDown={handleLineMouseDown}
      onLineMouseEnter={handleLineMouseEnter}
      onStageBlock={handleStageBlock}
      canStage={canSelectLines}
    />
  );
};

export default DiffViewer;
