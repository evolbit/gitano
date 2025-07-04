import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFileHunksStore } from "../store/hunks";
import { useStagedLinesStore } from "../store/staging";
import DiffHunk from "./DiffHunk";
import FloatingCommitBar from "./FloatingCommitBar";

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
  is_new_file: boolean;
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
}) => {
  // Estado local para hunks si sha está definido
  const [localHunks, setLocalHunks] = useState<DiffHunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Para cada hunk, guardamos contexto extra arriba/abajo
  const [extraContext, setExtraContext] = useState<
    Record<number, { above: DiffLine[]; below: DiffLine[] }>
  >({});
  // Estado global para líneas staged
  const stagedLines = useStagedLinesStore(
    useShallow((s) => s.stagedLines[filePath] || {})
  );
  const setStagedLinesGlobal = useStagedLinesStore(
    useShallow((s) => s.setStagedLines)
  );
  // Estado para hover de hunk
  const [hoveredHunkIdx, setHoveredHunkIdx] = useState<number | null>(null);
  // Estado para selección múltiple por drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragHunkIdx, setDragHunkIdx] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<"add" | "remove" | null>(null);
  // Determinar si se puede seleccionar líneas (solo en working directory)
  const canStage = sha === undefined;
  const canSelectLines = canStage;
  const [commitBarOpen, setCommitBarOpen] = useState(false);

  // Obtener hunks del store global solo si no hay sha
  const { hunks: storeHunks } = useFileHunksStore();
  const hunks = sha ? localHunks : storeHunks;

  // Limpiar contexto extra cuando cambia el archivo o commit
  useEffect(() => {
    setExtraContext({});
  }, [filePath, sha]);

  // Si sha está definido, pedir los hunks del backend
  useEffect(() => {
    if (!sha) return;
    setLoading(true);
    setError(null);
    invoke<DiffHunk[]>("get_commit_file_diff_command", {
      path: repoPath,
      sha,
      filePath,
      context,
    })
      .then((res) => {
        setLocalHunks(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLocalHunks([]);
        setLoading(false);
      });
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
      (set) => set instanceof Set && set.size > 0
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
          set instanceof Set
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
      const prevHunk = extraContext[hunkIdx] || {
        above: [] as DiffLine[],
        below: [] as DiffLine[],
      };
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
        const prevHunk = prev[hunkIdx] || {
          above: [] as DiffLine[],
          below: [] as DiffLine[],
        };
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
    if (!canSelectLines) return;
    const prevSet: Set<number> = stagedLines[hunkIdx]
      ? new Set<number>(Array.from(stagedLines[hunkIdx] as Set<number>))
      : new Set<number>();
    if (prevSet.has(lineIdx)) {
      prevSet.delete(lineIdx);
    } else {
      prevSet.add(lineIdx);
    }
    setStagedLinesGlobal(filePath, hunkIdx, prevSet);
  };

  // Handler para stagear/desselectar todo el hunk
  const handleStageHunk = (hunkIdx: number) => {
    if (!canSelectLines) return;
    const hunk: DiffHunk = hunks[hunkIdx];
    const currentStaged = stagedLines[hunkIdx] || new Set<number>();
    const stageableLines = hunk.lines.filter(
      (line: DiffLine) => line.kind === "Add" || line.kind === "Del"
    ).length;
    const stagedCount = currentStaged.size;
    if (stagedCount === stageableLines) {
      setStagedLinesGlobal(filePath, hunkIdx, new Set());
    } else {
      const staged = new Set<number>();
      hunk.lines.forEach((line: DiffLine, idx: number) => {
        if (line.kind === "Add" || line.kind === "Del") {
          staged.add(idx);
        }
      });
      setStagedLinesGlobal(filePath, hunkIdx, staged);
    }
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
    if (!canSelectLines || !isStageable) return;
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
    if (
      !canSelectLines ||
      !isDragging ||
      dragHunkIdx !== hunkIdx ||
      !isStageable
    )
      return;
    if (dragMode === "add" && !isStaged) {
      handleToggleLineStage(hunkIdx, lineIdx);
    } else if (dragMode === "remove" && isStaged) {
      handleToggleLineStage(hunkIdx, lineIdx);
    }
  };

  return (
    <div className="bg-background-emphasis h-full flex flex-col font-mono text-sm">
      {/* Área scrolleable del diff */}
      <div className={`flex-1 overflow-auto px-4${canStage ? " pb-40" : ""}`}>
        {loading && <div className="text-blue-400">Cargando diff...</div>}
        {error && <div className="text-red-400">{error}</div>}
        {hunks.length === 0 && !loading && !error && <div>No hay cambios.</div>}
        {hunks.map((hunk, idx) => (
          <DiffHunk
            key={idx}
            hunk={hunk}
            hunkIdx={idx}
            stagedLines={stagedLines}
            setStagedLines={
              canSelectLines
                ? (hunkIdx, lines) =>
                    setStagedLinesGlobal(filePath, hunkIdx, lines)
                : () => {}
            }
            extraContext={extraContext}
            setExtraContext={setExtraContext}
            hoveredHunkIdx={hoveredHunkIdx}
            setHoveredHunkIdx={setHoveredHunkIdx}
            isDragging={canSelectLines ? isDragging : false}
            setIsDragging={canSelectLines ? setIsDragging : () => {}}
            dragHunkIdx={canSelectLines ? dragHunkIdx : null}
            setDragHunkIdx={canSelectLines ? setDragHunkIdx : () => {}}
            dragMode={canSelectLines ? dragMode : null}
            setDragMode={canSelectLines ? setDragMode : () => {}}
            handleExpandContext={handleExpandContext}
            handleToggleLineStage={handleToggleLineStage}
            handleLineMouseDown={handleLineMouseDown}
            handleLineMouseEnter={handleLineMouseEnter}
            handleStageHunk={handleStageHunk}
            canStage={canStage}
          />
        ))}
      </div>
      {/* Barra flotante de commit solo si canStage (working directory) */}
      {canStage && (
        <FloatingCommitBar
          expanded={commitBarOpen}
          onExpand={() => setCommitBarOpen(true)}
          onCollapse={() => setCommitBarOpen(false)}
          repoPath={repoPath}
        />
      )}
    </div>
  );
};

export default DiffViewer;
