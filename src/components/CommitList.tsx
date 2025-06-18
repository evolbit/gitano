import { IconFilter, IconPlus, IconSearch } from "@tabler/icons-react";
import { core } from "@tauri-apps/api";
import { useEffect, useRef, useState } from "react";
import InputText from "./form/InputText";
import TableVirtualResizable, {
  TableColumn,
} from "./tables/TableVirtualResizable";

interface CommitListProps {
  repoPath: string;
}

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

export default function CommitList({ repoPath }: CommitListProps) {
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

  // Definir columnas con render personalizado para CI
  const columns: TableColumn<any>[] = [
    { key: "sha", label: "SHA", width: 120 },
    { key: "mensaje", label: "Mensaje", width: 250 },
    { key: "autor", label: "Autor", width: 120 },
    { key: "rama_actual", label: "Rama actual", width: 120 },
    { key: "rama_origen", label: "Rama de origen", width: 140 },
    { key: "pr", label: "PR", width: 80 },
    { key: "mergeado_en", label: "Mergeado en", width: 120 },
    { key: "archivos", label: "Archivos", width: 80 },
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
        branch: "",
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
  }, [repoPath]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Barra superior - con comportamiento de scroll */}
      <div
        className={`flex items-center px-4 pt-4 pb-2 border-b border-zinc-800 bg-zinc-900 transition-transform duration-300 ease-in-out ${
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
        <button className="flex items-center bg-zinc-800 text-white border-none rounded-lg px-3 h-9 mr-2 cursor-pointer font-medium text-[15px]">
          <IconFilter
            size={18}
            className="mr-1.5"
          />
          Filtros
        </button>
        <button className="flex items-center bg-indigo-500 text-white border-none rounded-lg px-4 h-9 cursor-pointer font-medium text-[15px]">
          <IconPlus
            size={18}
            className="mr-1.5"
          />
          Añadir manualmente
        </button>
      </div>
      {/* Tabla con infinite scroll integrado */}
      <div className="flex-1 w-full relative bg-zinc-900">
        {error && <div className="p-4 text-red-400">Error: {error}</div>}
        <TableVirtualResizable
          columns={columns}
          data={commits}
          rowHeight={56}
          enableInfiniteScroll={true}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={() => loadCommits()}
          loadMoreThreshold={200}
        />
      </div>
    </div>
  );
}
