import { Split } from "@gfazioli/mantine-split-pane";
import { Accordion, Box } from "@mantine/core";
import React, { useEffect, useState } from "react";
import { REPO_LAYOUT } from "../constants/layout";
import { useWorkingDirectoryChanges } from "../hooks/useWorkingDirectoryChanges";
import { useFileHunksStore } from "../store/hunks";
import { useRepoStore } from "../store/repo";
import { FileChangeWithHunks } from "../types/git";
import { BranchList } from "./BranchList";
import ChangesPanel from "./ChangesPanel";
import CommitList from "./CommitList";
import DiffFileList from "./DiffFileList";
import DiffViewer from "./DiffViewer";
import { IconFolder, IconGitBranch, IconStack2 } from "./icons";
import TopToolbar from "./TopToolbar";

const RepoTabLayout: React.FC = () => {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;

  // Constant automatic polling, without controls or notifications
  const { changes, loading, error } = useWorkingDirectoryChanges(repoPath, {
    pollInterval: 2000,
    enabled: !!repoPath,
    pauseOnInactive: false,
    cacheKey: activeTabId ? `changes-${activeTabId}` : undefined,
    showNotifications: false,
  });

  // State for the file selected from Changes
  const [selectedWorkingFile, setSelectedWorkingFile] =
    useState<FileChangeWithHunks | null>(null);

  // State for file actions in DiffViewer
  const [fileActions, setFileActions] = useState<null | {
    filePath: string;
    insertions: number;
    deletions: number;
    canStage: boolean;
    canDiscard: boolean;
    canRemove: boolean;
    onStage: () => void;
    onDiscard: () => void;
    onRemove: () => void;
  }>(null);

  // Close DiffViewer when the active branch changes
  useEffect(() => {
    setSelectedWorkingFile(null);
  }, [tab?.selectedBranch]);

  // Close DiffViewer if the selected file no longer exists in changes
  useEffect(() => {
    if (
      selectedWorkingFile &&
      !changes.some((f) => f.path === selectedWorkingFile.path)
    ) {
      setSelectedWorkingFile(null);
      useFileHunksStore.getState().clearFileHunks();
    }
  }, [changes, selectedWorkingFile]);

  // Update the selected file reference if the diff or hunks change
  useEffect(() => {
    if (!selectedWorkingFile) return;
    const updated = changes.find((f) => f.path === selectedWorkingFile.path);
    if (updated && updated !== selectedWorkingFile) {
      setSelectedWorkingFile(updated);
      useFileHunksStore.getState().setFileHunks(updated.path, updated.hunks);
    }
  }, [changes, selectedWorkingFile]);

  // Handler to open the diff for a working directory file
  const handleSelectWorkingFile = (file: FileChangeWithHunks) => {
    setSelectedWorkingFile(file);
    useFileHunksStore.getState().setFileHunks(file.path, file.hunks);
  };

  // Handler to return to the normal layout
  const handleCloseDiffViewer = () => {
    setSelectedWorkingFile(null);
    useFileHunksStore.getState().clearFileHunks();
  };

  if (!tab) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <TopToolbar />
      <div className="flex-1 min-h-0">
        <Split className="h-full w-full min-h-0 flex-1">
          {/* Left sidebar */}
          <Split.Pane
            initialWidth={REPO_LAYOUT.panes.left.initial}
            minWidth={REPO_LAYOUT.panes.left.min}
            maxWidth={REPO_LAYOUT.panes.left.max}
            className="!h-full !min-h-0 flex flex-col"
          >
            <Box className="flex-1 text-foreground flex flex-col min-h-0">
              <Accordion
                multiple
                defaultValue={["changes"]}
                variant="contained"
                chevronPosition="left"
                classNames={{
                  root: "bg-background-emphasis text-foreground flex-1 flex flex-col min-h-0",
                  item: "group bg-background text-foreground flex flex-col data-[active]:flex-1 data-[active]:min-h-0",
                  control:
                    "bg-background-emphasis text-foreground p-2 transition-colors hover:bg-background-emphasis",
                  panel:
                    "text-foreground flex-1 flex flex-col min-h-0 bg-background-emphasis",
                  content: "flex-1 min-h-0",
                  icon: "mr-2",
                }}
              >
                <Accordion.Item value="changes">
                  <Accordion.Control>
                    <div className="flex flex-row items-center w-full justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5">
                          <IconStack2 size={18} />
                        </span>
                        <span>Changes ({changes.length})</span>
                      </span>
                    </div>
                  </Accordion.Control>
                  <Accordion.Panel className="min-w-0">
                    {error && (
                      <div className="p-4 text-center text-red-500">
                        Error: {error}
                      </div>
                    )}
                    {loading && changes.length === 0 && (
                      <div className="p-4 text-center text-muted-foreground">
                        Cargando cambios...
                      </div>
                    )}
                    {!error && changes.length === 0 && !loading && (
                      <div className="p-4 text-center text-muted-foreground">
                        No hay cambios en el working directory
                      </div>
                    )}
                    {changes.length > 0 && (
                      <DiffFileList
                        files={changes}
                        selectedIndex={
                          selectedWorkingFile
                            ? changes.findIndex(
                                (f) => f.path === selectedWorkingFile.path,
                              )
                            : 0
                        }
                        showSearch={true}
                        onSelect={(file, _idx) =>
                          handleSelectWorkingFile(file as FileChangeWithHunks)
                        }
                        onAction={(file, _idx) =>
                          handleSelectWorkingFile(file as FileChangeWithHunks)
                        }
                        rowBgColor="bg-background"
                        rowTextColor="text-foreground"
                        highlightSelected={true}
                        rowDividerColor="divide-border"
                        rowPadding="px-2 py-1"
                        showFileCheckboxes={true}
                      />
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="branches">
                  <Accordion.Control>
                    <div className="flex flex-row items-center w-full justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5">
                          <IconGitBranch size={18} />
                        </span>
                        Ramas
                      </span>
                    </div>
                  </Accordion.Control>
                  <Accordion.Panel className="min-w-0">
                    <BranchList />
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="folders">
                  <Accordion.Control>
                    <div className="flex flex-row items-center w-full justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5">
                          <IconFolder size={18} />
                        </span>
                        Carpetas
                      </span>
                    </div>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {/* Folder list goes here */}
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Box>
          </Split.Pane>
          <Split.Resizer className="!bg-background-emphasis hover:!bg-foreground [--split-resizer-size:1px] m-0 border-r border-border rounded-none" />
          {/* Right panel: changes based on the selection */}
          <Split.Pane grow className="!h-full !min-h-0">
            {selectedWorkingFile ? (
              <div className="h-full w-full flex flex-col">
                <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-background-emphasis">
                  <span className="font-bold text-lg">
                    Diff: {selectedWorkingFile.path}
                  </span>
                  {fileActions && (
                    <>
                      <span className="ml-4 flex items-center gap-2 text-xs">
                        <span className="text-green-500 font-semibold">
                          +{fileActions.insertions}
                        </span>
                        <span className="text-red-500 font-semibold">
                          -{fileActions.deletions}
                        </span>
                      </span>
                      <button
                        className="ml-4 px-3 py-1 text-xs bg-green-700 hover:bg-green-800 text-white rounded disabled:opacity-50"
                        disabled={!fileActions.canStage}
                        onClick={fileActions.onStage}
                      >
                        Stage
                      </button>
                      <button
                        className="px-3 py-1 text-xs bg-yellow-700 hover:bg-yellow-800 text-white rounded disabled:opacity-50"
                        disabled={!fileActions.canDiscard}
                        onClick={fileActions.onDiscard}
                      >
                        Discard
                      </button>
                      <button
                        className="px-3 py-1 text-xs bg-red-700 hover:bg-red-800 text-white rounded disabled:opacity-50"
                        disabled={!fileActions.canRemove}
                        onClick={fileActions.onRemove}
                      >
                        Remove
                      </button>
                    </>
                  )}
                  <button
                    className="ml-auto p-2 rounded hover:bg-zinc-800 text-2xl text-muted-foreground"
                    onClick={handleCloseDiffViewer}
                    aria-label="Cerrar diff"
                  >
                    ×
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <DiffViewer
                    repoPath={repoPath || ""}
                    filePath={selectedWorkingFile.path}
                    onFileActionsData={setFileActions}
                  />
                </div>
              </div>
            ) : (
              <Split orientation="vertical" className="h-full w-full">
                <Split.Pane
                  grow
                  initialWidth={REPO_LAYOUT.panes.middle.initial}
                  minWidth={REPO_LAYOUT.panes.middle.min}
                >
                  <CommitList />
                </Split.Pane>
                <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
                <Split.Pane
                  initialWidth={REPO_LAYOUT.panes.right.initial}
                  minWidth={REPO_LAYOUT.panes.right.min}
                >
                  <ChangesPanel />
                </Split.Pane>
              </Split>
            )}
          </Split.Pane>
        </Split>
      </div>
    </div>
  );
};

export default RepoTabLayout;
