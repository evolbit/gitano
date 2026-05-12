import { Split } from "@gfazioli/mantine-split-pane";
import { Menu } from "@mantine/core";
import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_EVENTS } from "../../constants/events";
import { GitStashEntry, StashFileChange } from "../../types/git";
import { IconDotsVertical } from "../icons";

type StashesPanelProps = {
  repoPath: string;
  selectedStashRef: string | null;
  selectedStashDiffPath: string | null;
  onSelectStashRef: (stashRef: string | null) => void;
  onSelectStashDiffPath: (path: string | null) => void;
  onOpenStashDiff: (stashRef: string, filePath: string) => void;
};

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
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSelector, setEditingSelector] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [actionInFlight, setActionInFlight] = useState(false);

  const selectedStash = useMemo(
    () => stashes.find((entry) => entry.selector === selectedStashRef) ?? null,
    [stashes, selectedStashRef],
  );

  const refreshStashes = useCallback(async () => {
    if (!repoPath) return;
    setLoadingStashes(true);
    setError(null);
    try {
      const entries = await core.invoke<GitStashEntry[]>("git_stash_list", {
        path: repoPath,
      });
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
      const files = await core.invoke<StashFileChange[]>("git_stash_files", {
        path: repoPath,
        stashRef: selectedStashRef,
      });
      setStashFiles(files);
      setSelectedFiles(new Set(files.map((file) => file.path)));
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

  const toggleFileSelection = (path: string, checked: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

  const selectAllFiles = () => {
    setSelectedFiles(new Set(stashFiles.map((file) => file.path)));
  };

  const unselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  const handleApplySelectedFiles = async () => {
    if (!repoPath || !selectedStashRef || actionInFlight || selectedFiles.size === 0) return;
    setActionInFlight(true);
    setError(null);
    try {
      await core.invoke("git_stash_apply_files", {
        path: repoPath,
        stashRef: selectedStashRef,
        filePaths: Array.from(selectedFiles),
      });
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
      await core.invoke("git_stash_edit_message", {
        path: repoPath,
        stashRef: editingSelector,
        newMessage: nextMessage,
      });
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
        <Split.Pane initialWidth="50%" minWidth={140} className="min-h-0">
          <div className="h-full min-h-0 overflow-auto p-2">
            {loadingStashes ? (
              <div className="p-2 text-xs text-muted-foreground">Loading stashes...</div>
            ) : null}
            {!loadingStashes && stashes.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">No stashes yet</div>
            ) : null}
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
                      <Menu.Dropdown>
                        <Menu.Item
                          onClick={() => {
                            void runRowAction(async () => {
                              await core.invoke("git_stash_apply", {
                                path: repoPath,
                                stashRef: stash.selector,
                              });
                            });
                          }}
                        >
                          Apply Stash
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            void runRowAction(async () => {
                              await core.invoke("git_stash_pop", {
                                path: repoPath,
                                stashRef: stash.selector,
                              });
                            });
                          }}
                        >
                          Pop Stash
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            void runRowAction(async () => {
                              await core.invoke("git_stash_drop", {
                                path: repoPath,
                                stashRef: stash.selector,
                              });
                            });
                          }}
                        >
                          Delete Stash
                        </Menu.Item>
                        <Menu.Item
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
        </Split.Pane>
        <Split.Resizer className="!bg-transparent hover:!bg-primary [--split-resizer-size:1px]" />
        <Split.Pane grow className="min-h-0">
          <div className="flex h-full min-h-0 flex-col border-t border-border">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <span className="text-xs font-medium text-zinc-300">Stash Files</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllFiles}
                  className="rounded border border-border px-2 py-0.5 text-zinc-300 hover:bg-zinc-800"
                  disabled={stashFiles.length === 0}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={unselectAllFiles}
                  className="rounded border border-border px-2 py-0.5 text-zinc-300 hover:bg-zinc-800"
                  disabled={stashFiles.length === 0}
                >
                  Unselect All
                </button>
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
              {stashFiles.map((file) => {
                const checked = selectedFiles.has(file.path);
                const selectedForDiff = selectedStashDiffPath === file.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    className={`flex w-full items-center gap-2 border-b border-zinc-800/60 px-2 py-1.5 text-left ${
                      selectedForDiff ? "bg-blue-500/10" : "hover:bg-zinc-800/40"
                    }`}
                    onClick={() => {
                      if (!selectedStashRef) return;
                      onSelectStashDiffPath(file.path);
                      onOpenStashDiff(selectedStashRef, file.path);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleFileSelection(file.path, event.target.checked)}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span className="truncate text-xs text-zinc-200">{file.path}</span>
                    <span className="ml-auto text-[11px] text-zinc-400">
                      +{file.insertions} -{file.deletions}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Split.Pane>
      </Split>

      <div className="border-t border-border bg-background-emphasis p-2">
        <div className="flex items-center justify-end">
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
