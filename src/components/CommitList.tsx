import { Tooltip } from "@mantine/core";
import { core } from "@tauri-apps/api";
import { useEffect, useRef, useState } from "react";
import { useRepoStore } from "../store/repo";
import { CommitListItem } from "../types/git";
import InputText from "./form/InputText";
import { IconFilter, IconGitBranch, IconPlus, IconSearch } from "./icons";
import TableVirtualResizable, {
  TableColumn,
} from "./tables/TableVirtualResizable";

function StatusBadge({ status }: { status: string }) {
  let color = "text-green-400";
  let dot = "bg-green-400";
  let label = "Completado";
  if (status === "failed") {
    color = "text-red-400";
    dot = "bg-red-400";
    label = "Fallido";
  } else if (status === "pending") {
    color = "text-yellow-400";
    dot = "bg-yellow-400";
    label = "Pendiente";
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-zinc-800/70 rounded-full px-3 py-0.5 text-sm font-medium min-w-[90px] justify-center ${color}`}>
      <span className={`w-2.5 h-2.5 rounded-full inline-block ${dot}`} />
      {label}
    </span>
  );
}

const PAGE_SIZE = 50;

type CommitListProps = {
  onCommitSelected: (commit: CommitListItem) => void;
};

export default function CommitList({ onCommitSelected }: CommitListProps) {
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

  // Definir columnas con render personalizado para CI y commit_history
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
    { key: "pr", label: "PR", width: 80 },
    { key: "merged_in", label: "Mergeado en", width: 120 },
    { key: "files", label: "Archivos", width: 80 },
    {
      key: "ci",
      label: "CI",
      width: 90,
      render: (value) => <StatusBadge status={value} />,
    },
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
      setCommits((prev) => (reset ? newCommits : [...prev, ...newCommits]));
      setHasMore(result.has_more);
      setOffset((prev) => (reset ? PAGE_SIZE : prev + PAGE_SIZE));
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

  // Reset when repoPath changes
  useEffect(() => {
    setCommits([]);
    setOffset(0);
    setHasMore(true);
    loadCommits(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, selectedBranch]);

  return (
    <div className="h-full w-full flex flex-col p-4">
      {/* Barra superior - con comportamiento de scroll */}
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
      {/* Tabla con infinite scroll integrado */}
      <div
        ref={setScrollContainer}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          if (
            e.currentTarget.scrollHeight - e.currentTarget.scrollTop <
            e.currentTarget.clientHeight + 200
          ) {
            loadCommits();
          }
        }}>
        <TableVirtualResizable
          columns={columns}
          data={commits}
          loading={loading}
          onRowClick={(row: CommitListItem) => {
            if (activeTabId) setTabCommit(activeTabId, row);
            if (onCommitSelected) {
              onCommitSelected(row);
            }
          }}
        />
        {hasMore && !loading && (
          <div className="text-center p-4">Cargando más commits...</div>
        )}
      </div>
    </div>
  );
}
