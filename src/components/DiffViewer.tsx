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

// Props: path del repo, archivo, contexto inicial
interface DiffViewerProps {
  repoPath: string;
  filePath: string;
  sha?: string;
  context?: number;
}

const CONTEXT_DEFAULT = 3;

const DiffViewer: React.FC<DiffViewerProps> = ({
  repoPath,
  filePath,
  sha,
  context = CONTEXT_DEFAULT,
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

  // Cargar los hunks iniciales
  useEffect(() => {
    setLoading(true);
    setError(null);
    setExtraContext({});
    setStagedLines({});
    setHoveredHunkIdx(null);
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

  return (
    <div className="p-4 bg-background-emphasis h-full flex-1 overflow-auto font-mono text-sm">
      <div className="font-bold mb-2 text-blue-300">{filePath}</div>
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
            {/* Cabecera del hunk con botón Stage Hunk */}
            <div className="flex items-center justify-between px-4 py-1 bg-zinc-800">
              <span className="text-purple-300 text-xs font-mono">
                {hunk.header}
              </span>
              <button
                className="ml-4 px-2 py-1 text-xs bg-green-700 hover:bg-green-800 text-white rounded"
                onClick={() => handleStageHunk(idx)}>
                Stage Hunk
              </button>
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
  );
};

// Componente para mostrar una línea del diff con checks, colores y números de línea
const DiffLineRow: React.FC<{
  line: DiffLine;
  showChecks?: boolean;
  isStaged?: boolean;
  onCheck?: () => void;
}> = ({ line, showChecks = false, isStaged = false, onCheck }) => {
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
      onClick={showChecks ? onCheck : undefined}>
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
