import { forwardRef, useEffect, useRef, useState } from "react";
import { useStagedLinesStore } from "@/features/working-changes/stores/stagingStore";
import { DiffLine, FileChange } from "@/shared/types/git";
import FileListItem from "../file-list-item/FileListItem";
import { IconCheck, IconSearch } from "../icons";
import { DiffFileListProps } from "./types";

// Type guard to know whether the ref is an object with .current
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
      showFileCheckboxes = false,
    },
    ref
  ) => {
    const [search, setSearch] = useState("");
    const [internalSelectedIndex, setInternalSelectedIndex] =
      useState(selectedIndex);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const stagedLines = useStagedLinesStore((s) => s.stagedLines);
    const setAllStagedLinesForFile = useStagedLinesStore(
      (s) => s.setAllStagedLinesForFile
    );
    const clearStagedLinesForFile = useStagedLinesStore(
      (s) => s.clearStagedLinesForFile
    );
    const setStagedNewFile = useStagedLinesStore((s) => s.setStagedNewFile);
    const isStagedNewFile = useStagedLinesStore((s) => s.isStagedNewFile);

    // Normalize the status to lowercase and cast it to the correct type
    const allowedStatuses = [
      "added",
      "deleted",
      "modified",
      "renamed",
      "copied",
      "typeChanged",
    ] as const;
    type AllowedStatus = (typeof allowedStatuses)[number];
    const normalizedFiles = files.map((file) => ({
      ...file,
      status: allowedStatuses.includes((file.status as any).toLowerCase())
        ? ((file.status as string).toLowerCase() as AllowedStatus)
        : ("modified" as AllowedStatus),
    }));

    // File filtering
    const filteredFiles =
      search.trim() === ""
        ? normalizedFiles
        : normalizedFiles.filter((f) =>
            f.path.toLowerCase().includes(search.toLowerCase())
          );

    // Keep the selected index within bounds
    useEffect(() => {
      if (internalSelectedIndex >= filteredFiles.length) {
        setInternalSelectedIndex(filteredFiles.length - 1);
      }
      if (internalSelectedIndex < 0 && filteredFiles.length > 0) {
        setInternalSelectedIndex(0);
      }
    }, [filteredFiles.length, internalSelectedIndex]);

    // Sync the internal selected index with the prop
    useEffect(() => {
      setInternalSelectedIndex(selectedIndex);
    }, [selectedIndex]);

    // Keyboard navigation in the file list
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (document.activeElement === searchInputRef.current) return;
        if (filteredFiles.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const newIndex = Math.min(
            internalSelectedIndex + 1,
            filteredFiles.length - 1
          );
          setInternalSelectedIndex(newIndex);
          // Notify the parent only if the index changed
          if (newIndex !== internalSelectedIndex) {
            onSelect(filteredFiles[newIndex], newIndex);
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const newIndex = Math.max(internalSelectedIndex - 1, 0);
          setInternalSelectedIndex(newIndex);
          // Notify the parent only if the index changed
          if (newIndex !== internalSelectedIndex) {
            onSelect(filteredFiles[newIndex], newIndex);
          }
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
    }, [filteredFiles, internalSelectedIndex, onSelect, onAction]);

    // Auto-scroll to keep the selected row visible
    useEffect(() => {
      if (!isRefObject(ref) || !ref.current) return;
      const el = ref.current.querySelector(
        `[data-file-index='${internalSelectedIndex}']`
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, [internalSelectedIndex, ref]);

    useEffect(() => {
      if (autoFocusSearch && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [autoFocusSearch]);

    return (
      <div
        className={`flex flex-col h-full min-h-0 border-r border-border flex-1 ${rowBgColor}`}>
        {/* Search box inside the column */}
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
              // Normalize the status to the allowed values
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
              // Determine row classes
              let rowClass = `${rowTextColor} ${rowBgColor}`;
              if (highlightSelected && internalSelectedIndex === idx) {
                rowClass = `${rowHighlightColor}`;
              }
              // Compute the checkbox state here
              let checkboxState: "checked" | "indeterminate" | "unchecked" =
                "unchecked";
              const fileStaged = stagedLines[file.path] || {};
              const hunks = (file as any).hunks || [];
              let totalStageable = 0;
              hunks.forEach((hunk: any) => {
                totalStageable += hunk.lines.filter(
                  (line: DiffLine) => line.kind === "Add" || line.kind === "Del"
                ).length;
              });
              let stagedCount = 0;
              for (const hunkIdx in fileStaged) {
                stagedCount += fileStaged[hunkIdx]?.size || 0;
              }
              // Detect an empty new file
              const isNewFile =
                file.status === "added" &&
                hunks.length === 1 &&
                hunks[0].is_new_file;

              if (isNewFile) {
                checkboxState = isStagedNewFile(file.path)
                  ? "checked"
                  : "unchecked";
              } else if (stagedCount === 0) {
                checkboxState = "unchecked";
              } else if (stagedCount === totalStageable && totalStageable > 0) {
                checkboxState = "checked";
              } else {
                checkboxState = "indeterminate";
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
                    {/* Per-file checkbox, only when showFileCheckboxes is enabled */}
                    {showFileCheckboxes &&
                      (() => {
                        const toggleFileSelection = () => {
                          if (isNewFile) {
                            setStagedNewFile(
                              file.path,
                              checkboxState !== "checked"
                            );
                            return;
                          }

                          if (checkboxState !== "checked") {
                            const hunks = (file as any).hunks || [];
                            const allHunks: { [hunkIdx: number]: number[] } =
                              {};

                            hunks.forEach(
                              (
                                hunk: { lines: DiffLine[] },
                                hunkIdx: number
                              ) => {
                                const lineIdxs = hunk.lines
                                  .map((line: DiffLine, idx: number) =>
                                    line.kind === "Add" || line.kind === "Del"
                                      ? idx
                                      : null
                                  )
                                  .filter((lineIdx) => lineIdx !== null) as number[];

                                if (lineIdxs.length > 0) {
                                  allHunks[hunkIdx] = lineIdxs;
                                }
                              }
                            );

                            setAllStagedLinesForFile(file.path, allHunks);
                            return;
                          }

                          clearStagedLinesForFile(file.path);
                        };

                        return (
                          <button
                            type="button"
                            className={`flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${
                              checkboxState === "checked" ||
                              checkboxState === "indeterminate"
                                ? "border-blue-500 bg-blue-600 text-white"
                                : "border-zinc-500 bg-transparent text-transparent"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFileSelection();
                            }}
                            aria-checked={
                              checkboxState === "indeterminate"
                                ? "mixed"
                                : checkboxState === "checked"
                            }
                            aria-label={`Toggle file selection for ${file.path}`}>
                            {checkboxState === "checked" ? (
                              <IconCheck size={12} className="text-white" />
                            ) : checkboxState === "indeterminate" ? (
                              <span className="block h-0.5 w-2 rounded bg-white" />
                            ) : null}
                          </button>
                        );
                      })()}
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
