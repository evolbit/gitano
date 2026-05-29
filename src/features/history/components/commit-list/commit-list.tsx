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
  toSearchableText,
} from "./utils";

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
    commits,
    error,
    loadCommits,
    loading,
    remoteUrl,
    repositoryState,
    refreshRepositorySurfaces,
    resetCommits,
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

  const tableRows = useMemo<CommitTableRow[]>(
    () =>
      commits.map((commit) => ({
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
        commit,
      })),
    [commits],
  );

  const matchedRowIndices = useMemo(() => {
    if (!normalizedSearch) {
      return [];
    }

    return tableRows.reduce<number[]>((matches, row, index) => {
      if (toSearchableText(row.commit).includes(normalizedSearch)) {
        matches.push(index);
      }
      return matches;
    }, []);
  }, [tableRows, normalizedSearch]);

  const currentMatchPosition = useMemo(() => {
    if (!matchedRowIndices.length) {
      return -1;
    }
    return matchedRowIndices.indexOf(selectedRowIndex);
  }, [matchedRowIndices, selectedRowIndex]);

  const graphColumnWidth = useMemo(() => {
    const maxGraphWidth = tableRows.reduce(
      (max, row) => Math.max(max, row.graphWidth),
      1,
    );
    const requiredWidth = maxGraphWidth * GRAPH_LANE_WIDTH + GRAPH_PADDING_X;
    return Math.min(GRAPH_MAX_WIDTH, Math.max(GRAPH_MIN_WIDTH, requiredWidth));
  }, [tableRows]);

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
                key={`${row.sha}-${refLabel}`}
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
            <span className="min-w-0 truncate">
              {highlightMatches(value, normalizedSearch)}
            </span>
          </div>
        ),
      },
      {
        key: "date",
        label: "Date",
        width: 170,
        cellClassName: "px-3 text-zinc-400",
        render: (value: number) => formatCommitDate(value),
      },
      {
        key: "author",
        label: "Author",
        width: 170,
        cellClassName: "px-3 text-zinc-400",
        render: (_: string, row: CommitTableRow) => (
          <CommitAuthorCell
            author={row.author}
            initial={row.authorInitial}
            avatarUrl={row.authorAvatarUrl}
          />
        ),
      },
      {
        key: "sha",
        label: "Commit",
        width: 96,
        cellClassName: "px-3 font-mono",
        render: (value: string) => (
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
          setSelectedRowIndex((prev) => {
            const maxIndex = tableRows.length - 1;
            return Math.min(prev + 1, maxIndex);
          });
          break;
        case "ArrowUp":
          event.preventDefault();
          setKeyboardNavigation(true);
          setSelectedRowIndex((prev) => Math.max(prev - 1, 0));
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
  }, [tableRows, selectedRowIndex, activeTabId, setTabCommit, isTableFocused]);

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
      if (!matchedRowIndices.length) {
        return;
      }

      const currentPosition = matchedRowIndices.indexOf(selectedRowIndex);
      const nextPosition =
        currentPosition === -1
          ? direction === 1
            ? 0
            : matchedRowIndices.length - 1
          : (currentPosition + direction + matchedRowIndices.length) %
            matchedRowIndices.length;

      const nextRowIndex = matchedRowIndices[nextPosition];
      const nextRow = tableRows[nextRowIndex];
      if (!nextRow) {
        return;
      }

      setKeyboardNavigation(true);
      setSelectedRowIndex(nextRowIndex);
      if (activeTabId) {
        setTabCommit(activeTabId, nextRow.commit);
      }
    },
    [activeTabId, matchedRowIndices, selectedRowIndex, setTabCommit, tableRows],
  );

  const handleRowClick = (row: CommitTableRow, index: number) => {
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

      if (!normalizedSearch || !matchedRowIndices.length) {
        return;
      }

      event.preventDefault();
      navigateSearchMatch(event.shiftKey ? -1 : 1);
    };

    document.addEventListener("keydown", handleSearchShortcuts);
    return () => {
      document.removeEventListener("keydown", handleSearchShortcuts);
    };
  }, [matchedRowIndices.length, navigateSearchMatch, normalizedSearch]);

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

    scrollElement.scrollTop = scrollTop;
  }, [commits.length, loading, scrollTop]);

  return (
    <div className="h-full w-full flex flex-col p-2">
      <CommitSearchToolbar
        search={search}
        matchedCount={matchedRowIndices.length}
        currentMatchPosition={currentMatchPosition}
        nextShortcut={nextShortcut}
        prevShortcut={prevShortcut}
        onNavigate={navigateSearchMatch}
        onSearchChange={setSearch}
      />
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      <div
        ref={setContainerRef}
        className="flex-1 overflow-y-auto focus:outline-none"
        onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
      >
        {!loading && !error && repositoryState?.hasCommits === false ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Stage files and create the initial commit to start repository
            history.
          </div>
        ) : (
          <TableVirtualResizable
            columns={columns}
            data={tableRows}
            rowHeight={COMMIT_ROW_HEIGHT}
            loading={loading}
            onRowClick={handleRowClick}
            onRowContextMenu={handleRowContextMenu}
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
