import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import { IconCheck } from "./icons";

// Tipos para los datos del backend
interface DiffLine {
  kind: "Add" | "Del" | "Context";
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

type ContextDirection = "Above" | "Below";

/**
 * Para mover los controles a la barra superior externa:
 * 1. Elimina la cabecera interna (nombre, contadores, botones) de este componente.
 * 2. Expón una función getFileActionsData() que retorna los datos necesarios para la barra superior.
 * 3. El padre debe llamar a getFileActionsData() y renderizar los controles donde corresponda.
 * 4. Alternativamente, puedes pasar el bloque visual ya armado como 'fileActionsBar' y se renderizará arriba del diff.
 */
interface DiffViewerProps {
  repoPath: string;
  filePath: string;
  sha?: string;
  context?: number;
  onFileActionsData?: (data: {
    filePath: string;
    insertions: number;
    deletions: number;
    canStage: boolean;
    canDiscard: boolean;
    canRemove: boolean;
    onStage: () => void;
    onDiscard: () => void;
    onRemove: () => void;
  }) => void;
  /**
   * Si se provee, este bloque visual se renderiza arriba del área scrolleable del diff.
   * Ejemplo: <DiffViewer fileActionsBar={<MiBarra filePath=... ... />} ... />
   */
  fileActionsBar?: React.ReactNode;
}

const CONTEXT_DEFAULT = 3;

const DiffViewer: React.FC<DiffViewerProps> = ({
  repoPath,
  filePath,
  sha,
  context = CONTEXT_DEFAULT,
  onFileActionsData,
  fileActionsBar,
}) => {
  const [hunks, setHunks] = useState<DiffHunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Para cada hunk, guardamos contexto extra arriba/abajo
  const [extraContext, setExtraContext] = useState<
    Record<number, { above: DiffLine[]; below: DiffLine[] }>
  >({});
  // Estado para líneas staged: { [hunkIdx]: Set<lineIdx> }
  const [stagedLines, setStagedLines] = useState<Record<number, Set<number>>>(
    {}
  );
  // Estado para hover de hunk
  const [hoveredHunkIdx, setHoveredHunkIdx] = useState<number | null>(null);
  // Estado para selección múltiple por drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragHunkIdx, setDragHunkIdx] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<"add" | "remove" | null>(null);

  // Cargar los hunks iniciales
  useEffect(() => {
    setLoading(true);
    setError(null);
    setExtraContext({});
    setStagedLines({});
    setHoveredHunkIdx(null);
    setIsDragging(false);
    setDragHunkIdx(null);
    setDragMode(null);
    const fn = async () => {
      try {
        let result: DiffHunk[];
        if (sha) {
          result = await invoke<DiffHunk[]>("get_commit_file_diff", {
            path: repoPath,
            sha,
            filePath,
            context,
          });
        } else {
          result = await invoke<DiffHunk[]>("get_file_diff_hunks", {
            path: repoPath,
            filePath,
            context,
          });
        }
        setHunks(result);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    fn();
  }, [repoPath, filePath, sha, context]);

  // Lógica para exponer los datos de acciones al padre
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
    const canStage = Object.values(stagedLines).some(
      (set) => set && set.size > 0
    );
    const canDiscard = hunks.length > 0;
    onFileActionsData({
      filePath,
      insertions,
      deletions,
      canStage,
      canDiscard,
      canRemove,
      onStage: () => {
        const staged = Object.entries(stagedLines).flatMap(([hunkIdx, set]) =>
          set
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
  }, [filePath, hunks, stagedLines, onFileActionsData]);

  // Calcular los números de modificaciones siempre
  let insertions = 0;
  let deletions = 0;
  hunks.forEach((hunk) => {
    hunk.lines.forEach((line) => {
      if (line.kind === "Add") insertions++;
      if (line.kind === "Del") deletions++;
    });
  });

  // Pedir más contexto arriba/abajo
  const handleExpandContext = async (
    hunkIdx: number,
    direction: ContextDirection,
    lines: number
  ) => {
    try {
      const prevHunk = extraContext[hunkIdx] || { above: [], below: [] };
      const offset =
        direction === "Above" ? prevHunk.above.length : prevHunk.below.length;
      const res = await invoke<DiffLine[]>("get_diff_context", {
        path: repoPath,
        filePath,
        hunkIndex: hunkIdx,
        direction,
        lines,
        context,
        offset,
      });
      setExtraContext((prev) => {
        const prevHunk = prev[hunkIdx] || { above: [], below: [] };
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
  };

  // Handler para marcar/desmarcar una línea
  const handleToggleLineStage = (hunkIdx: number, lineIdx: number) => {
    setStagedLines((prev) => {
      const prevSet: Set<number> = prev[hunkIdx]
        ? new Set<number>(Array.from(prev[hunkIdx] as Set<number>))
        : new Set<number>();
      if (prevSet.has(lineIdx)) {
        prevSet.delete(lineIdx);
      } else {
        prevSet.add(lineIdx);
      }
      return { ...prev, [hunkIdx]: prevSet };
    });
  };

  // Handler para stagear todo el hunk
  const handleStageHunk = (hunkIdx: number) => {
    setStagedLines((prev) => {
      const hunk = hunks[hunkIdx];
      const staged = new Set<number>();
      hunk.lines.forEach((line, idx) => {
        if (line.kind === "Add" || line.kind === "Del") {
          staged.add(idx);
        }
      });
      return { ...prev, [hunkIdx]: staged };
    });
  };

  // Handler para mouse up global (terminar drag)
  useEffect(() => {
    if (!isDragging) return;
    const handleUp = () => {
      setIsDragging(false);
      setDragHunkIdx(null);
      setDragMode(null);
    };
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [isDragging]);

  // Handler para mouse down en línea
  const handleLineMouseDown = (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean
  ) => {
    if (!isStageable) return;
    setIsDragging(true);
    setDragHunkIdx(hunkIdx);
    setDragMode(isStaged ? "remove" : "add");
    // Marcar/desmarcar la línea inicial
    handleToggleLineStage(hunkIdx, lineIdx);
  };

  // Handler para mouse enter en línea (durante drag)
  const handleLineMouseEnter = (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean
  ) => {
    if (!isDragging || dragHunkIdx !== hunkIdx || !isStageable) return;
    if (dragMode === "add" && !isStaged) {
      handleToggleLineStage(hunkIdx, lineIdx);
    } else if (dragMode === "remove" && isStaged) {
      handleToggleLineStage(hunkIdx, lineIdx);
    }
  };

  return (
    <div className="bg-background-emphasis h-full flex flex-col font-mono text-sm">
      {/* Área scrolleable del diff */}
      <div className="flex-1 overflow-auto px-4">
        {loading && <div className="text-zinc-400">Cargando diff...</div>}
        {error && <div className="text-red-400">{error}</div>}
        {!loading && !error && hunks.length === 0 && <div>No hay cambios.</div>}
        {hunks.map((hunk, idx) => {
          const isHovered = hoveredHunkIdx === idx;
          return (
            <div
              key={idx}
              className={`mb-6 border border-border rounded bg-background ${
                isHovered ? "ring-2 ring-blue-400/40" : ""
              }`}
              onMouseEnter={() => setHoveredHunkIdx(idx)}
              onMouseLeave={() => setHoveredHunkIdx(null)}>
              {/* Cabecera del hunk con botones Select all y Stage */}
              <div className="flex items-center justify-between px-4 py-1 bg-zinc-800 gap-2">
                <span className="text-purple-300 text-xs font-mono">
                  {hunk.header}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    className="px-2 py-1 text-xs bg-blue-700 hover:bg-blue-800 text-white rounded"
                    onClick={() => handleStageHunk(idx)}>
                    Select all
                  </button>
                  <button
                    className="px-2 py-1 text-xs bg-green-700 hover:bg-green-800 text-white rounded disabled:opacity-50"
                    disabled={!(stagedLines[idx] && stagedLines[idx].size > 0)}
                    onClick={() => {
                      // Aquí iría la lógica real de stage, por ahora solo log
                      const staged = stagedLines[idx]
                        ? Array.from(stagedLines[idx])
                        : [];
                      console.log("Stage lines for hunk", idx, staged);
                    }}>
                    Stage
                  </button>
                </div>
              </div>
              {/* Expandir contexto arriba */}
              <div className="flex justify-center py-1">
                <button
                  className="text-xs text-blue-400 hover:underline"
                  onClick={() => handleExpandContext(idx, "Above", 10)}>
                  Mostrar 10 líneas arriba
                </button>
              </div>
              {/* Líneas extra arriba */}
              {extraContext[idx]?.above?.map((line, i) => (
                <DiffLineRow
                  key={"above-" + i}
                  line={line}
                  showChecks={false}
                />
              ))}
              {/* Líneas del hunk */}
              {hunk.lines.map((line, lineIdx) => {
                const isStageable = line.kind === "Add" || line.kind === "Del";
                const isStaged = stagedLines[idx]?.has(lineIdx);
                return (
                  <DiffLineRow
                    key={lineIdx}
                    line={line}
                    showChecks={isStageable}
                    isStaged={isStaged}
                    onCheck={() => handleToggleLineStage(idx, lineIdx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleLineMouseDown(idx, lineIdx, isStageable, isStaged);
                    }}
                    onMouseEnter={() =>
                      handleLineMouseEnter(idx, lineIdx, isStageable, isStaged)
                    }
                  />
                );
              })}
              {/* Líneas extra abajo */}
              {extraContext[idx]?.below?.map((line, i) => (
                <DiffLineRow
                  key={"below-" + i}
                  line={line}
                  showChecks={false}
                />
              ))}
              {/* Expandir contexto abajo */}
              <div className="flex justify-center py-1">
                <button
                  className="text-xs text-blue-400 hover:underline"
                  onClick={() => handleExpandContext(idx, "Below", 10)}>
                  Mostrar 10 líneas abajo
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Componente para mostrar una línea del diff con checks, colores y números de línea
const DiffLineRow: React.FC<{
  line: DiffLine;
  showChecks?: boolean;
  isStaged?: boolean;
  onCheck?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}> = ({
  line,
  showChecks = false,
  isStaged = false,
  onCheck,
  onMouseDown,
  onMouseEnter,
}) => {
  let baseColor = "";
  if (line.kind === "Add") baseColor = "text-green-400 bg-green-900/20";
  else if (line.kind === "Del") baseColor = "text-red-400 bg-red-900/20";
  else baseColor = "text-zinc-200";
  // Si está staged, fondo azul y texto blanco
  const stagedColor = isStaged ? "bg-blue-600 text-white" : baseColor;
  return (
    <div
      className={`flex items-center px-4 py-0.5 ${stagedColor} text-xs font-mono group transition-colors duration-100`}
      style={{
        fontVariantNumeric: "tabular-nums",
        cursor: showChecks ? "pointer" : undefined,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}>
      {/* Columna de check para old_lineno */}
      <span className="w-6 h-4 flex items-center justify-center select-none">
        {showChecks && line.old_lineno !== null && isStaged ? (
          <IconCheck
            size={14}
            className="text-white"
          />
        ) : null}
      </span>
      {/* Columna de check para new_lineno */}
      <span className="w-6 h-4 flex items-center justify-center select-none">
        {showChecks && line.new_lineno !== null && isStaged ? (
          <IconCheck
            size={14}
            className="text-white"
          />
        ) : null}
      </span>
      {/* Números de línea */}
      <span className="w-10 text-right pr-2 text-zinc-200 select-none block">
        {line.old_lineno ?? ""}
      </span>
      <span className="w-10 text-right pr-2 text-zinc-200 select-none block">
        {line.new_lineno ?? ""}
      </span>
      {/* Contenido */}
      <span className="flex-1 min-w-0 whitespace-pre-wrap">{line.content}</span>
    </div>
  );
};

export default DiffViewer;
