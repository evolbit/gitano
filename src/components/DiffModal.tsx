import { Split } from "@gfazioli/mantine-split-pane";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRepoStore } from "../store/repo";
import DiffViewer from "./DiffViewer";
import { IconSearch, IconX } from "./icons";

interface FileChange {
  path: string;
  status: string;
  insertions: number;
  deletions: number;
}

interface DiffModalProps {
  open: boolean;
  files: FileChange[];
  initialFile: FileChange;
  onClose: () => void;
  repoPath?: string;
  sha?: string;
}

const DiffModal = ({
  open,
  files,
  initialFile,
  onClose,
  repoPath,
  sha,
}: DiffModalProps) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FileChange>(initialFile);
  const modalRef = useRef<HTMLDivElement>(null);

  // Si no recibimos repoPath como prop, lo obtenemos del store (tab activo)
  const storeRepoPath = useRepoStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.repoPath;
  });
  const effectiveRepoPath = repoPath || storeRepoPath;

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Selección inicial
  useEffect(() => {
    if (open && initialFile) setSelected(initialFile);
  }, [open, initialFile]);

  if (!open) return null;

  // Filtrado de archivos
  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(search.toLowerCase())
  );

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Modal principal */}
      <div
        ref={modalRef}
        className="relative w-[96vw] h-[92vh] mx-auto my-6 bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-emphasis">
          <div className="flex items-center gap-2 w-1/2">
            <span className="font-bold text-lg">Diferencias de archivos</span>
            <div className="flex-1" />
            <div className="relative w-72">
              <input
                type="text"
                className="w-full bg-background border border-border rounded px-3 py-1.5 pl-9 text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder="Buscar archivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <IconSearch className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <button
            className="ml-4 p-2 rounded hover:bg-zinc-800 text-2xl text-muted-foreground"
            onClick={onClose}
            aria-label="Cerrar">
            <IconX size={22} />
          </button>
        </div>
        {/* Split resizable */}
        <Split className="flex-1 min-h-0 w-full">
          {/* Panel izquierdo: lista de archivos */}
          <Split.Pane
            initialWidth={340}
            minWidth={220}
            maxWidth={500}
            className="h-full min-h-0 bg-background-emphasis border-r border-border">
            <ul className="overflow-y-auto h-full divide-y divide-border">
              {filteredFiles.map((file) => (
                <li
                  key={file.path}
                  className={`px-4 py-2 cursor-pointer flex items-center gap-2 text-sm transition-colors select-none ${
                    selected.path === file.path
                      ? "bg-blue-600/20 text-blue-300 font-semibold"
                      : "hover:bg-background"
                  }`}
                  onClick={() => setSelected(file)}
                  tabIndex={0}>
                  <span className="truncate flex-1">{file.path}</span>
                  <span className="text-green-500 text-xs">
                    +{file.insertions}
                  </span>
                  <span className="text-red-500 text-xs">
                    -{file.deletions}
                  </span>
                </li>
              ))}
            </ul>
          </Split.Pane>
          <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
          {/* Panel derecho: diff */}
          <Split.Pane
            grow
            className="h-full min-h-0 bg-background flex flex-col">
            <div className="flex-1 overflow-auto p-6">
              {/* Diff real del archivo seleccionado */}
              {effectiveRepoPath ? (
                <DiffViewer
                  repoPath={effectiveRepoPath}
                  filePath={selected.path}
                  sha={sha}
                />
              ) : (
                <div className="text-red-400">No se encontró el repoPath</div>
              )}
            </div>
          </Split.Pane>
        </Split>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default DiffModal;
