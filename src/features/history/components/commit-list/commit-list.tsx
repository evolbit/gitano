import {
  LocalAiResultModal,
  LocalAiSetupModal,
} from "@/features/local-ai";
import {
  useGitActionsStore,
  useRepoStore,
} from "@/features/repository-workspace";
import TableVirtualResizable, {
  type TableColumn,
} from "@/shared/components/tables/table-virtual-resizable/table-virtual-resizable";
import { writeClipboardText } from "@/shared/platform/clipboard";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CommitActionDialog } from "./components/commit-action-dialog/commit-action-dialog";
import CommitAuthorCell from "./components/commit-author-cell/commit-author-cell";
import { CommitCompareModal } from "./components/commit-compare-modal/commit-compare-modal";
import { CommitContextMenu } from "./components/commit-context-menu/commit-context-menu";
import CommitGraphCell from "./components/commit-graph-cell/commit-graph-cell";
import { CommitSearchToolbar } from "./components/commit-search-toolbar/commit-search-toolbar";
import {
  COMMIT_HISTORY_WINDOW_SIZE,
  COMMIT_ROW_HEIGHT,
  GRAPH_LANE_WIDTH,
  GRAPH_MAX_WIDTH,
  GRAPH_MIN_WIDTH,
  GRAPH_PADDING_X,
} from "./constants";
import type {
  CommitCompareState,
  CommitTableRow,
} from "../../types/commit-list";
import { useCommitActionDialog } from "../../hooks/use-commit-action-dialog";
import { useCommitAiAnalysis } from "../../hooks/use-commit-ai-analysis";
import { useCommitContextMenuActions } from "../../hooks/use-commit-context-menu-actions";
import { useCommitListData } from "../../hooks/use-commit-list-data";
import {
  formatCommitDate,
  getRefBadgeClass,
  highlightMatches,
} from "./utils";

const WINDOW_EDGE_PREFETCH_ROWS = 24;
const COMMIT_DETAIL_LOOKAHEAD_ROWS = Math.floor(
  COMMIT_HISTORY_WINDOW_SIZE / 4,
);
const GRAPH_WINDOW_PREFETCH_ROWS = 80;
const GRAPH_WINDOW_LOAD_DEBOUNCE_MS = 40;
const VISIBLE_WINDOW_LOAD_DEBOUNCE_MS = 120;

type CommitListProps = {
  scrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
};

export default function CommitList({
  onScrollTopChange,
  scrollTop = 0,
}: CommitListProps = {}) {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const repoPath = useRepoStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.repoPath,
  );
  const selectedCommit = useRepoStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.selectedCommit,
  );
  const selectedBranch = useRepoStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.selectedBranch,
  );
  const setTabCommit = useRepoStore((s) => s.setTabCommit);
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);

  const [search, setSearch] = useState("");
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );

  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const [commitCompare, setCommitCompare] = useState<CommitCompareState | null>(
    null,
  );

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingVisibleWindowRef = useRef(false);
  const requestedVisibleAnchorRef = useRef<number | null>(null);
  const pendingVisibleAnchorRef = useRef<number | null>(null);
  const visibleWindowLoadTimerRef = useRef<number | null>(null);
  const requestedCommitPrefetchOffsetsRef = useRef<Set<number>>(new Set());
  const isLoadingGraphWindowRef = useRef(false);
  const pendingGraphWindowRef = useRef<{
    limit: number;
    offset: number;
  } | null>(null);
  const requestedGraphWindowKeyRef = useRef<string | null>(null);
  const graphWindowLoadTimerRef = useRef<number | null>(null);
  const lastReportedScrollTopRef = useRef<number | null>(null);
  const previousViewKeyRef = useRef<string | null>(null);
  const normalizedSearch = search.trim().toLowerCase();
  const isMacLike =
    typeof navigator !== "undefined" &&
    /(Mac|iPod|iPhone|iPad)/i.test(navigator.platform);
  const nextShortcut = isMacLike ? "⌘ G" : "Ctrl G";
  const prevShortcut = isMacLike ? "⌘ ⇧ G" : "Ctrl Shift G";

  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollContainer(el);
  }, []);

  const notifySuccess = useCallback(
    (title: string, details: string) => {
      setGitActionNotice({
        kind: "success",
        title,
        details,
        expanded: false,
      });
    },
    [setGitActionNotice],
  );

  const notifyError = useCallback(
    (title: string, actionError: unknown) => {
      setGitActionNotice({
        kind: "error",
        title,
        details:
          actionError instanceof Error
            ? actionError.message
            : String(actionError || "Unknown error"),
        expanded: false,
      });
    },
    [setGitActionNotice],
  );

  const {
    cachedCommitsByRowIndex,
    commits,
    error,
    graphRows,
    hasMoreWindow,
    hasPreviousWindow,
    loadCommits,
    loadCommitGraphWindow,
    loadCommitWindow,
    loading,
    prefetchCommitWindow,
    remoteUrl,
    repositoryState,
    refreshRepositorySurfaces,
    resetCommits,
    runCommitSearch,
    searchResult,
    totalCount,
    windowOffset,
  } = useCommitListData({ repoPath, scrollContainerRef });

  const {
    closeCommitAiAnalysis,
    closeCommitAiSetup,
    commitAiAnalysis,
    runCommitAiAnalysis,
  } = useCommitAiAnalysis({ repoPath, notifyError });

  const {
    branchName,
    closeDialog,
    dialog,
    dialogError,
    dialogLoading,
    handleConfirmDialog,
    openCommitDialog,
    setBranchName,
    setTagAnnotated,
    setTagDescription,
    setTagName,
    setWorktreeBranch,
    setWorktreePath,
    tagAnnotated,
    tagDescription,
    tagName,
    worktreeBranch,
    worktreePath,
  } = useCommitActionDialog({
    notifyError,
    notifySuccess,
    refreshRepositorySurfaces,
    repoPath,
    selectedBranch,
  });

  const copyText = useCallback(
    async (text: string, successTitle: string, successDetails: string) => {
      try {
        await writeClipboardText(text);
        notifySuccess(successTitle, successDetails);
      } catch (copyError) {
        notifyError("Copy failed", copyError);
      }
    },
    [notifyError, notifySuccess],
  );

  const {
    contextMenu,
    handleCommitMenuAction,
    handleRowContextMenu,
    menuPos,
    menuRef,
    remoteCommitUrl,
  } = useCommitContextMenuActions({
    copyText,
    notifyError,
    notifySuccess,
    openCommitDialog,
    remoteUrl,
    repoPath,
    runCommitAiAnalysis,
    selectedBranch,
    setCommitCompare,
    setKeyboardNavigation,
  });

  const toCommitTableRow = useCallback(
    (commit: typeof commits[number], rowIndex?: number): CommitTableRow => ({
        id: commit.sha,
        graphWidth: commit.graph_width ?? 0,
        graphLane: commit.graph_lane ?? 0,
        graphColor: commit.graph_color ?? 0,
        graphSegments: commit.graph_segments ?? [],
        refs: commit.refs ?? [],
        message: commit.message,
        date: commit.date,
        author: commit.author,
        authorInitial: commit.author_initial,
        authorAvatarUrl: commit.author_avatar_url,
        sha: commit.sha,
        rowIndex,
        commit,
    }),
    [],
  );

  const tableRows = useMemo<CommitTableRow[]>(
    () =>
      commits.map((commit, index) =>
        toCommitTableRow(commit, windowOffset + index),
      ),
    [commits, toCommitTableRow, windowOffset],
  );

  const graphRowsByIndex = useMemo(
    () => new Map(graphRows.map((row) => [row.rowIndex, row])),
    [graphRows],
  );

  const getPlaceholderRow = useCallback(
    (absoluteIndex: number): CommitTableRow | null => {
      const cachedCommit = cachedCommitsByRowIndex.get(absoluteIndex);
      if (cachedCommit) {
        return toCommitTableRow(cachedCommit, absoluteIndex);
      }

      const graphRow = graphRowsByIndex.get(absoluteIndex);
      const placeholderCommit = {
        sha: `placeholder-${absoluteIndex}`,
        graph_width: graphRow?.graphWidth ?? 0,
        graph_lane: graphRow?.graphLane ?? 0,
        graph_color: graphRow?.graphColor ?? 0,
        graph_segments: graphRow?.graphSegments ?? [],
        refs: graphRow?.refs ?? [],
        message: "Loading...",
        author: "",
        author_initial: "",
        author_avatar_url: null,
        date: 0,
        current_branch: "",
        source_branch: "",
        commit_history: [],
        files: 0,
      };

      return {
        id: `placeholder-${absoluteIndex}`,
        graphWidth: graphRow?.graphWidth ?? 0,
        graphLane: graphRow?.graphLane ?? 0,
        graphColor: graphRow?.graphColor ?? 0,
        graphSegments: graphRow?.graphSegments ?? [],
        refs: graphRow?.refs ?? [],
        message: "Loading...",
        date: 0,
        author: "",
        authorInitial: "",
        authorAvatarUrl: null,
        sha: "",
        rowIndex: absoluteIndex,
        isPlaceholder: true,
        commit: placeholderCommit,
      };
    },
    [cachedCommitsByRowIndex, graphRowsByIndex, toCommitTableRow],
  );

  const matchedCount = normalizedSearch ? (searchResult?.matchCount ?? 0) : 0;
  const currentMatchPosition =
    normalizedSearch && typeof searchResult?.currentMatchPosition === "number"
      ? searchResult.currentMatchPosition
      : -1;

  const graphColumnWidth = useMemo(() => {
    const maxGraphWidth = tableRows.reduce(
      (max, row) => Math.max(max, row.graphWidth),
      1,
    );
    const requiredWidth = maxGraphWidth * GRAPH_LANE_WIDTH + GRAPH_PADDING_X;
    return Math.min(GRAPH_MAX_WIDTH, Math.max(GRAPH_MIN_WIDTH, requiredWidth));
  }, [tableRows]);

  const loadVisibleCommitWindow = useCallback(
    async (anchorRowIndex: number) => {
      if (loading) {
        pendingVisibleAnchorRef.current = anchorRowIndex;
        return;
      }

      if (isLoadingVisibleWindowRef.current) {
        pendingVisibleAnchorRef.current = anchorRowIndex;
        return;
      }

      if (requestedVisibleAnchorRef.current === anchorRowIndex) {
        return;
      }

      isLoadingVisibleWindowRef.current = true;
      requestedVisibleAnchorRef.current = anchorRowIndex;

      try {
        await loadCommitWindow({ anchorRowIndex });
      } finally {
        isLoadingVisibleWindowRef.current = false;
        const pendingAnchor = pendingVisibleAnchorRef.current;
        pendingVisibleAnchorRef.current = null;

        if (
          typeof pendingAnchor === "number" &&
          pendingAnchor !== requestedVisibleAnchorRef.current
        ) {
          window.setTimeout(() => {
            void loadVisibleCommitWindow(pendingAnchor);
          }, VISIBLE_WINDOW_LOAD_DEBOUNCE_MS);
        }
      }
    },
    [loadCommitWindow, loading],
  );

  const loadGraphWindow = useCallback(
    async ({ limit, offset }: { limit: number; offset: number }) => {
      const key = `${offset}:${limit}`;

      if (isLoadingGraphWindowRef.current) {
        pendingGraphWindowRef.current = { offset, limit };
        return;
      }

      if (requestedGraphWindowKeyRef.current === key) {
        return;
      }

      isLoadingGraphWindowRef.current = true;
      requestedGraphWindowKeyRef.current = key;

      try {
        await loadCommitGraphWindow({ offset, limit });
      } finally {
        isLoadingGraphWindowRef.current = false;
        const pendingWindow = pendingGraphWindowRef.current;
        pendingGraphWindowRef.current = null;

        if (pendingWindow) {
          window.setTimeout(() => {
            void loadGraphWindow(pendingWindow);
          }, GRAPH_WINDOW_LOAD_DEBOUNCE_MS);
        }
      }
    },
    [loadCommitGraphWindow],
  );

  const scheduleGraphWindowLoad = useCallback(
    ({ endIndex, startIndex }: { endIndex: number; startIndex: number }) => {
      const offset = Math.max(startIndex - GRAPH_WINDOW_PREFETCH_ROWS, 0);
      const limit =
        endIndex -
        startIndex +
        1 +
        GRAPH_WINDOW_PREFETCH_ROWS * 2;

      pendingGraphWindowRef.current = { offset, limit };

      if (graphWindowLoadTimerRef.current !== null) {
        window.clearTimeout(graphWindowLoadTimerRef.current);
      }

      graphWindowLoadTimerRef.current = window.setTimeout(() => {
        const pendingWindow = pendingGraphWindowRef.current;
        pendingGraphWindowRef.current = null;
        graphWindowLoadTimerRef.current = null;

        if (pendingWindow) {
          void loadGraphWindow(pendingWindow);
        }
      }, GRAPH_WINDOW_LOAD_DEBOUNCE_MS);
    },
    [loadGraphWindow],
  );

  const scheduleVisibleCommitWindowLoad = useCallback(
    (anchorRowIndex: number) => {
      pendingVisibleAnchorRef.current = anchorRowIndex;

      if (visibleWindowLoadTimerRef.current !== null) {
        window.clearTimeout(visibleWindowLoadTimerRef.current);
      }

      visibleWindowLoadTimerRef.current = window.setTimeout(() => {
        const pendingAnchor = pendingVisibleAnchorRef.current;
        pendingVisibleAnchorRef.current = null;
        visibleWindowLoadTimerRef.current = null;

        if (typeof pendingAnchor === "number") {
          void loadVisibleCommitWindow(pendingAnchor);
        }
      }, VISIBLE_WINDOW_LOAD_DEBOUNCE_MS);
    },
    [loadVisibleCommitWindow],
  );

  const isCommitDetailRangeCached = useCallback(
    (offset: number) => {
      if (!totalCount || offset < 0 || offset >= totalCount) {
        return true;
      }

      const endIndex = Math.min(
        offset + COMMIT_HISTORY_WINDOW_SIZE - 1,
        totalCount - 1,
      );

      return (
        cachedCommitsByRowIndex.has(offset) &&
        cachedCommitsByRowIndex.has(endIndex)
      );
    },
    [cachedCommitsByRowIndex, totalCount],
  );

  const prefetchCommitDetailsByOffset = useCallback(
    (offset: number) => {
      if (!totalCount || offset < 0 || offset >= totalCount) {
        return;
      }

      if (isCommitDetailRangeCached(offset)) {
        return;
      }

      if (requestedCommitPrefetchOffsetsRef.current.has(offset)) {
        return;
      }

      requestedCommitPrefetchOffsetsRef.current.add(offset);
      void prefetchCommitWindow({ offset }).finally(() => {
        requestedCommitPrefetchOffsetsRef.current.delete(offset);
      });
    },
    [isCommitDetailRangeCached, prefetchCommitWindow, totalCount],
  );

  const handleVisibleRangeChange = useCallback(
    ({
      endIndex,
      startIndex,
    }: {
      startIndex: number;
      endIndex: number;
    }) => {
      if (!tableRows.length || loading) {
        return;
      }

      const loadedStart = windowOffset;
      const loadedEnd = windowOffset + tableRows.length - 1;
      const graphStart = graphRows[0]?.rowIndex ?? -1;
      const graphEnd =
        graphRows[graphRows.length - 1]?.rowIndex ?? -1;
      const shouldLoadNextWindow =
        hasMoreWindow && endIndex >= loadedEnd - WINDOW_EDGE_PREFETCH_ROWS;
      const shouldLoadPreviousWindow =
        hasPreviousWindow &&
        startIndex <= loadedStart + WINDOW_EDGE_PREFETCH_ROWS;

      if (
        startIndex < graphStart + WINDOW_EDGE_PREFETCH_ROWS ||
        endIndex > graphEnd - WINDOW_EDGE_PREFETCH_ROWS
      ) {
        scheduleGraphWindowLoad({ startIndex, endIndex });
      }

      if (
        hasMoreWindow &&
        !shouldLoadNextWindow &&
        endIndex >= loadedEnd - COMMIT_DETAIL_LOOKAHEAD_ROWS
      ) {
        prefetchCommitDetailsByOffset(loadedEnd + 1);
      }

      if (
        hasPreviousWindow &&
        !shouldLoadPreviousWindow &&
        startIndex <= loadedStart + COMMIT_DETAIL_LOOKAHEAD_ROWS
      ) {
        prefetchCommitDetailsByOffset(
          Math.max(loadedStart - COMMIT_HISTORY_WINDOW_SIZE, 0),
        );
      }

      if (shouldLoadNextWindow) {
        scheduleVisibleCommitWindowLoad(endIndex);
        return;
      }

      if (shouldLoadPreviousWindow) {
        scheduleVisibleCommitWindowLoad(startIndex);
      }
    },
    [
      hasMoreWindow,
      hasPreviousWindow,
      graphRows,
      loading,
      prefetchCommitDetailsByOffset,
      scheduleGraphWindowLoad,
      scheduleVisibleCommitWindowLoad,
      tableRows.length,
      windowOffset,
    ],
  );

  useEffect(
    () => () => {
      if (visibleWindowLoadTimerRef.current !== null) {
        window.clearTimeout(visibleWindowLoadTimerRef.current);
        visibleWindowLoadTimerRef.current = null;
      }
      if (graphWindowLoadTimerRef.current !== null) {
        window.clearTimeout(graphWindowLoadTimerRef.current);
        graphWindowLoadTimerRef.current = null;
      }
    },
    [],
  );

  const columns = useMemo<TableColumn<CommitTableRow>[]>(
    () => [
      {
        key: "graphSegments",
        label: "Graph",
        width: graphColumnWidth,
        minWidth: 72,
        cellClassName: "px-0",
        render: (_: unknown, row: CommitTableRow) => (
          <CommitGraphCell
            rowHeight={COMMIT_ROW_HEIGHT}
            graphWidth={row.graphWidth}
            lane={row.graphLane}
            colorIdx={row.graphColor}
            segments={row.graphSegments ?? []}
          />
        ),
      },
      {
        key: "message",
        label: "Description",
        width: 460,
        minWidth: 260,
        grow: true,
        cellClassName: "px-3 text-zinc-400",
        render: (value: string, row: CommitTableRow) => (
          <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
            {row.refs.map((refLabel) => (
              <span
                key={`${row.id}-${refLabel}`}
                className={`inline-flex max-w-[280px] flex-shrink-0 items-center rounded border px-1.5 py-0.5 text-xs font-medium leading-none ${getRefBadgeClass(
                  refLabel,
                )}`}
                title={refLabel}
              >
                <span className="truncate">
                  {highlightMatches(refLabel, normalizedSearch)}
                </span>
              </span>
            ))}
            <span
              className={`min-w-0 truncate ${
                row.isPlaceholder ? "text-zinc-500" : ""
              }`}
            >
              {row.isPlaceholder
                ? "Loading..."
                : highlightMatches(value, normalizedSearch)}
            </span>
          </div>
        ),
      },
      {
        key: "date",
        label: "Date",
        width: 170,
        cellClassName: "px-3 text-zinc-400",
        render: (value: number, row: CommitTableRow) =>
          row.isPlaceholder ? null : formatCommitDate(value),
      },
      {
        key: "author",
        label: "Author",
        width: 170,
        cellClassName: "px-3 text-zinc-400",
        render: (_: string, row: CommitTableRow) => (
          row.isPlaceholder ? null : (
            <CommitAuthorCell
              key={`${row.id}-${row.rowIndex ?? ""}`}
              author={row.author}
              initial={row.authorInitial}
              avatarUrl={row.authorAvatarUrl}
            />
          )
        ),
      },
      {
        key: "sha",
        label: "Commit",
        width: 96,
        cellClassName: "px-3 font-mono",
        render: (value: string, row: CommitTableRow) =>
          row.isPlaceholder ? null : (
            <span className="text-zinc-400">{value.slice(0, 7)}</span>
          ),
      },
    ],
    [graphColumnWidth, normalizedSearch],
  );

  useEffect(() => {
    const viewKey = `${activeTabId ?? ""}|${repoPath ?? ""}`;
    const previousViewKey = previousViewKeyRef.current;

    previousViewKeyRef.current = viewKey;
    pendingGraphWindowRef.current = null;
    pendingVisibleAnchorRef.current = null;
    requestedCommitPrefetchOffsetsRef.current.clear();
    requestedGraphWindowKeyRef.current = null;
    requestedVisibleAnchorRef.current = null;
    lastReportedScrollTopRef.current = null;
    resetCommits();
    setSelectedRowIndex(-1);

    if (previousViewKey && previousViewKey !== viewKey && activeTabId) {
      setTabCommit(activeTabId, null);
    }

    void loadCommits({ resetScroll: true });
  }, [repoPath, activeTabId, setTabCommit, loadCommits, resetCommits]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!tableRows.length || !isTableFocused) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setKeyboardNavigation(true);
          if (selectedRowIndex >= tableRows.length - 1 && hasMoreWindow) {
            void loadCommitWindow({
              offset: windowOffset + tableRows.length,
            }).then((nextWindow) => {
              if (nextWindow?.commits.length) {
                setSelectedRowIndex(0);
              }
            });
          } else {
            setSelectedRowIndex((prev) => {
              const maxIndex = tableRows.length - 1;
              return Math.min(prev + 1, maxIndex);
            });
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          setKeyboardNavigation(true);
          if (selectedRowIndex <= 0 && hasPreviousWindow) {
            const targetRowIndex = Math.max(windowOffset - 1, 0);
            const nextOffset = Math.max(
              windowOffset - COMMIT_HISTORY_WINDOW_SIZE,
              0,
            );
            void loadCommitWindow({ offset: nextOffset }).then((nextWindow) => {
              if (nextWindow?.commits.length) {
                setSelectedRowIndex(targetRowIndex - nextWindow.offset);
              }
            });
          } else {
            setSelectedRowIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case "Home":
          event.preventDefault();
          setKeyboardNavigation(true);
          setSelectedRowIndex(0);
          break;
        case "End":
          event.preventDefault();
          setKeyboardNavigation(true);
          setSelectedRowIndex(tableRows.length - 1);
          break;
        case "Enter":
          event.preventDefault();
          if (selectedRowIndex >= 0 && selectedRowIndex < tableRows.length) {
            const nextCommit = tableRows[selectedRowIndex].commit;
            if (activeTabId) {
              setTabCommit(activeTabId, nextCommit);
            }
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeTabId,
    hasMoreWindow,
    hasPreviousWindow,
    isTableFocused,
    loadCommitWindow,
    selectedRowIndex,
    setTabCommit,
    tableRows,
    windowOffset,
  ]);

  useEffect(() => {
    const handleFocus = () => {
      setIsTableFocused(true);
    };

    const handleBlur = () => {
      setIsTableFocused(false);
    };

    if (scrollContainer) {
      scrollContainer.addEventListener("focus", handleFocus);
      scrollContainer.addEventListener("blur", handleBlur);
      scrollContainer.tabIndex = 0;
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("focus", handleFocus);
        scrollContainer.removeEventListener("blur", handleBlur);
      }
    };
  }, [scrollContainer]);

  const clearSelection = useCallback(() => {
    setSelectedRowIndex(-1);
    if (activeTabId) {
      setTabCommit(activeTabId, null);
    }
  }, [activeTabId, setTabCommit]);

  const navigateSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (!normalizedSearch || !matchedCount) {
        return;
      }

      setKeyboardNavigation(true);
      const currentRowIndex =
        selectedRowIndex >= 0 ? windowOffset + selectedRowIndex : undefined;

      void runCommitSearch({
        query: search,
        currentRowIndex,
        direction: direction === 1 ? "next" : "previous",
      }).then((result) => {
        if (
          !result ||
          typeof result.matchedRowIndex !== "number" ||
          typeof result.loadedWindowOffset !== "number"
        ) {
          return;
        }

        setSelectedRowIndex(
          result.matchedRowIndex - result.loadedWindowOffset,
        );

        if (activeTabId && result.loadedCommit) {
          setTabCommit(activeTabId, result.loadedCommit);
        }
      });
    },
    [
      activeTabId,
      matchedCount,
      normalizedSearch,
      runCommitSearch,
      search,
      selectedRowIndex,
      setTabCommit,
      windowOffset,
    ],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      const currentRowIndex =
        selectedRowIndex >= 0 ? windowOffset + selectedRowIndex : undefined;
      void runCommitSearch({
        query: value,
        currentRowIndex,
      });
    },
    [runCommitSearch, selectedRowIndex, windowOffset],
  );

  const handleRowClick = (row: CommitTableRow, index: number) => {
    if (row.isPlaceholder || !row.commit) {
      return;
    }

    if (selectedRowIndex === index) {
      clearSelection();
      return;
    }

    setSelectedRowIndex(index);
    if (activeTabId) {
      setTabCommit(activeTabId, row.commit);
    }
  };

  useEffect(() => {
    if (
      selectedRowIndex >= 0 &&
      selectedRowIndex < tableRows.length &&
      activeTabId
    ) {
      const nextCommit = tableRows[selectedRowIndex].commit;
      if (selectedCommit?.sha === nextCommit.sha) {
        return;
      }
      setTabCommit(activeTabId, nextCommit);
    }
  }, [selectedRowIndex, tableRows, activeTabId, selectedCommit, setTabCommit]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || selectedRowIndex < 0) return;
      event.preventDefault();
      clearSelection();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [selectedRowIndex, clearSelection]);

  useEffect(() => {
    const handleSearchShortcuts = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.key.toLowerCase() !== "g") {
        return;
      }

      if (!normalizedSearch || !matchedCount) {
        return;
      }

      event.preventDefault();
      navigateSearchMatch(event.shiftKey ? -1 : 1);
    };

    document.addEventListener("keydown", handleSearchShortcuts);
    return () => {
      document.removeEventListener("keydown", handleSearchShortcuts);
    };
  }, [matchedCount, navigateSearchMatch, normalizedSearch]);

  useEffect(() => {
    if (!selectedCommit) {
      setSelectedRowIndex(-1);
      return;
    }

    const selectedCommitIndex = tableRows.findIndex(
      (row) => row.commit.sha === selectedCommit.sha,
    );

    if (selectedCommitIndex >= 0) {
      setSelectedRowIndex(selectedCommitIndex);
      return;
    }

    setSelectedRowIndex(-1);
  }, [tableRows, selectedCommit]);

  useEffect(() => {
    const scrollElement = scrollContainerRef.current;

    if (!scrollElement) return;

    const tableScrollElement = scrollElement.querySelector<HTMLDivElement>(
      "[data-virtualizer-scroll]",
    );

    if (tableScrollElement) {
      const lastReportedScrollTop = lastReportedScrollTopRef.current;
      if (
        typeof lastReportedScrollTop === "number" &&
        Math.abs(lastReportedScrollTop - scrollTop) < 1
      ) {
        return;
      }
      if (Math.abs(tableScrollElement.scrollTop - scrollTop) < 1) {
        return;
      }
      tableScrollElement.scrollTop = scrollTop;
    }
  }, [scrollContainer, scrollTop]);

  const handleScrollTopChange = useCallback(
    (nextScrollTop: number) => {
      lastReportedScrollTopRef.current = nextScrollTop;
      onScrollTopChange?.(nextScrollTop);
    },
    [onScrollTopChange],
  );

  return (
    <div className="h-full w-full flex flex-col p-2">
      <CommitSearchToolbar
        search={search}
        matchedCount={matchedCount}
        currentMatchPosition={currentMatchPosition}
        nextShortcut={nextShortcut}
        prevShortcut={prevShortcut}
        onNavigate={navigateSearchMatch}
        onSearchChange={handleSearchChange}
      />
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      <div
        ref={setContainerRef}
        className="flex-1 overflow-y-auto focus:outline-none"
      >
        {loading && !tableRows.length && repositoryState?.hasCommits !== false ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Loading commits...
          </div>
        ) : !loading && !error && repositoryState?.hasCommits === false ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Stage files and create the initial commit to start repository
            history.
          </div>
        ) : (
          <TableVirtualResizable
            columns={columns}
            data={tableRows}
            totalRowCount={totalCount || tableRows.length}
            rowIndexOffset={windowOffset}
            getPlaceholderRow={getPlaceholderRow}
            rowHeight={COMMIT_ROW_HEIGHT}
            loading={loading}
            onVisibleRangeChange={handleVisibleRangeChange}
            onScrollTopChange={handleScrollTopChange}
            onRowClick={handleRowClick}
            onRowContextMenu={(row, index, event) => {
              if (row.isPlaceholder || !row.commit) return;
              handleRowContextMenu(row, index, event);
            }}
            selectedRowIndex={selectedRowIndex}
            keyboardNavigation={keyboardNavigation}
            setKeyboardNavigation={setKeyboardNavigation}
          />
        )}
      </div>
      {contextMenu && menuPos ? (
        <CommitContextMenu
          commit={contextMenu.row.commit}
          x={menuPos.x}
          y={menuPos.y}
          menuRef={menuRef}
          remoteCommitUrl={remoteCommitUrl}
          currentBranch={selectedBranch}
          onAction={handleCommitMenuAction}
        />
      ) : null}
      {commitCompare && repoPath ? (
        <CommitCompareModal
          repoPath={repoPath}
          commit={commitCompare.commit}
          mode={commitCompare.mode}
          onClose={() => setCommitCompare(null)}
        />
      ) : null}
      {commitAiAnalysis ? (
        <LocalAiResultModal
          open
          title={`Analyze ${commitAiAnalysis.commit.sha.slice(0, 7)}`}
          result={commitAiAnalysis.result}
          loading={commitAiAnalysis.loading}
          error={commitAiAnalysis.error}
          progress={commitAiAnalysis.progress}
          externalEvents={commitAiAnalysis.externalEvents}
          onRefresh={() => {
            void runCommitAiAnalysis(commitAiAnalysis.commit, true);
          }}
          onClose={closeCommitAiAnalysis}
        />
      ) : null}
      {commitAiAnalysis?.setupOpen ? (
        <LocalAiSetupModal
          open
          actionKind="commitAnalysis"
          onClose={closeCommitAiSetup}
          onReady={() => {
            if (commitAiAnalysis) {
              void runCommitAiAnalysis(commitAiAnalysis.commit);
            }
          }}
        />
      ) : null}
      <CommitActionDialog
        dialog={dialog}
        dialogLoading={dialogLoading}
        dialogError={dialogError}
        branchName={branchName}
        setBranchName={setBranchName}
        tagName={tagName}
        setTagName={setTagName}
        tagAnnotated={tagAnnotated}
        setTagAnnotated={setTagAnnotated}
        tagDescription={tagDescription}
        setTagDescription={setTagDescription}
        worktreeBranch={worktreeBranch}
        setWorktreeBranch={setWorktreeBranch}
        worktreePath={worktreePath}
        setWorktreePath={setWorktreePath}
        repoPath={repoPath}
        selectedBranch={selectedBranch}
        onCancel={closeDialog}
        onConfirm={() => {
          void handleConfirmDialog();
        }}
      />
    </div>
  );
}
