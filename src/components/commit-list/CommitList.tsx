import { Tooltip } from "@mantine/core";
import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRepoStore } from "../../store/repo";
import {
  CommitHistoryMode,
  CommitListItem,
  CommitListPage,
} from "../../types/git";
import InputText from "../form/InputText";
import { IconGitBranch, IconSearch } from "../icons";
import TableVirtualResizable, {
  TableColumn,
} from "../tables/TableVirtualResizable";

const PAGE_SIZE = 50;

export default function CommitList() {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;
  const selectedBranch = tab?.selectedBranch;
  const selectedCommit = tab?.selectedCommit;
  const setTabCommit = useRepoStore((s) => s.setTabCommit);
  const [search, setSearch] = useState("");
  const [commits, setCommits] = useState<CommitListItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [historyMode, setHistoryMode] = useState<CommitHistoryMode>("git_log");
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null
  );

  // State for keyboard navigation
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);

  // Callback to handle the container ref
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    setScrollContainer(el);
  }, []);

  // Debounce for infinite scroll
  const loadMoreTimeoutRef = useRef<number | null>(null);
  const loadCommitsRef = useRef<() => Promise<void>>();
  const previousViewKeyRef = useRef<string | null>(null);

  // Define columns with custom rendering for commit_history
  const columns: TableColumn<CommitListItem>[] = [
    { key: "sha", label: "SHA", width: 120 },
    {
      key: "date",
      label: "Date",
      width: 150,
      render: (value) => {
        if (!value) return "";
        const date =
          typeof value === "number" ? new Date(value * 1000) : new Date(value);
        return date instanceof Date && !isNaN(date.getTime())
          ? date.toLocaleString("en-GB", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
      },
    },
    {
      key: "message",
      label: "Message",
      width: 360,
      minWidth: 280,
      grow: true,
    },
    { key: "author", label: "Author", width: 140 },
    {
      key: "commit_history",
      label: "Branch history",
      width: 200,
      render: (history: string[]) => {
        if (!history || history.length === 0) return null;

        const renderBadges = (isTooltip = false) => (
          <div
            className={`flex items-center gap-1.5 ${
              isTooltip ? "flex-wrap p-2" : "truncate"
            }`}>
            {history.map((branch, index) => (
              <span
                key={`${branch}-${index}`}
                className="inline-flex items-center gap-1 bg-blue-600 text-zinc-400 rounded-full px-2 py-0.5 text-xs font-medium">
                <IconGitBranch
                  size={12}
                  className="flex-shrink-0"
                />
                <span>{branch}</span>
              </span>
            ))}
          </div>
        );

        return (
          <Tooltip
            label={renderBadges(true)}
            withArrow
            w="auto"
            transitionProps={{ transition: "pop", duration: 200 }}
            classNames={{
              tooltip: "bg-zinc-800 text-zinc-200 border border-zinc-700",
            }}>
            {renderBadges(false)}
          </Tooltip>
        );
      },
    },
    { key: "files", label: "Files", width: 80 },
  ];

  // Load commits (paginated)
  const loadCommits = async (reset = false) => {
    console.log("loadCommits called", {
      reset,
      offset,
      hasMore,
      loading,
      repoPath,
    });

    if (loading || !repoPath) {
      console.log("loadCommits early return - loading or no repoPath");
      return;
    }

    if (!reset && !hasMore) {
      console.log("loadCommits early return - no reset and no hasMore");
      return;
    }

    setLoading(true);
    setError(null);
    console.log("Calling loadCommits", { reset, offset, hasMore });
    try {
      const result = await core.invoke<CommitListPage>(
        "get_commits_list_paginated",
        {
          path: repoPath,
          branch: selectedBranch || "",
          historyMode,
          offset: reset ? 0 : offset,
          limit: PAGE_SIZE,
        }
      );
      console.log("Backend result:", result);
      const newCommits = result.commits || [];

      // Preserve the scroll position before updating the data
      const currentScrollTop = scrollContainer?.scrollTop || 0;

      setCommits((prev) => (reset ? newCommits : [...prev, ...newCommits]));
      setHasMore(result.has_more);
      setOffset((prev) => (reset ? PAGE_SIZE : prev + PAGE_SIZE));

      // Restore the scroll position after updating the data
      if (!reset && scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = currentScrollTop;
        }, 0);
      }

      console.log("Updated state", {
        newCommitsLength: newCommits.length,
        hasMore: result.has_more,
        newOffset: reset ? PAGE_SIZE : offset + PAGE_SIZE,
      });
    } catch (err) {
      console.error("Error loading commits:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Update the loadCommits reference
  useEffect(() => {
    loadCommitsRef.current = loadCommits;
  }, [loadCommits]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <
      e.currentTarget.clientHeight + 200
    ) {
      // Clear the previous timeout if it exists
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }

      // Use a debounce to avoid multiple calls
      loadMoreTimeoutRef.current = setTimeout(() => {
        if (loadCommitsRef.current) {
          loadCommitsRef.current();
        }
      }, 100);
    }
  }, []);

  // Clear the timeout on unmount
  useEffect(() => {
    return () => {
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
    };
  }, []);

  // Reset when the viewed history changes. Preserve the selected commit when the
  // component remounts as part of the details pane opening.
  useEffect(() => {
    const viewKey = `${activeTabId ?? ""}|${repoPath ?? ""}|${
      selectedBranch ?? ""
    }|${historyMode}`;
    const previousViewKey = previousViewKeyRef.current;

    previousViewKeyRef.current = viewKey;
    setCommits([]);
    setOffset(0);
    setHasMore(true);
    setSelectedRowIndex(-1);

    if (previousViewKey && previousViewKey !== viewKey && activeTabId) {
      setTabCommit(activeTabId, null);
    }

    loadCommits(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, selectedBranch, historyMode, activeTabId, setTabCommit]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!commits.length || !isTableFocused) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setKeyboardNavigation(true);
          setSelectedRowIndex((prev) => {
            const maxIndex = commits.length - 1;
            const newIndex = Math.min(prev + 1, maxIndex);
            return newIndex;
          });
          break;
        case "ArrowUp":
          event.preventDefault();
          setKeyboardNavigation(true);
          setSelectedRowIndex((prev) => {
            const newIndex = Math.max(prev - 1, 0);
            return newIndex;
          });
          break;
        case "Home":
          event.preventDefault();
          setKeyboardNavigation(true);
          setSelectedRowIndex(0);
          break;
        case "End":
          event.preventDefault();
          setKeyboardNavigation(true);
          const lastIndex = commits.length - 1;
          setSelectedRowIndex(lastIndex);
          break;
        case "Enter":
          event.preventDefault();
          if (selectedRowIndex >= 0 && selectedRowIndex < commits.length) {
            const selectedCommit = commits[selectedRowIndex];
            if (activeTabId) {
              setTabCommit(activeTabId, selectedCommit);
            }
          }
          break;
      }
    };

    // Add the event listener directly to the document
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [commits, selectedRowIndex, activeTabId, setTabCommit, isTableFocused]);

  // Handle focus on the container
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

  // Function to handle row clicks
  const clearSelection = useCallback(() => {
    setSelectedRowIndex(-1);
    if (activeTabId) {
      setTabCommit(activeTabId, null);
    }
  }, [activeTabId, setTabCommit]);

  const handleRowClick = (row: CommitListItem, index: number) => {
    if (selectedRowIndex === index) {
      clearSelection();
      return;
    }

    setSelectedRowIndex(index);
    if (activeTabId) {
      setTabCommit(activeTabId, row);
    }
  };

  const handleHistoryModeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setHistoryMode(event.target.value as CommitHistoryMode);
  };

  // Update the selected commit in the store whenever the selected row changes
  useEffect(() => {
    if (
      selectedRowIndex >= 0 &&
      selectedRowIndex < commits.length &&
      activeTabId
    ) {
      setTabCommit(activeTabId, commits[selectedRowIndex]);
    }
  }, [selectedRowIndex, commits, activeTabId, setTabCommit]);

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

    const selectedCommitIndex = commits.findIndex(
      (commit) => commit.sha === selectedCommit.sha
    );

    if (selectedCommitIndex >= 0) {
      setSelectedRowIndex(selectedCommitIndex);
    }
  }, [commits, selectedCommit]);

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
      {/* Table with built-in infinite scroll */}
      <div
        ref={setContainerRef}
        className="flex-1 overflow-y-auto focus:outline-none"
        onScroll={handleScroll}>
        <TableVirtualResizable
          columns={columns}
          data={commits}
          loading={loading}
          onRowClick={handleRowClick}
          selectedRowIndex={selectedRowIndex}
          enableInfiniteScroll={true}
          hasMore={hasMore}
          onLoadMore={loadCommits}
          keyboardNavigation={keyboardNavigation}
          setKeyboardNavigation={setKeyboardNavigation}
        />
        {hasMore && !loading && (
          <div className="text-center p-4">Loading more commits...</div>
        )}
      </div>
    </div>
  );
}
