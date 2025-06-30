import { forwardRef, useEffect, useRef, useState } from "react";
import { FileChange } from "../types/git";
import FileListItem from "./FileListItem";
import { IconSearch } from "./icons";

interface DiffFileListProps {
  files: FileChange[];
  onSelect: (file: FileChange, idx: number) => void;
  onAction?: (file: FileChange, idx: number) => void;
  selectedIndex: number;
  autoFocusSearch?: boolean;
  showSearch?: boolean;
  rowBgColor?: string; // color de fondo de fila
  rowHighlightColor?: string; // color de resaltado
  rowTextColor?: string; // color de texto
  highlightSelected?: boolean; // activar/desactivar resaltado
  rowDividerColor?: string; // color de la línea de separación
  rowPadding?: string; // padding de los li
}

// Type guard para saber si el ref es un objeto con .current
function isRefObject(r: unknown): r is React.RefObject<HTMLUListElement> {
  return !!r && typeof r === "object" && "current" in r;
}

const DiffFileList = forwardRef<HTMLUListElement, DiffFileListProps>(
  (
    {
      files,
      onSelect,
      onAction,
      selectedIndex,
      autoFocusSearch,
      showSearch = true,
      rowBgColor = "bg-background-emphasis",
      rowHighlightColor = "bg-blue-600/20 text-blue-300 font-semibold",
      rowTextColor = "text-foreground",
      highlightSelected = true,
      rowDividerColor = "divide-border",
      rowPadding = "px-4 py-1",
    },
    ref
  ) => {
    const [search, setSearch] = useState("");
    const [internalSelectedIndex, setInternalSelectedIndex] =
      useState(selectedIndex);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Filtrado de archivos
    const filteredFiles = files.filter((f) =>
      f.path.toLowerCase().includes(search.toLowerCase())
    );

    // Mantener el índice seleccionado dentro del rango
    useEffect(() => {
      if (internalSelectedIndex >= filteredFiles.length) {
        setInternalSelectedIndex(filteredFiles.length - 1);
      }
      if (internalSelectedIndex < 0 && filteredFiles.length > 0) {
        setInternalSelectedIndex(0);
      }
    }, [filteredFiles.length, internalSelectedIndex]);

    // Actualizar el archivo seleccionado cuando cambia el índice
    useEffect(() => {
      if (filteredFiles[internalSelectedIndex]) {
        onSelect(filteredFiles[internalSelectedIndex], internalSelectedIndex);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [internalSelectedIndex, filteredFiles]);

    // Navegación por teclado en la lista de archivos
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (document.activeElement === searchInputRef.current) return;
        if (filteredFiles.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setInternalSelectedIndex((prev) =>
            Math.min(prev + 1, filteredFiles.length - 1)
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setInternalSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredFiles[internalSelectedIndex] && onAction) {
            onAction(
              filteredFiles[internalSelectedIndex],
              internalSelectedIndex
            );
          }
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [filteredFiles, internalSelectedIndex, onAction]);

    // Scroll automático para mantener visible la fila seleccionada
    useEffect(() => {
      if (!isRefObject(ref) || !ref.current) return;
      const el = ref.current.querySelector(
        `[data-file-index='${internalSelectedIndex}']`
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, [internalSelectedIndex, filteredFiles, ref]);

    useEffect(() => {
      if (autoFocusSearch && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [autoFocusSearch]);

    return (
      <div
        className={`flex flex-col h-full min-h-0 border-r border-border flex-1 ${rowBgColor}`}>
        {/* Caja de búsqueda dentro de la columna */}
        {showSearch && (
          <div className="w-full p-2 border-b border-border bg-background-emphasis sticky top-0 z-10">
            <div className="relative w-full h-12">
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-background border border-border rounded px-3 py-1.5 pl-9 text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder="Buscar archivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <IconSearch className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        )}
        <ul
          ref={ref}
          tabIndex={0}
          className={`overflow-y-auto h-full min-h-0 divide-y w-full flex-1 ${rowDividerColor}`}>
          {filteredFiles.length === 0 ? (
            <li className="text-center text-muted-foreground py-4">
              No se encontraron archivos
            </li>
          ) : (
            filteredFiles.map((file, idx) => {
              // Normaliza el status a los valores permitidos
              const allowedStatuses = [
                "added",
                "deleted",
                "modified",
                "renamed",
                "copied",
                "typeChanged",
              ];
              const normalizedStatus = allowedStatuses.includes(file.status)
                ? (file.status as FileChange["status"])
                : ("modified" as FileChange["status"]);
              const fileForList: FileChange = {
                ...file,
                status: normalizedStatus,
              };
              // Determinar clases de fila
              let rowClass = `${rowTextColor} ${rowBgColor}`;
              if (highlightSelected && internalSelectedIndex === idx) {
                rowClass = `${rowHighlightColor}`;
              }
              return (
                <li
                  key={file.path}
                  data-file-index={idx}
                  className={`${rowPadding} cursor-pointer transition-colors select-none text-sm focus:outline-none ${rowClass}`}
                  onClick={() => {
                    setInternalSelectedIndex(idx);
                    if (onAction) {
                      onAction(file, idx);
                    }
                  }}>
                  <div className="flex items-center min-w-0 gap-2">
                    <FileListItem file={fileForList} />
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  }
);

export default DiffFileList;
