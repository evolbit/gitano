import { Split } from "@gfazioli/mantine-split-pane";
import { Menu } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyStash,
  applyStashFiles,
  dropStash,
  editStashMessage,
  getStashFiles,
  listStashes,
  popStash,
} from "@/shared/api/git/stashes";
import { APP_EVENTS } from "@/shared/config/events";
import type { GitStashEntry, StashFileChange } from "@/shared/types/git";
import {
  buildCompressedTree,
  type ChangesExplorerFile,
} from "@/shared/lib/tree/changesExplorerTree";
import { ChangesExplorerFileRow } from "@/features/working-changes/changes-explorer/ChangesExplorerFileRow";
import { ChangesExplorerTreeNodes } from "@/features/working-changes/changes-explorer/ChangesExplorerTreeNodes";
import {
  ChangesExplorerCheckboxState,
  getFolderCheckboxState as computeFolderCheckboxState,
} from "@/features/working-changes/changes-explorer/utils";
import {
  IconBinaryTree2,
  IconDotsVertical,
  IconLayoutList,
  IconSearch,
} from "@/components/icons";
import {
  toChangesExplorerFile,
  toSelectedStashFileSet,
} from "./utils/stashFiles";

type StashesPanelProps = {
  repoPath: string;
  selectedStashRef: string | null;
  selectedStashDiffPath: string | null;
  onSelectStashRef: (stashRef: string | null) => void;
  onSelectStashDiffPath: (path: string | null) => void;
  onOpenStashDiff: (stashRef: string, filePath: string) => void;
};

type StashFilesViewMode = "flat" | "tree";

function StashPanelState({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function StashesPanel({
  repoPath,
  selectedStashRef,
  selectedStashDiffPath,
  onSelectStashRef,
  onSelectStashDiffPath,
  onOpenStashDiff,
}: StashesPanelProps) {
  const [stashes, setStashes] = useState<GitStashEntry[]>([]);
  const [stashFiles, setStashFiles] = useState<StashFileChange[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loadingStashes, setLoadingStashes] = useState(false);
  const [hasLoadedStashes, setHasLoadedStashes] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSelector, setEditingSelector] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [actionInFlight, setActionInFlight] = useState(false);
  const [stashFilesViewMode, setStashFilesViewMode] =
    useState<StashFilesViewMode>("flat");
  const [stashFileSearch, setStashFileSearch] = useState("");
  const [expandedStashFolders, setExpandedStashFolders] = useState<
    Record<string, boolean>
  >({});

  const selectedStash = useMemo(
    () => stashes.find((entry) => entry.selector === selectedStashRef) ?? null,
    [stashes, selectedStashRef],
  );

  const stashExplorerFiles = useMemo(
    () => stashFiles.map(toChangesExplorerFile),
    [stashFiles],
  );

  const filteredStashExplorerFiles = useMemo(() => {
    const query = stashFileSearch.trim().toLowerCase();
    if (!query) return stashExplorerFiles;

    return stashExplorerFiles.filter((file) =>
      file.path.toLowerCase().includes(query),
    );
  }, [stashExplorerFiles, stashFileSearch]);

  const stashFileTree = useMemo(
    () => buildCompressedTree(filteredStashExplorerFiles),
    [filteredStashExplorerFiles],
  );

  const refreshStashes = useCallback(async () => {
    if (!repoPath) return;
    setLoadingStashes(true);
    setError(null);
    try {
      const entries = await listStashes(repoPath);
      setStashes(entries);
      if (entries.length === 0) {
        onSelectStashRef(null);
        onSelectStashDiffPath(null);
        setStashFiles([]);
        setSelectedFiles(new Set());
        return;
      }

      if (!selectedStashRef || !entries.some((entry) => entry.selector === selectedStashRef)) {
        onSelectStashRef(entries[0].selector);
      }
    } catch (stashError) {
      setError(String(stashError));
    } finally {
      setHasLoadedStashes(true);
      setLoadingStashes(false);
    }
  }, [onSelectStashDiffPath, onSelectStashRef, repoPath, selectedStashRef]);

  const refreshStashFiles = useCallback(async () => {
    if (!repoPath || !selectedStashRef) {
      setStashFiles([]);
      setSelectedFiles(new Set());
      return;
    }

    setLoadingFiles(true);
    setError(null);
    try {
      const files = await getStashFiles(repoPath, selectedStashRef);
      setStashFiles(files);
      setExpandedStashFolders({});
      setSelectedFiles(toSelectedStashFileSet(files));
      if (
        selectedStashDiffPath &&
        !files.some((stashFile) => stashFile.path === selectedStashDiffPath)
      ) {
        onSelectStashDiffPath(null);
      }
    } catch (stashError) {
      setError(String(stashError));
      setStashFiles([]);
      setSelectedFiles(new Set());
    } finally {
      setLoadingFiles(false);
    }
  }, [onSelectStashDiffPath, repoPath, selectedStashDiffPath, selectedStashRef]);

  useEffect(() => {
    void refreshStashes();
  }, [refreshStashes]);

  useEffect(() => {
    void refreshStashFiles();
  }, [refreshStashFiles]);

  useEffect(() => {
    const handleRefresh = () => {
      void refreshStashes();
      void refreshStashFiles();
    };
    window.addEventListener(APP_EVENTS.stashesRefresh, handleRefresh);
    return () => window.removeEventListener(APP_EVENTS.stashesRefresh, handleRefresh);
  }, [refreshStashFiles, refreshStashes]);

  const notifyDataRefresh = () => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.stashesRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
  };

  const toggleFileSelection = useCallback((path: string, checked: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

  const selectAllFiles = () => {
    setSelectedFiles(toSelectedStashFileSet(stashFiles));
  };

  const unselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  const getStashFileCheckboxState = useCallback(
    (file: ChangesExplorerFile): ChangesExplorerCheckboxState =>
      selectedFiles.has(file.path) ? "checked" : "unchecked",
    [selectedFiles],
  );

  const getStashFolderCheckboxState = useCallback(
    (filesInFolder: ChangesExplorerFile[]) =>
      computeFolderCheckboxState(filesInFolder, getStashFileCheckboxState),
    [getStashFileCheckboxState],
  );

  const handleSelectStashFile = useCallback(
    (file: ChangesExplorerFile) => {
      if (!selectedStashRef) return;
      onSelectStashDiffPath(file.path);
      onOpenStashDiff(selectedStashRef, file.path);
    },
    [onOpenStashDiff, onSelectStashDiffPath, selectedStashRef],
  );

  const toggleStashExplorerFileSelection = useCallback(
    (file: ChangesExplorerFile) => {
      toggleFileSelection(file.path, !selectedFiles.has(file.path));
    },
    [selectedFiles, toggleFileSelection],
  );

  const toggleStashFolder = useCallback((path: string) => {
    setExpandedStashFolders((prev) => ({
      ...prev,
      [path]: !(prev[path] ?? true),
    }));
  }, []);

  const toggleStashFolderSelection = useCallback(
    (_folderPath: string, filesInFolder: ChangesExplorerFile[]) => {
      const filePaths = Array.from(
        new Set(filesInFolder.map((file) => file.path)),
      );
      const shouldSelect = filePaths.some((path) => !selectedFiles.has(path));

      setSelectedFiles((prev) => {
        const next = new Set(prev);
        filePaths.forEach((path) => {
          if (shouldSelect) {
            next.add(path);
          } else {
            next.delete(path);
          }
        });
        return next;
      });
    },
    [selectedFiles],
  );

  const ignoreFileContextMenu = useCallback(
    (_file: ChangesExplorerFile, _x: number, _y: number) => {},
    [],
  );

  const ignoreFolderContextMenu = useCallback(
    (
      _folderPath: string,
      _files: ChangesExplorerFile[],
      _isUntracked: boolean,
      _x: number,
      _y: number,
    ) => {},
    [],
  );

  const handleApplySelectedFiles = async () => {
    if (!repoPath || !selectedStashRef || actionInFlight || selectedFiles.size === 0) return;
    setActionInFlight(true);
    setError(null);
    try {
      await applyStashFiles(repoPath, selectedStashRef, Array.from(selectedFiles));
      notifyDataRefresh();
    } catch (stashError) {
      setError(String(stashError));
    } finally {
      setActionInFlight(false);
    }
  };

  const runRowAction = async (action: () => Promise<unknown>) => {
    if (actionInFlight) return;
    setActionInFlight(true);
    setError(null);
    try {
      await action();
      notifyDataRefresh();
    } catch (stashError) {
      setError(String(stashError));
    } finally {
      setActionInFlight(false);
    }
  };

  const handleSaveEditedMessage = async () => {
    if (!repoPath || !editingSelector || actionInFlight) return;
    const nextMessage = editingMessage.trim();
    if (!nextMessage) {
      setEditingSelector(null);
      return;
    }

    await runRowAction(async () => {
      await editStashMessage(repoPath, editingSelector, nextMessage);
    });
    setEditingSelector(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-r border-border bg-background">
      <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-3 py-2">
        <span className="text-sm font-semibold text-foreground">
          Stashes ({stashes.length})
        </span>
      </div>

      <Split orientation="horizontal" className="min-h-0 w-full flex-1">
        <Split.Pane initialHeight="35%" minHeight={140} className="min-h-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {loadingStashes && !hasLoadedStashes ? (
              <StashPanelState message="Loading" />
            ) : stashes.length === 0 ? (
              <StashPanelState message="No stashes" />
            ) : (
              <div className="min-h-0 flex-1 overflow-auto p-2">
                {stashes.map((stash) => {
                  const isSelected = selectedStashRef === stash.selector;
                  const isEditing = editingSelector === stash.selector;
                  return (
                    <div
                      key={stash.selector}
                      className={`group mb-1 rounded border px-2 py-1.5 transition-colors ${
                        isSelected
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-transparent hover:border-zinc-700 hover:bg-zinc-800/40"
                      }`}
                      onClick={() => {
                        onSelectStashRef(stash.selector);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">{stash.selector}</span>
                        <Menu shadow="md" width={220} withinPortal position="bottom-end">
                          <Menu.Target>
                            <button
                              type="button"
                              aria-label={`Open actions for ${stash.selector}`}
                              onClick={(event) => event.stopPropagation()}
                              className="ml-auto rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-100 opacity-0 group-hover:opacity-100"
                            >
                              <IconDotsVertical size={14} />
                            </button>
                          </Menu.Target>
                          <Menu.Dropdown className="rounded border border-zinc-700 bg-zinc-900/95 p-1 text-sm text-zinc-200 shadow-lg">
                            <Menu.Item
                              className="rounded px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                              onClick={() => {
                                void runRowAction(async () => {
                                  await applyStash(repoPath, stash.selector);
                                });
                              }}
                            >
                              Apply Stash
                            </Menu.Item>
                            <Menu.Item
                              className="rounded px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                              onClick={() => {
                                void runRowAction(async () => {
                                  await popStash(repoPath, stash.selector);
                                });
                              }}
                            >
                              Pop Stash
                            </Menu.Item>
                            <Menu.Item
                              className="rounded px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                              onClick={() => {
                                void runRowAction(async () => {
                                  await dropStash(repoPath, stash.selector);
                                });
                              }}
                            >
                              Delete Stash
                            </Menu.Item>
                            <Menu.Item
                              className="rounded px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                              onClick={() => {
                                setEditingSelector(stash.selector);
                                setEditingMessage(stash.message);
                              }}
                            >
                              Edit Stash Message
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </div>
                      {isEditing ? (
                        <input
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                          value={editingMessage}
                          onChange={(event) => setEditingMessage(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleSaveEditedMessage();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              setEditingSelector(null);
                            }
                          }}
                          onBlur={() => {
                            void handleSaveEditedMessage();
                          }}
                          autoFocus
                        />
                      ) : (
                        <p className="truncate text-xs text-zinc-200">{stash.message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Split.Pane>
        <Split.Resizer className="!bg-transparent hover:!bg-primary [--split-resizer-size:1px]" />
        <Split.Pane grow initialHeight="65%" minHeight={140} className="min-h-0">
          <div className="flex h-full min-h-0 flex-col border-t border-border">
            <div className="border-b border-border bg-background-emphasis p-2">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    placeholder="Search files..."
                    value={stashFileSearch}
                    onChange={(event) => setStashFileSearch(event.target.value)}
                  />
                  <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center overflow-hidden rounded border border-border bg-background">
                  {(
                    [
                      {
                        mode: "flat" as const,
                        label: "Flat View",
                        icon: <IconLayoutList size={15} />,
                      },
                      {
                        mode: "tree" as const,
                        label: "Tree View",
                        icon: <IconBinaryTree2 size={15} />,
                      },
                    ] as const
                  ).map((option) => {
                    const active = stashFilesViewMode === option.mode;
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        className={`flex h-8 w-8 items-center justify-center transition-colors ${
                          active
                            ? "bg-zinc-800 text-zinc-100"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        }`}
                        onClick={() => setStashFilesViewMode(option.mode)}
                        aria-label={option.label}
                        title={option.label}
                      >
                        {option.icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {loadingFiles ? (
                <div className="p-2 text-xs text-muted-foreground">Loading files...</div>
              ) : null}
              {!loadingFiles && selectedStash && stashFiles.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">
                  Selected stash has no files.
                </div>
              ) : null}
              {!loadingFiles &&
              selectedStash &&
              stashFiles.length > 0 &&
              filteredStashExplorerFiles.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">
                  No files match search.
                </div>
              ) : null}
              {!loadingFiles && stashFilesViewMode === "flat"
                ? filteredStashExplorerFiles.map((file) => (
                    <ChangesExplorerFileRow
                      key={file.path}
                      file={file}
                      selectedPath={selectedStashDiffPath}
                      showFileCheckboxes
                      checkboxState={getStashFileCheckboxState(file)}
                      onSelectFile={handleSelectStashFile}
                      onOpenFileContextMenu={ignoreFileContextMenu}
                      onToggleFileSelection={toggleStashExplorerFileSelection}
                    />
                  ))
                : null}
              {!loadingFiles && stashFilesViewMode === "tree" ? (
                <ChangesExplorerTreeNodes
                  nodes={stashFileTree}
                  depth={0}
                  search={stashFileSearch}
                  expanded={expandedStashFolders}
                  selectedPath={selectedStashDiffPath}
                  showFileCheckboxes
                  getFileCheckboxState={getStashFileCheckboxState}
                  onSelectFile={handleSelectStashFile}
                  onOpenFileContextMenu={ignoreFileContextMenu}
                  onOpenFolderContextMenu={ignoreFolderContextMenu}
                  onToggleFolder={toggleStashFolder}
                  onToggleFileSelection={toggleStashExplorerFileSelection}
                  onToggleFolderSelection={toggleStashFolderSelection}
                  getFolderCheckboxState={getStashFolderCheckboxState}
                />
              ) : null}
            </div>
          </div>
        </Split.Pane>
      </Split>

      <div className="border-t border-border bg-background-emphasis p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={selectAllFiles}
              className="rounded border border-border px-2 py-1 text-zinc-300 hover:bg-zinc-800"
              disabled={stashFiles.length === 0}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={unselectAllFiles}
              className="rounded border border-border px-2 py-1 text-zinc-300 hover:bg-zinc-800"
              disabled={stashFiles.length === 0}
            >
              Unselect All
            </button>
          </div>
          <button
            type="button"
            className="h-8 rounded border border-border bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void handleApplySelectedFiles();
            }}
            disabled={!selectedStashRef || selectedFiles.size === 0 || actionInFlight}
          >
            Apply
          </button>
        </div>
        {error ? <div className="mt-1 text-xs text-red-400">{error}</div> : null}
      </div>
    </div>
  );
}
