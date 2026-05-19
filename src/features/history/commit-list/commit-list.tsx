import { Tooltip } from "@mantine/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfirmModal } from "@/components/confirm-modal/confirm-modal";
import {
  createGitBranch,
  createGitWorktree,
} from "@/shared/api/git/branches";
import {
  cherryPickCommit,
  getCommitPatch,
  getCommitsListPaginated,
  getRemoteUrl,
  revertCommit,
} from "@/shared/api/git/commits";
import { createTag } from "@/shared/api/git/tags";
import {
  runLocalAiAction,
  type LocalAiRunResult,
} from "@/shared/api/local-ai";
import { getRepositoryState } from "@/shared/api/repositories";
import { APP_EVENTS } from "@/shared/config/events";
import { buildRemoteCommitUrl } from "@/shared/lib/git/remote-url";
import {
  writeClipboardText,
  writeClipboardTextFromPromise,
} from "@/shared/platform/clipboard";
import { openExternalUrl } from "@/shared/platform/tauri/opener";
import { IconChevronRight, IconSearch } from "@/components/icons";
import InputText from "@/components/form/input-text";
import TableVirtualResizable, {
  type TableColumn,
} from "@/components/tables/table-virtual-resizable";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { LocalAiResultModal, LocalAiSetupModal } from "@/features/local-ai";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { buildDefaultWorktreeFolder } from "@/features/worktrees/utils/worktree-defaults";
import type { CommitListItem } from "@/shared/types/git";
import type { RepositoryState } from "@/shared/types/git";
import CommitAuthorCell from "./commit-author-cell";
import {
  CommitCompareModal,
  type CommitCompareMode,
} from "./commit-compare-modal";
import {
  CommitContextMenu,
  type CommitContextMenuAction,
} from "./commit-context-menu";
import CommitGraphCell from "./commit-graph-cell";

const FULL_LOG_COMMIT_LIMIT = 100_000;
const COMMIT_ROW_HEIGHT = 30;
const GRAPH_LANE_WIDTH = 16;
const GRAPH_PADDING_X = 24;
const GRAPH_MIN_WIDTH = 120;
const GRAPH_MAX_WIDTH = 560;

type LoadCommitsOptions = {
  forceRefresh?: boolean;
  resetScroll?: boolean;
};

type CommitTableRow = {
  id: string;
  graphWidth: number;
  graphLane: number;
  graphColor: number;
  graphSegments: CommitListItem["graph_segments"];
  refs: string[];
  message: string;
  date: number;
  author: string;
  authorInitial: string;
  authorAvatarUrl?: string | null;
  sha: string;
  commit: CommitListItem;
};

type CommitContextMenuState = {
  row: CommitTableRow;
  x: number;
  y: number;
};

type CommitDialogState = {
  kind: "branch" | "tag" | "worktree" | "cherryPick" | "revert";
  commit: CommitListItem;
};

type CommitCompareState = {
  mode: CommitCompareMode;
  commit: CommitListItem;
};

type CommitAiAnalysisState = {
  commit: CommitListItem;
  result: LocalAiRunResult | null;
  loading: boolean;
  error: string | null;
  setupOpen: boolean;
};

function formatCommitDate(value: number): string {
  if (!value) return "";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSearchableText(commit: CommitListItem): string {
  return [commit.message, commit.author, commit.sha, ...(commit.refs ?? [])]
    .join(" ")
    .toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) {
    return text;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(pattern);
  if (parts.length <= 1) {
    return text;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span
        key={`${part}-${index}`}
        className="text-sky-400"
      >
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function getRefBadgeClass(refLabel: string): string {
  if (refLabel.startsWith("tag:")) {
    return "border-lime-500/40 bg-lime-500/10 text-lime-200";
  }
  if (refLabel.startsWith("origin/")) {
    return "border-blue-500/40 bg-blue-500/10 text-blue-200";
  }
  return "border-violet-500/40 bg-violet-500/10 text-violet-200";
}

export default function CommitList() {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const repoPath = useRepoStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.repoPath
  );
  const selectedCommit = useRepoStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.selectedCommit
  );
  const selectedBranch = useRepoStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.selectedBranch
  );
  const setTabCommit = useRepoStore((s) => s.setTabCommit);
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);

  const [search, setSearch] = useState("");
  const [commits, setCommits] = useState<CommitListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null
  );

  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const [contextMenu, setContextMenu] =
    useState<CommitContextMenuState | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CommitDialogState | null>(null);
  const [branchName, setBranchName] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagAnnotated, setTagAnnotated] = useState(false);
  const [tagDescription, setTagDescription] = useState("");
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [worktreePath, setWorktreePath] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [commitCompare, setCommitCompare] =
    useState<CommitCompareState | null>(null);
  const [commitAiAnalysis, setCommitAiAnalysis] =
    useState<CommitAiAnalysisState | null>(null);
  const [repositoryState, setRepositoryState] =
    useState<RepositoryState | null>(null);

  const loadRequestIdRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  const previousViewKeyRef = useRef<string | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setMenuPos(null);
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

  const refreshRepositorySurfaces = useCallback(() => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
  }, []);

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
    [commits]
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
      1
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
                  refLabel
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
    [graphColumnWidth, normalizedSearch]
  );

  const loadCommits = useCallback(
    async ({
      forceRefresh = false,
      resetScroll = false,
    }: LoadCommitsOptions = {}) => {
      if (!repoPath) {
        loadRequestIdRef.current += 1;
        setLoading(false);
        return;
      }

      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      setLoading(true);
      setError(null);

      try {
        const result = await getCommitsListPaginated({
          path: repoPath,
          offset: 0,
          limit: FULL_LOG_COMMIT_LIMIT,
          forceRefresh,
        });

        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        const pageCommits = result.commits || [];
        setCommits(pageCommits);

        if (result.has_more) {
          setError(
            `Commit history truncated after ${FULL_LOG_COMMIT_LIMIT.toLocaleString()} commits. Increase FULL_LOG_COMMIT_LIMIT if needed.`
          );
        }
        if (resetScroll && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      } catch (err) {
        if (requestId === loadRequestIdRef.current) {
          setError(String(err));
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [repoPath]
  );

  useEffect(() => {
    if (!repoPath) {
      setRemoteUrl(null);
      return;
    }

    let cancelled = false;
    getRemoteUrl(repoPath, "origin")
      .then((nextRemoteUrl) => {
        if (!cancelled) setRemoteUrl(nextRemoteUrl);
      })
      .catch(() => {
        if (!cancelled) setRemoteUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [repoPath]);

  useEffect(() => {
    if (!repoPath) {
      setRepositoryState(null);
      return;
    }

    let cancelled = false;

    const refreshRepositoryState = async () => {
      try {
        const nextState = await getRepositoryState(repoPath);
        if (!cancelled) setRepositoryState(nextState);
      } catch {
        if (!cancelled) setRepositoryState(null);
      }
    };

    void refreshRepositoryState();

    const handleRepoRefsRefresh = () => {
      void refreshRepositoryState();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    };
  }, [repoPath]);

  useEffect(() => {
    if (!contextMenu) return;

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeContextMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    }

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current || !menuPos) return;
    const rect = menuRef.current.getBoundingClientRect();
    const nextPos = { ...menuPos };

    if (menuPos.y + rect.height > window.innerHeight - 8) {
      nextPos.y = Math.max(8, menuPos.y - rect.height);
    }

    if (menuPos.x + rect.width > window.innerWidth - 8) {
      nextPos.x = Math.max(8, window.innerWidth - rect.width - 8);
    }

    if (nextPos.x !== menuPos.x || nextPos.y !== menuPos.y) {
      setMenuPos(nextPos);
    }
  }, [contextMenu, menuPos]);

  useEffect(() => {
    if (!repoPath) {
      return;
    }

    const handleCommitRefresh = () => {
      void loadCommits({ forceRefresh: true });
    };

    window.addEventListener(APP_EVENTS.commitsRefresh, handleCommitRefresh);

    return () => {
      window.removeEventListener(APP_EVENTS.commitsRefresh, handleCommitRefresh);
    };
  }, [loadCommits, repoPath]);

  useEffect(() => {
    const viewKey = `${activeTabId ?? ""}|${repoPath ?? ""}`;
    const previousViewKey = previousViewKeyRef.current;

    previousViewKeyRef.current = viewKey;
    setCommits([]);
    setSelectedRowIndex(-1);

    if (previousViewKey && previousViewKey !== viewKey && activeTabId) {
      setTabCommit(activeTabId, null);
    }

    void loadCommits({ resetScroll: true });
  }, [repoPath, activeTabId, setTabCommit, loadCommits]);

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
    [activeTabId, matchedRowIndices, selectedRowIndex, setTabCommit, tableRows]
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

  const openCommitDialog = useCallback(
    (kind: CommitDialogState["kind"], commit: CommitListItem) => {
      const shortSha = commit.sha.slice(0, 7);
      setDialog({ kind, commit });
      setDialogError(null);
      setBranchName(`commit-${shortSha}`);
      setTagName("");
      setTagAnnotated(false);
      setTagDescription("");
      setWorktreeBranch(`commit-${shortSha}`);
      setWorktreePath(buildDefaultWorktreeFolder(repoPath ?? "", `commit-${shortSha}`));
    },
    [repoPath],
  );

  const shouldOpenAiSetup = (analysisError: unknown) => {
    const message =
      analysisError instanceof Error
        ? analysisError.message
        : String(analysisError || "");
    return (
      message.includes("LOCAL_AI_MODEL_SETUP_REQUIRED") ||
      message.toLowerCase().includes("ollama") ||
      message.toLowerCase().includes("local ai")
    );
  };

  const runCommitAiAnalysis = useCallback(
    async (commit: CommitListItem, forceRefresh = false) => {
      if (!repoPath) return;

      setCommitAiAnalysis({
        commit,
        result: null,
        loading: true,
        error: null,
        setupOpen: false,
      });

      try {
        const result = await runLocalAiAction({
          repoPath,
          actionKind: "commitAnalysis",
          commitSha: commit.sha,
          forceRefresh,
        });
        setCommitAiAnalysis({
          commit,
          result,
          loading: false,
          error: null,
          setupOpen: false,
        });
      } catch (analysisError) {
        const openSetup = shouldOpenAiSetup(analysisError);
        if (!openSetup) {
          notifyError("Local AI analysis failed", analysisError);
        }
        setCommitAiAnalysis({
          commit,
          result: null,
          loading: false,
          error: null,
          setupOpen: openSetup,
        });
      }
    },
    [notifyError, repoPath],
  );

  const handleRowContextMenu = useCallback(
    (row: CommitTableRow, _index: number, event: React.MouseEvent) => {
      event.preventDefault();
      setKeyboardNavigation(false);
      setContextMenu({ row, x: event.clientX, y: event.clientY });
      setMenuPos({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  const handleCommitMenuAction = useCallback(
    (action: CommitContextMenuAction) => {
      if (!contextMenu || !repoPath) return;

      const { commit } = contextMenu.row;
      const remoteCommitUrl = remoteUrl
        ? buildRemoteCommitUrl(remoteUrl, commit.sha)
        : null;
      closeContextMenu();

      switch (action) {
        case "copySha":
          void copyText(
            commit.sha,
            "Copied commit SHA",
            `Copied ${commit.sha.slice(0, 12)}.`,
          );
          return;
        case "copyMessage":
          void copyText(
            commit.message,
            "Copied commit message",
            `Copied message for ${commit.sha.slice(0, 12)}.`,
          );
          return;
        case "copyPatch":
          void writeClipboardTextFromPromise(
            getCommitPatch(repoPath, commit.sha),
          )
            .then(() =>
              notifySuccess(
                "Copied patch",
                `Copied patch for ${commit.sha.slice(0, 12)}.`,
              ),
            )
            .catch((patchError) => notifyError("Copy patch failed", patchError));
          return;
        case "analyzeWithAi":
          void runCommitAiAnalysis(commit);
          return;
        case "compareWithParent":
          setCommitCompare({ mode: "parent", commit });
          return;
        case "compareWithWorkingTree":
          setCommitCompare({ mode: "workingTree", commit });
          return;
        case "createBranch":
          openCommitDialog("branch", commit);
          return;
        case "createTag":
          openCommitDialog("tag", commit);
          return;
        case "createWorktree":
          openCommitDialog("worktree", commit);
          return;
        case "cherryPick":
          if (selectedBranch) openCommitDialog("cherryPick", commit);
          return;
        case "revert":
          if (selectedBranch) openCommitDialog("revert", commit);
          return;
        case "openRemote":
          if (remoteCommitUrl) {
            void openExternalUrl(remoteCommitUrl).catch((openError) =>
              notifyError("Open commit on remote failed", openError),
            );
          }
          return;
        case "copyRemoteUrl":
          if (remoteCommitUrl) {
            void copyText(
              remoteCommitUrl,
              "Copied commit URL",
              `Copied remote URL for ${commit.sha.slice(0, 12)}.`,
            );
          }
          return;
      }
    },
    [
      closeContextMenu,
      contextMenu,
      copyText,
      notifyError,
      notifySuccess,
      openCommitDialog,
      remoteUrl,
      repoPath,
      runCommitAiAnalysis,
      selectedBranch,
    ],
  );

  const closeDialog = useCallback(() => {
    if (dialogLoading) return;
    setDialog(null);
    setDialogError(null);
  }, [dialogLoading]);

  const handleConfirmDialog = useCallback(async () => {
    if (!dialog || !repoPath || dialogLoading) return;

    const { commit } = dialog;
    setDialogLoading(true);
    setDialogError(null);

    try {
      if (dialog.kind === "branch") {
        const nextBranchName = branchName.trim();
        await createGitBranch(repoPath, nextBranchName, commit.sha);
        notifySuccess(
          "Created branch",
          `Created ${nextBranchName} from ${commit.sha.slice(0, 12)}.`,
        );
      } else if (dialog.kind === "tag") {
        const nextTagName = tagName.trim();
        await createTag(
          repoPath,
          nextTagName,
          commit.sha,
          tagAnnotated,
          tagAnnotated ? tagDescription.trim() : null,
        );
        notifySuccess(
          "Created tag",
          `Created ${nextTagName} at ${commit.sha.slice(0, 12)}.`,
        );
      } else if (dialog.kind === "worktree") {
        const nextBranch = worktreeBranch.trim();
        const nextPath = worktreePath.trim();
        await createGitWorktree(repoPath, nextPath, nextBranch, commit.sha);
        notifySuccess(
          "Created worktree",
          `Created ${nextBranch} from ${commit.sha.slice(0, 12)} at ${nextPath}.`,
        );
      } else if (dialog.kind === "cherryPick") {
        await cherryPickCommit(repoPath, commit.sha);
        notifySuccess(
          "Cherry-pick succeeded",
          `Cherry-picked ${commit.sha.slice(0, 12)} onto ${selectedBranch}.`,
        );
      } else if (dialog.kind === "revert") {
        await revertCommit(repoPath, commit.sha);
        notifySuccess(
          "Revert succeeded",
          `Reverted ${commit.sha.slice(0, 12)} on ${selectedBranch}.`,
        );
      }

      setDialog(null);
      refreshRepositorySurfaces();
    } catch (operationError) {
      const details =
        operationError instanceof Error
          ? operationError.message
          : String(operationError || "Unknown error");
      setDialogError(details);
      notifyError(
        dialog.kind === "cherryPick"
          ? "Cherry-pick failed"
          : dialog.kind === "revert"
            ? "Revert failed"
            : "Commit action failed",
        operationError,
      );

      if (dialog.kind === "cherryPick" || dialog.kind === "revert") {
        refreshRepositorySurfaces();
      }
    } finally {
      setDialogLoading(false);
    }
  }, [
    branchName,
    dialog,
    dialogLoading,
    notifyError,
    notifySuccess,
    refreshRepositorySurfaces,
    repoPath,
    selectedBranch,
    tagAnnotated,
    tagDescription,
    tagName,
    worktreeBranch,
    worktreePath,
  ]);

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
      (row) => row.commit.sha === selectedCommit.sha
    );

    if (selectedCommitIndex >= 0) {
      setSelectedRowIndex(selectedCommitIndex);
      return;
    }

    setSelectedRowIndex(-1);
  }, [tableRows, selectedCommit]);

  const dialogCommitLabel = dialog
    ? `${dialog.commit.sha.slice(0, 7)} · ${dialog.commit.message || "Untitled commit"}`
    : "";
  const dialogTitle = dialog
    ? dialog.kind === "branch"
      ? "Create Branch From Commit"
      : dialog.kind === "tag"
        ? "Create Tag At Commit"
        : dialog.kind === "worktree"
          ? "Create Worktree From Commit"
          : dialog.kind === "cherryPick"
            ? "Cherry-pick Commit"
            : "Revert Commit"
    : "";
  const dialogConfirmLabel = dialog
    ? dialog.kind === "branch"
      ? "Create Branch"
      : dialog.kind === "tag"
        ? "Create Tag"
        : dialog.kind === "worktree"
          ? "Create Worktree"
          : dialog.kind === "cherryPick"
            ? "Cherry-pick Commit"
            : "Revert Commit"
    : "Confirm";
  const dialogLoadingLabel = dialog
    ? dialog.kind === "branch"
      ? "Creating..."
      : dialog.kind === "tag"
        ? "Creating..."
        : dialog.kind === "worktree"
          ? "Creating..."
          : dialog.kind === "cherryPick"
            ? "Cherry-picking..."
            : "Reverting..."
    : "Working...";
  const dialogConfirmDisabled =
    !dialog ||
    (dialog.kind === "branch" && !branchName.trim()) ||
    (dialog.kind === "tag" && !tagName.trim()) ||
    (dialog.kind === "worktree" &&
      (!worktreeBranch.trim() || !worktreePath.trim()));

  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className="flex items-center pb-4">
        <InputText
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              navigateSearchMatch(1);
            }
          }}
          placeholder="Search commits..."
          className="flex-1 bg-zinc-800 rounded-lg px-3 h-9 mr-4"
          leftIcon={
            <IconSearch
              size={18}
              className="text-zinc-400"
            />
          }
        />
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Tooltip
            label={
              <div className="flex min-w-[230px] items-center justify-between gap-6">
                <span>Select Previous Match</span>
                <span className="font-medium text-zinc-300">{prevShortcut}</span>
              </div>
            }
          >
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary text-zinc-400 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigateSearchMatch(-1)}
              disabled={!matchedRowIndices.length}
            >
              <IconChevronRight
                size={14}
                className="rotate-180"
              />
            </button>
          </Tooltip>
          <Tooltip
            label={
              <div className="flex min-w-[210px] items-center justify-between gap-6">
                <span>Select Next Match</span>
                <span className="font-medium text-zinc-300">{nextShortcut}</span>
              </div>
            }
          >
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary text-zinc-400 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigateSearchMatch(1)}
              disabled={!matchedRowIndices.length}
            >
              <IconChevronRight size={14} />
            </button>
          </Tooltip>
          <span className="min-w-[56px] text-center text-zinc-300">
            {matchedRowIndices.length
              ? `${currentMatchPosition >= 0 ? currentMatchPosition + 1 : 0}/${matchedRowIndices.length}`
              : "0/0"}
          </span>
        </div>
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      <div
        ref={setContainerRef}
        className="flex-1 overflow-y-auto focus:outline-none">
        {!loading && !error && repositoryState?.hasCommits === false ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Stage files and create the initial commit to start repository history.
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
          remoteCommitUrl={
            remoteUrl
              ? buildRemoteCommitUrl(remoteUrl, contextMenu.row.commit.sha)
              : null
          }
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
          onRefresh={() => {
            void runCommitAiAnalysis(commitAiAnalysis.commit, true);
          }}
          onClose={() => setCommitAiAnalysis(null)}
        />
      ) : null}
      {commitAiAnalysis?.setupOpen ? (
        <LocalAiSetupModal
          open
          actionKind="commitAnalysis"
          onClose={() =>
            setCommitAiAnalysis((current) =>
              current ? { ...current, setupOpen: false } : current,
            )
          }
          onReady={() => {
            if (commitAiAnalysis) {
              void runCommitAiAnalysis(commitAiAnalysis.commit);
            }
          }}
        />
      ) : null}
      <ConfirmModal
        open={dialog !== null}
        title={dialogTitle}
        description={
          dialog ? (
            <span>
              {dialog.kind === "cherryPick" || dialog.kind === "revert"
                ? `${dialogConfirmLabel} on ${selectedBranch ?? "current branch"}`
                : dialogConfirmLabel}{" "}
              <span className="font-mono text-blue-200">{dialogCommitLabel}</span>
            </span>
          ) : null
        }
        details={
          dialog ? (
            <div className="space-y-3">
              {dialog.kind === "branch" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-300">
                    Branch name
                  </span>
                  <input
                    type="text"
                    className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
                    value={branchName}
                    disabled={dialogLoading}
                    onChange={(event) => setBranchName(event.target.value)}
                    autoFocus
                  />
                </label>
              ) : null}
              {dialog.kind === "tag" ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-300">
                      Tag name
                    </span>
                    <input
                      type="text"
                      className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
                      value={tagName}
                      disabled={dialogLoading}
                      onChange={(event) => setTagName(event.target.value)}
                      autoFocus
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-background"
                      checked={tagAnnotated}
                      disabled={dialogLoading}
                      onChange={(event) => setTagAnnotated(event.target.checked)}
                    />
                    Annotated tag
                  </label>
                  {tagAnnotated ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-300">
                        Description
                      </span>
                      <textarea
                        className="min-h-20 w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500/60"
                        value={tagDescription}
                        disabled={dialogLoading}
                        onChange={(event) => setTagDescription(event.target.value)}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              {dialog.kind === "worktree" ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-300">
                      Branch
                    </span>
                    <input
                      type="text"
                      className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
                      value={worktreeBranch}
                      disabled={dialogLoading}
                      onChange={(event) => {
                        const nextBranch = event.target.value;
                        setWorktreeBranch(nextBranch);
                        if (repoPath) {
                          setWorktreePath(
                            buildDefaultWorktreeFolder(repoPath, nextBranch),
                          );
                        }
                      }}
                      autoFocus
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-300">
                      Path
                    </span>
                    <input
                      type="text"
                      className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
                      value={worktreePath}
                      disabled={dialogLoading}
                      onChange={(event) => setWorktreePath(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {dialog.kind === "cherryPick" || dialog.kind === "revert" ? (
                <span>
                  This runs{" "}
                  <span className="font-mono">
                    git {dialog.kind === "cherryPick" ? "cherry-pick" : "revert"}
                  </span>{" "}
                  against the current branch. Git may stop for conflicts.
                </span>
              ) : null}
              {dialogError ? (
                <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                  {dialogError}
                </div>
              ) : null}
            </div>
          ) : null
        }
        confirmLabel={dialogConfirmLabel}
        loadingLabel={dialogLoadingLabel}
        variant={
          dialog?.kind === "cherryPick" || dialog?.kind === "revert"
            ? "danger"
            : "default"
        }
        loading={dialogLoading}
        confirmDisabled={dialogConfirmDisabled}
        onCancel={closeDialog}
        onConfirm={() => {
          void handleConfirmDialog();
        }}
      />
    </div>
  );
}
