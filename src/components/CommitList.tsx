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

  // Estado para navegación por teclado
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);

  // Callback para manejar el ref del contenedor
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    setScrollContainer(el);
  }, []);

  // Debounce para el infinite scroll
  const loadMoreTimeoutRef = useRef<number | null>(null);
  const loadCommitsRef = useRef<() => Promise<void>>();

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

      // Preservar la posición de scroll antes de actualizar los datos
      const currentScrollTop = scrollContainer?.scrollTop || 0;

      setCommits((prev) => (reset ? newCommits : [...prev, ...newCommits]));
      setHasMore(result.has_more);
      setOffset((prev) => (reset ? PAGE_SIZE : prev + PAGE_SIZE));

      // Restaurar la posición de scroll después de actualizar los datos
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

  // Actualizar la referencia a loadCommits
  useEffect(() => {
    loadCommitsRef.current = loadCommits;
  }, [loadCommits]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <
      e.currentTarget.clientHeight + 200
    ) {
      // Limpiar timeout anterior si existe
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }

      // Usar un debounce para evitar múltiples llamadas
      loadMoreTimeoutRef.current = setTimeout(() => {
        if (loadCommitsRef.current) {
          loadCommitsRef.current();
        }
      }, 100);
    }
  }, []);

  // Limpiar timeout al desmontar
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

  // Navegación por teclado
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

    // Agregar event listener directamente al documento
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [commits, selectedRowIndex, activeTabId, setTabCommit, isTableFocused]);

  // Manejar focus en el contenedor
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

  // Función para manejar el clic en una fila
  const handleRowClick = (row: CommitListItem, index: number) => {
    setSelectedRowIndex(index);
    if (activeTabId) {
      setTabCommit(activeTabId, row);
    }
  };

  // Actualizar el commit seleccionado en el store cada vez que cambia la fila seleccionada
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
