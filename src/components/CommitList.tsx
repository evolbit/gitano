import { Tooltip } from "@mantine/core";
import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRepoStore } from "../store/repo";
import { CommitListItem } from "../types/git";
import InputText from "./form/InputText";
import { IconFilter, IconGitBranch, IconPlus, IconSearch } from "./icons";
import TableVirtualResizable, {
  TableColumn,
} from "./tables/TableVirtualResizable";

const PAGE_SIZE = 50;

export default function CommitList() {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;
  const selectedBranch = tab?.selectedBranch;
  const setTabCommit = useRepoStore((s) => s.setTabCommit);
  const [search, setSearch] = useState("");
  const [commits, setCommits] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(true);
  const lastScrollY = useRef(0);
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

  // Define columns with custom rendering for commit_history
  const columns: TableColumn<any>[] = [
    { key: "sha", label: "SHA", width: 120 },
    {
      key: "date",
      label: "Fecha",
      width: 150,
      render: (value) => {
        if (!value) return "";
        const date =
          typeof value === "number" ? new Date(value * 1000) : new Date(value);
        return date instanceof Date && !isNaN(date.getTime())
          ? date.toLocaleString("es-ES", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
      },
    },
    { key: "message", label: "Mensaje", width: 250 },
    { key: "author", label: "Autor", width: 120 },
    {
      key: "commit_history",
      label: "Historia del commit",
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
    { key: "files", label: "Archivos", width: 80 },
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
      const result: any = await core.invoke("get_commits_list_paginated", {
        path: repoPath,
        branch: selectedBranch || "",
        offset: reset ? 0 : offset,
        limit: PAGE_SIZE,
      });
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

  // Reset when repoPath changes
  useEffect(() => {
    setCommits([]);
    setOffset(0);
    setHasMore(true);
    setSelectedRowIndex(-1); // Reset selected row when repo changes
    loadCommits(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, selectedBranch]);

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
  const handleRowClick = (row: CommitListItem, index: number) => {
    setSelectedRowIndex(index);
    if (activeTabId) {
      setTabCommit(activeTabId, row);
    }
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

  return (
    <div className="h-full w-full flex flex-col p-4">
      {/* Top bar with scroll behavior */}
      <div
        className={`flex items-center pb-4 transition-transform duration-300 ease-in-out ${
          isSearchBarVisible ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{
          transform: isSearchBarVisible ? "translateY(0)" : "translateY(-100%)",
        }}>
        <InputText
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar commit..."
          className="flex-1 bg-zinc-800 rounded-lg px-3 h-9 mr-4"
          leftIcon={
            <IconSearch
              size={18}
              className="text-zinc-400"
            />
          }
        />
        <button className="flex items-center bg-zinc-800 text-zinc-400 border-none rounded-lg px-3 h-9 mr-2 cursor-pointer font-medium text-[15px]">
          <IconFilter
            size={18}
            className="mr-1.5"
          />
          Filtros
        </button>
        <button className="flex items-center bg-indigo-500 text-zinc-400 border-none rounded-lg px-4 h-9 cursor-pointer font-medium text-[15px]">
          <IconPlus
            size={18}
            className="mr-1.5"
          />
          Añadir manualmente
        </button>
      </div>
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
          <div className="text-center p-4">Cargando más commits...</div>
        )}
      </div>
    </div>
  );
}
