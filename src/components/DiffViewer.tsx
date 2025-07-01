import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";

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

  // Cargar los hunks iniciales
  useEffect(() => {
    setLoading(true);
    setError(null);
    setExtraContext({});
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

  return (
    <div className="p-4 bg-background-emphasis h-full flex-1 overflow-auto font-mono text-sm">
      <div className="font-bold mb-2 text-blue-300">{filePath}</div>
      {loading && <div className="text-zinc-400">Cargando diff...</div>}
      {error && <div className="text-red-400">{error}</div>}
      {!loading && !error && hunks.length === 0 && <div>No hay cambios.</div>}
      {hunks.map((hunk, idx) => (
        <div
          key={idx}
          className="mb-6 border border-border rounded bg-background">
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
            />
          ))}
          {/* Líneas del hunk */}
          {hunk.lines.map((line, i) => (
            <DiffLineRow
              key={i}
              line={line}
            />
          ))}
          {/* Líneas extra abajo */}
          {extraContext[idx]?.below?.map((line, i) => (
            <DiffLineRow
              key={"below-" + i}
              line={line}
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
      ))}
    </div>
  );
};

// Componente para mostrar una línea del diff con colores y números de línea
const DiffLineRow: React.FC<{ line: DiffLine }> = ({ line }) => {
  let color = "";
  if (line.kind === "Add") color = "text-green-400 bg-green-900/20";
  else if (line.kind === "Del") color = "text-red-400 bg-red-900/20";
  else color = "text-zinc-200";
  return (
    <div
      className={`flex items-center px-4 py-0.5 ${color} text-xs font-mono`}
      style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="w-10 text-right pr-2 text-zinc-500 select-none block">
        {line.old_lineno ?? ""}
      </span>
      <span className="w-10 text-right pr-2 text-zinc-500 select-none block">
        {line.new_lineno ?? ""}
      </span>
      <span className="flex-1 min-w-0 whitespace-pre-wrap">{line.content}</span>
    </div>
  );
};

export default DiffViewer;
