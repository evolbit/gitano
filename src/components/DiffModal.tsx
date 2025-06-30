import { Split } from "@gfazioli/mantine-split-pane";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRepoStore } from "../store/repo";
import DiffFileList from "./DiffFileList";
import DiffViewer from "./DiffViewer";
import {
  IconCopy,
  IconExchange,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPoint,
  IconQuestionMark,
  IconX,
} from "./icons";

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    if (open && initialFile) {
      setSelected(initialFile);
      setSelectedIndex(0);
    }
  }, [open, initialFile]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  // Filtrado de archivos
  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(search.toLowerCase())
  );

  // Mantener el índice seleccionado dentro del rango
  useEffect(() => {
    if (selectedIndex >= filteredFiles.length) {
      setSelectedIndex(filteredFiles.length - 1);
    }
    if (selectedIndex < 0 && filteredFiles.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredFiles.length, selectedIndex]);

  // Actualizar el archivo seleccionado cuando cambia el índice
  useEffect(() => {
    if (filteredFiles[selectedIndex]) {
      setSelected(filteredFiles[selectedIndex]);
    }
  }, [selectedIndex, filteredFiles]);

  // Navegación por teclado en la lista de archivos
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === searchInputRef.current) return;
      if (filteredFiles.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredFiles.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          setSelected(filteredFiles[selectedIndex]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filteredFiles, selectedIndex]);

  // Scroll automático para mantener visible la fila seleccionada
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-file-index='${selectedIndex}']`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, filteredFiles]);

  // Lógica para icono de estado (igual que en FileListItem)
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "added":
        return (
          <IconPlus
            size={16}
            className="text-green-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "deleted":
        return (
          <IconMinus
            size={16}
            className="text-red-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "modified":
        return (
          <IconPoint
            size={16}
            className="text-yellow-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "renamed":
        return (
          <IconPencil
            size={16}
            className="text-blue-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "copied":
        return (
          <IconCopy
            size={16}
            className="text-purple-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "typeChanged":
        return (
          <IconExchange
            size={16}
            className="text-orange-500 w-4 h-4 flex-shrink-0"
          />
        );
      default:
        return (
          <IconQuestionMark
            size={16}
            className="text-gray-500 w-4 h-4 flex-shrink-0"
          />
        );
    }
  };

  // Normalizar archivos para DiffFileList
  const allowedStatuses = [
    "added",
    "deleted",
    "modified",
    "renamed",
    "copied",
    "typeChanged",
  ];
  const normalizedFiles = files.map((file) => ({
    ...file,
    status: allowedStatuses.includes(file.status)
      ? (file.status as import("../types/git").FileChange["status"])
      : "modified",
  }));

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Modal principal */}
      <div
        ref={modalRef}
        className="relative w-[96vw] h-[96vh] mx-auto my-6 bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden min-h-0"
        style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-emphasis">
          <div className="flex items-center gap-2 w-1/2">
            <span className="font-bold text-lg">Diferencias de archivos</span>
            <div className="flex-1" />
          </div>
          <button
            className="ml-4 p-2 rounded hover:bg-zinc-800 text-2xl text-muted-foreground"
            onClick={onClose}
            aria-label="Cerrar">
            <IconX size={22} />
          </button>
        </div>
        {/* Split resizable */}
        <Split className="flex-1 min-h-0 w-full flex h-full">
          {/* Panel izquierdo: lista de archivos */}
          <Split.Pane
            initialWidth={340}
            minWidth={220}
            maxWidth={500}>
            <DiffFileList
              ref={listRef}
              files={normalizedFiles}
              selectedIndex={selectedIndex}
              onSelect={(file, idx) => {
                setSelected(file);
                setSelectedIndex(idx);
              }}
              onAction={(file, idx) => {
                setSelected(file);
                setSelectedIndex(idx);
              }}
              autoFocusSearch={true}
            />
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
