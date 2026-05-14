import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_EVENTS } from "../../constants/events";
import { useRepoStore } from "../../store/repo";
import {
  CommitHistoryMode,
  CommitListItem,
  CommitListPage,
} from "../../types/git";
import InputText from "../form/InputText";
import { IconSearch } from "../icons";
import TableVirtualResizable, {
  TableColumn,
} from "../tables/TableVirtualResizable";
import CommitGraphCell from "./CommitGraphCell";

const PAGE_SIZE = 50;
const MAX_FULL_LOG_PAGES = 2000;
const COMMIT_ROW_HEIGHT = 30;
const GRAPH_LANE_WIDTH = 16;
const GRAPH_PADDING_X = 24;
const GRAPH_MIN_WIDTH = 120;
const GRAPH_MAX_WIDTH = 560;

type CommitTableRow = {
  id: string;
  graph: CommitListItem["graph"];
  graphJoins: CommitListItem["graph_joins"];
  graphNodeUp: boolean;
  graphNodeDown: boolean;
  graphExtra: CommitListItem["graph_extra"];
  graphWidth: number;
  graphLane: number;
  graphColor: number;
  graphSegments: CommitListItem["graph_segments"];
  refs: string[];
  message: string;
  date: number;
  author: string;
  sha: string;
  commit: CommitListItem;
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
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;
  const selectedCommit = tab?.selectedCommit;
  const setTabCommit = useRepoStore((s) => s.setTabCommit);

  const [search, setSearch] = useState("");
  const [commits, setCommits] = useState<CommitListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<CommitHistoryMode>("git_log");
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null
  );

  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);

  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    setScrollContainer(el);
  }, []);

  const loadCommitsRef = useRef<(reset?: boolean) => Promise<void>>();
  const previousViewKeyRef = useRef<string | null>(null);

  const filteredCommits = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return commits;
    return commits.filter((commit) => toSearchableText(commit).includes(term));
  }, [commits, search]);

  const tableRows = useMemo<CommitTableRow[]>(
    () =>
      filteredCommits.map((commit) => ({
        id: commit.sha,
        graph: commit.graph ?? [],
        graphJoins: commit.graph_joins ?? [],
        graphNodeUp: Boolean(commit.graph_node_up),
        graphNodeDown: Boolean(commit.graph_node_down),
        graphExtra: commit.graph_extra ?? [],
        graphWidth: commit.graph_width ?? commit.graph?.length ?? 0,
        graphLane: commit.graph_lane ?? 0,
        graphColor: commit.graph_color ?? 0,
        graphSegments: commit.graph_segments ?? [],
        refs: commit.refs ?? [],
        message: commit.message,
        date: commit.date,
        author: commit.author,
        sha: commit.sha,
        commit,
      })),
    [filteredCommits]
  );

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
        key: "graph",
        label: "Graph",
        width: graphColumnWidth,
        minWidth: 72,
        cellClassName: "px-0",
        render: (_: CommitListItem["graph"], row: CommitTableRow) => (
          <CommitGraphCell
            graph={row.graph ?? []}
            joins={row.graphJoins ?? []}
            nodeUp={row.graphNodeUp}
            nodeDown={row.graphNodeDown}
            extraLines={row.graphExtra ?? []}
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
                <span className="truncate">{refLabel}</span>
              </span>
            ))}
            <span className="min-w-0 truncate">{value}</span>
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
        width: 140,
        cellClassName: "px-3 text-zinc-400",
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
    [graphColumnWidth]
  );

  const loadCommits = async (reset = false) => {
    if (loading || !repoPath) {
      return;
    }

    if (!reset) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await core.invoke<CommitListPage>(
        "get_commits_list_paginated",
        {
          path: repoPath,
          branch: "",
          historyMode,
          offset: 0,
          limit: MAX_FULL_LOG_PAGES * PAGE_SIZE,
        }
      );

      const pageCommits = result.commits || [];
      setCommits(pageCommits);

      if (result.has_more) {
        setError(
          `Commit history truncated after ${MAX_FULL_LOG_PAGES * PAGE_SIZE} commits. Increase MAX_FULL_LOG_PAGES if needed.`
        );
      }
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommitsRef.current = loadCommits;
  }, [loadCommits]);

  useEffect(() => {
    const handleCommitRefresh = () => {
      if (loadCommitsRef.current) {
        void loadCommitsRef.current(true);
      }
    };

    window.addEventListener(APP_EVENTS.commitsRefresh, handleCommitRefresh);

    return () => {
      window.removeEventListener(APP_EVENTS.commitsRefresh, handleCommitRefresh);
    };
  }, []);

  useEffect(() => {
    const viewKey = `${activeTabId ?? ""}|${repoPath ?? ""}|${historyMode}`;
    const previousViewKey = previousViewKeyRef.current;

    previousViewKeyRef.current = viewKey;
    setCommits([]);
    setSelectedRowIndex(-1);

    if (previousViewKey && previousViewKey !== viewKey && activeTabId) {
      setTabCommit(activeTabId, null);
    }

    loadCommits(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, historyMode, activeTabId, setTabCommit]);

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

  const handleHistoryModeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setHistoryMode(event.target.value as CommitHistoryMode);
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

  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className="flex items-center pb-4">
        <InputText
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commits..."
          className="flex-1 bg-zinc-800 rounded-lg px-3 h-9 mr-4"
          leftIcon={
            <IconSearch
              size={18}
              className="text-zinc-400"
            />
          }
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 h-9 text-sm text-muted-foreground">
            <span>View</span>
            <select
              value={historyMode}
              onChange={handleHistoryModeChange}
              className="bg-transparent border-none outline-none text-foreground text-sm">
              <option value="git_log">Git log</option>
              <option value="first_parent">First parent</option>
            </select>
          </label>
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
        <TableVirtualResizable
          columns={columns}
          data={tableRows}
          rowHeight={COMMIT_ROW_HEIGHT}
          loading={loading}
          onRowClick={handleRowClick}
          selectedRowIndex={selectedRowIndex}
          keyboardNavigation={keyboardNavigation}
          setKeyboardNavigation={setKeyboardNavigation}
        />
      </div>
    </div>
  );
}
