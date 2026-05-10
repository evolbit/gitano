import { Split } from "@gfazioli/mantine-split-pane";
import { Accordion, Box } from "@mantine/core";
import React, { useEffect, useRef, useState } from "react";
import { REPO_LAYOUT } from "../constants/layout";
import { useWorkingDirectoryChanges } from "../hooks/useWorkingDirectoryChanges";
import { useFileHunksStore } from "../store/hunks";
import { useRepoStore } from "../store/repo";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "../store/workspaceUi";
import { FileChangeWithHunks } from "../types/git";
import { BranchList } from "./BranchList";
import ChangesExplorer from "./ChangesExplorer";
import ChangesPanel from "./ChangesPanel";
import CommitList from "./CommitList";
import DiffModal from "./DiffModal";
import { IconFolder, IconGitBranch, IconStack2 } from "./icons";
import TopToolbar from "./TopToolbar";

const RepoTabLayout: React.FC = () => {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;
  const selectedCommit = tab?.selectedCommit;
  const workspaceState = useWorkspaceUiStore((s) =>
    repoPath
      ? s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE
      : DEFAULT_REPO_WORKSPACE_STATE
  );
  const setLeftAccordionOpen = useWorkspaceUiStore(
    (s) => s.setLeftAccordionOpen
  );
  const setWorkingChangesViewMode = useWorkspaceUiStore(
    (s) => s.setWorkingChangesViewMode
  );
  const setMainChangesExpanded = useWorkspaceUiStore(
    (s) => s.setMainChangesExpanded
  );
  const setLeftPaneWidth = useWorkspaceUiStore((s) => s.setLeftPaneWidth);
  const setCommitDetailsWidth = useWorkspaceUiStore(
    (s) => s.setCommitDetailsWidth
  );

  // Constant automatic polling, without controls or notifications
  const { changes, loading, error, refreshChanges } = useWorkingDirectoryChanges(repoPath, {
    pollInterval: 2000,
    enabled: !!repoPath,
    pauseOnInactive: false,
    cacheKey: activeTabId ? `changes-${activeTabId}` : undefined,
    showNotifications: false,
  });

  // State for the file selected from Changes
  const [selectedWorkingFile, setSelectedWorkingFile] =
    useState<FileChangeWithHunks | null>(null);
  const leftSidebarPaneRef = useRef<HTMLDivElement | null>(null);
  const commitDetailsPaneRef = useRef<HTMLDivElement | null>(null);
  const lastCommitDetailsPaneWidthRef = useRef<number | string>(
    workspaceState.commitDetailsWidth ?? REPO_LAYOUT.panes.right.initial,
  );

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

  const handleCloseDiffModal = () => {
    setSelectedWorkingFile(null);
    useFileHunksStore.getState().clearFileHunks();
  };

  useEffect(() => {
    const leftSidebarPane = leftSidebarPaneRef.current;

    if (!leftSidebarPane) return;

    const restoredWidth =
      workspaceState.leftPaneWidth ?? REPO_LAYOUT.panes.left.initial;

    leftSidebarPane.style.width =
      typeof restoredWidth === "number"
        ? `${Math.max(restoredWidth, REPO_LAYOUT.panes.left.min)}px`
        : restoredWidth;
  }, [repoPath, workspaceState.leftPaneWidth]);

  useEffect(() => {
    if (selectedWorkingFile) return;

    const commitDetailsPane = commitDetailsPaneRef.current;

    if (!commitDetailsPane) return;

    lastCommitDetailsPaneWidthRef.current =
      workspaceState.commitDetailsWidth ?? REPO_LAYOUT.panes.right.initial;

    if (selectedCommit) {
      const restoredWidth = lastCommitDetailsPaneWidthRef.current;
      commitDetailsPane.style.width =
        typeof restoredWidth === "number"
          ? `${Math.max(restoredWidth, REPO_LAYOUT.panes.right.min)}px`
          : restoredWidth;
      return;
    }

    const currentWidth = commitDetailsPane.getBoundingClientRect().width;

    if (currentWidth > 1) {
      lastCommitDetailsPaneWidthRef.current = Math.max(
        currentWidth,
        REPO_LAYOUT.panes.right.min,
      );
    }

    commitDetailsPane.style.width = "0px";
  }, [
    repoPath,
    selectedCommit,
    selectedWorkingFile,
    workspaceState.commitDetailsWidth,
  ]);

  if (!tab) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <TopToolbar />
      <div className="flex-1 min-h-0">
        <Split className="h-full w-full min-h-0 flex-1">
          {/* Left sidebar */}
          <Split.Pane
            ref={leftSidebarPaneRef}
            initialWidth={
              workspaceState.leftPaneWidth ?? REPO_LAYOUT.panes.left.initial
            }
            minWidth={REPO_LAYOUT.panes.left.min}
            maxWidth={REPO_LAYOUT.panes.left.max}
            onResizeEnd={(size) => {
              if (!repoPath || size.width <= 1) return;
              setLeftPaneWidth(repoPath, size.width);
            }}
            className="!h-full !min-h-0 flex flex-col"
          >
            <Box className="flex-1 text-foreground flex flex-col min-h-0">
              <Accordion
                multiple
                value={workspaceState.leftAccordionOpen}
                onChange={(value) => {
                  if (!repoPath) return;
                  setLeftAccordionOpen(repoPath, value);
                }}
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
                        Loading changes...
                      </div>
                    )}
                    {!error && changes.length === 0 && !loading && (
                      <div className="p-4 text-center text-muted-foreground">
                        No changes in the working directory
                      </div>
                    )}
                    {changes.length > 0 && (
                      <ChangesExplorer
                        files={changes}
                        selectedPath={selectedWorkingFile?.path ?? changes[0]?.path ?? null}
                        onSelectFile={(file) =>
                          handleSelectWorkingFile(file as FileChangeWithHunks)
                        }
                        viewMode={workspaceState.workingChangesViewMode}
                        onViewModeChange={(mode) => {
                          if (!repoPath) return;
                          setWorkingChangesViewMode(repoPath, mode);
                        }}
                        showFileCheckboxes={false}
                        surface="main"
                        repoPath={repoPath}
                        onImmediateStageChange={refreshChanges}
                        expandedState={workspaceState.mainChangesExpanded}
                        onExpandedStateChange={(expanded) => {
                          if (!repoPath) return;
                          setMainChangesExpanded(repoPath, expanded);
                        }}
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
                        Branches
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
                        Folders
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
            <Split orientation="vertical" className="h-full w-full">
              <Split.Pane
                grow
                initialWidth={REPO_LAYOUT.panes.middle.initial}
                minWidth={REPO_LAYOUT.panes.middle.min}
              >
                <CommitList />
              </Split.Pane>
              <Split.Resizer
                className={
                  selectedCommit
                    ? "!bg-border hover:!bg-primary [--split-resizer-size:1px]"
                    : "hidden"
                }
              />
              <Split.Pane
                ref={commitDetailsPaneRef}
                initialWidth={
                  workspaceState.commitDetailsWidth ??
                  REPO_LAYOUT.panes.right.initial
                }
                minWidth={selectedCommit ? REPO_LAYOUT.panes.right.min : 0}
                onResizeEnd={(size) => {
                  if (size.width > 1) {
                    lastCommitDetailsPaneWidthRef.current = size.width;
                    if (repoPath) {
                      setCommitDetailsWidth(repoPath, size.width);
                    }
                  }
                }}
                className={selectedCommit ? "overflow-hidden" : "hidden overflow-hidden"}
              >
                {selectedCommit ? <ChangesPanel /> : null}
              </Split.Pane>
            </Split>
          </Split.Pane>
        </Split>
      </div>
      {selectedWorkingFile && repoPath && changes.length > 0 && (
        <DiffModal
          open={true}
          files={changes}
          initialFile={selectedWorkingFile}
          onClose={handleCloseDiffModal}
          onFileSelect={(file) => {
            if ("hunks" in file) {
              handleSelectWorkingFile(file);
            }
          }}
          changesViewMode={workspaceState.workingChangesViewMode}
          onChangesViewModeChange={(mode) => {
            if (!repoPath) return;
            setWorkingChangesViewMode(repoPath, mode);
          }}
          repoPath={repoPath}
          onWorkingTreeStageChange={refreshChanges}
        />
      )}
    </div>
  );
};

export default RepoTabLayout;
