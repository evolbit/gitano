import { Split } from "@gfazioli/mantine-split-pane";
import { Tabs, Tooltip } from "@mantine/core";
import React, { useEffect, useRef, useState } from "react";
import { APP_EVENTS } from "@/shared/config/events";
import { REPO_LAYOUT } from "@/shared/config/layout";
import { classNames } from "@/shared/ui";
import { useFileHunksStore } from "@/features/diffs";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  type LeftPaneSection,
  useWorkspaceUiStore,
} from "@/features/repository-workspace/stores/workspace-ui-store";
import {
  DEFAULT_REPOSITORY_SURFACE_STATE,
  REPOSITORY_SURFACES,
  useRepositorySurfaceStore,
} from "@/features/repository-workspace/stores/repository-surface-store";
import { BranchList } from "@/features/branches";
import { IconArrowFork, IconGitBranch, IconStack2, IconTag } from "@/shared/components/icons/icons";
import TopToolbar from "../top-toolbar/top-toolbar";
import { StashesPanel } from "@/features/stashes";
import { TagsPanel } from "@/features/tags";
import { WorkspacesPanel } from "@/features/worktrees";
import { ChangesPanel, CommitList } from "@/features/history";
import {
  ChangesExplorer,
  ConflictResolutionSurface,
  CurrentChangesCommitBar,
  useWorkingDirectoryChanges,
} from "@/features/working-changes";
import { InlineDiffSurface } from "@/features/diffs";
import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { RepositoryPullRequestsSurface } from "../repository-pull-requests-surface/repository-pull-requests-surface";

const LEFT_PANE_SECTIONS: ReadonlyArray<{
  key: LeftPaneSection;
  label: string;
  icon: typeof IconStack2;
}> = [
  { key: "changes", label: "Changes", icon: IconStack2 },
  { key: "branches", label: "Branches", icon: IconGitBranch },
  { key: "workspaces", label: "Workspaces", icon: IconArrowFork },
  { key: "tags", label: "Tags", icon: IconTag },
  { key: "stashes", label: "Stashes", icon: IconStack2 },
];

const RepoTabLayout: React.FC = () => {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;
  const selectedCommit = tab?.selectedCommit;
  const workspaceState = useWorkspaceUiStore((s) =>
    repoPath
      ? (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
      : DEFAULT_REPO_WORKSPACE_STATE,
  );
  const surfaceState = useRepositorySurfaceStore((s) =>
    repoPath
      ? (s.repoSurfaceStateByPath[repoPath] ??
        DEFAULT_REPOSITORY_SURFACE_STATE)
      : DEFAULT_REPOSITORY_SURFACE_STATE,
  );
  const setLeftPaneSection = useWorkspaceUiStore((s) => s.setLeftPaneSection);
  const setWorkingChangesViewMode = useWorkspaceUiStore(
    (s) => s.setWorkingChangesViewMode,
  );
  const setMainChangesExpanded = useWorkspaceUiStore(
    (s) => s.setMainChangesExpanded,
  );
  const setRightWorkspaceMode = useWorkspaceUiStore(
    (s) => s.setRightWorkspaceMode,
  );
  const setHistoryMiddleMode = useWorkspaceUiStore((s) => s.setHistoryMiddleMode);
  const setSelectedWorkingDiffPath = useWorkspaceUiStore(
    (s) => s.setSelectedWorkingDiffPath,
  );
  const setSelectedConflictPath = useWorkspaceUiStore(
    (s) => s.setSelectedConflictPath,
  );
  const setSelectedCommitDiffPath = useWorkspaceUiStore(
    (s) => s.setSelectedCommitDiffPath,
  );
  const setSelectedStashRef = useWorkspaceUiStore((s) => s.setSelectedStashRef);
  const setSelectedStashDiffPath = useWorkspaceUiStore(
    (s) => s.setSelectedStashDiffPath,
  );
  const setLeftPaneWidth = useWorkspaceUiStore((s) => s.setLeftPaneWidth);
  const setCommitDetailsWidth = useWorkspaceUiStore(
    (s) => s.setCommitDetailsWidth,
  );
  const setMainWorkspaceScroll = useRepositorySurfaceStore(
    (s) => s.setMainWorkspaceScroll,
  );
  const [mountedPullRequestRepoPaths, setMountedPullRequestRepoPaths] =
    useState<ReadonlySet<string>>(() => new Set());

  // Constant automatic polling, without controls or notifications
  const {
    changes,
    fileDetails,
    loading,
    error,
    hasLoadedOnce,
    refreshChanges,
    loadFileDetail,
  } =
    useWorkingDirectoryChanges(repoPath, {
      pollInterval: 0,
      enabled: !!repoPath,
      pauseOnInactive: false,
      cacheKey: activeTabId ? `changes-${activeTabId}` : undefined,
      showNotifications: false,
    });

  const leftSidebarPaneRef = useRef<HTMLDivElement | null>(null);
  const commitDetailsPaneRef = useRef<HTMLDivElement | null>(null);
  const lastCommitDetailsPaneWidthRef = useRef<number | string>(
    workspaceState.commitDetailsWidth ?? REPO_LAYOUT.panes.right.initial,
  );

  // Reset inline diff modes when branch changes.
  useEffect(() => {
    if (!repoPath) return;
    setSelectedWorkingDiffPath(repoPath, null);
    setSelectedConflictPath(repoPath, null);
    setSelectedCommitDiffPath(repoPath, null);
    setSelectedStashDiffPath(repoPath, null);
    setRightWorkspaceMode(repoPath, "history");
    setHistoryMiddleMode(repoPath, "commit-list");
  }, [tab?.selectedBranch]);

  const selectedWorkingFilePath = workspaceState.selectedWorkingDiffPath;
  const selectedConflictPath = workspaceState.selectedConflictPath;
  const conflictFiles = changes.filter(
    (file) => file.status === ChangeType.Conflicted,
  );
  const selectedWorkingFile =
    selectedWorkingFilePath === null
      ? null
      : (changes.find((f) => f.path === selectedWorkingFilePath) ?? null);
  const selectedConflictFile =
    selectedConflictPath === null
      ? null
      : (conflictFiles.find((f) => f.path === selectedConflictPath) ?? null);
  const selectedConflictFileSignature =
    selectedConflictFile && "fileSignature" in selectedConflictFile
      ? selectedConflictFile.fileSignature
      : null;
  const selectedWorkingFileDetail =
    selectedWorkingFilePath === null
      ? undefined
      : fileDetails[selectedWorkingFilePath];

  // Clear inline working diff when selected file disappears from live changes.
  useEffect(() => {
    if (
      !repoPath ||
      !selectedWorkingFilePath ||
      workspaceState.rightWorkspaceMode !== "working-diff"
    ) {
      return;
    }

    const updated = changes.find((f) => f.path === selectedWorkingFilePath);
    if (!updated) {
      setSelectedWorkingDiffPath(repoPath, null);
      setRightWorkspaceMode(repoPath, "history");
      useFileHunksStore.getState().clearFileHunks();
    }
  }, [
    changes,
    repoPath,
    selectedWorkingFilePath,
    workspaceState.rightWorkspaceMode,
    setRightWorkspaceMode,
    setSelectedWorkingDiffPath,
  ]);

  useEffect(() => {
    if (
      !repoPath ||
      !selectedConflictPath ||
      workspaceState.rightWorkspaceMode !== "conflict-resolution"
    ) {
      return;
    }

    const updated = conflictFiles.find((file) => file.path === selectedConflictPath);
    if (updated) return;

    const nextConflict = conflictFiles[0] ?? null;
    if (nextConflict) {
      setSelectedConflictPath(repoPath, nextConflict.path);
      return;
    }

    setSelectedConflictPath(repoPath, null);
    setRightWorkspaceMode(repoPath, "history");
  }, [
    conflictFiles,
    repoPath,
    selectedConflictPath,
    setRightWorkspaceMode,
    setSelectedConflictPath,
    workspaceState.rightWorkspaceMode,
  ]);

  // Rebind hunks to the fresh file entry whenever the selected path still
  // exists in the live working changes list.
  useEffect(() => {
    if (workspaceState.rightWorkspaceMode !== "working-diff") return;
    if (!selectedWorkingFile) return;
    const detail = fileDetails[selectedWorkingFile.path];
    if (detail?.status === "ready") {
      useFileHunksStore
        .getState()
        .setFileHunks(selectedWorkingFile.path, detail.detail.file.hunks);
      return;
    }

    if (detail?.status === "loading" || detail?.status === "error") {
      return;
    }

    void loadFileDetail(selectedWorkingFile.path).then((loadedDetail) => {
      if (!loadedDetail) return;
      useFileHunksStore
        .getState()
        .setFileHunks(selectedWorkingFile.path, loadedDetail.file.hunks);
    });
  }, [
    fileDetails,
    loadFileDetail,
    selectedWorkingFile,
    workspaceState.rightWorkspaceMode,
  ]);

  // Handler to open the diff for a working directory file
  const handleSelectWorkingFile = (file: ChangesExplorerFile) => {
    if (!repoPath) return;

    if (file.status === ChangeType.Conflicted) {
      setSelectedConflictPath(repoPath, file.path);
      setRightWorkspaceMode(repoPath, "conflict-resolution");
      return;
    }

    setSelectedWorkingDiffPath(repoPath, file.path);
    setSelectedConflictPath(repoPath, null);
    setRightWorkspaceMode(repoPath, "working-diff");

    const detail = fileDetails[file.path];
    if (detail?.status === "ready") {
      useFileHunksStore
        .getState()
        .setFileHunks(file.path, detail.detail.file.hunks);
      return;
    }

    useFileHunksStore.getState().clearFileHunks();
  };

  const handleCloseWorkingDiff = () => {
    if (!repoPath) return;
    setRightWorkspaceMode(repoPath, "history");
    setSelectedWorkingDiffPath(repoPath, null);
    useFileHunksStore.getState().clearFileHunks();
  };

  const handleSelectConflictPath = (filePath: string) => {
    if (!repoPath) return;
    setSelectedConflictPath(repoPath, filePath);
    setRightWorkspaceMode(repoPath, "conflict-resolution");
  };

  const handleCloseConflictResolution = () => {
    if (!repoPath) return;
    setRightWorkspaceMode(repoPath, "history");
    setSelectedConflictPath(repoPath, null);
  };

  const handleOpenStashDiff = (stashRef: string, filePath: string) => {
    if (!repoPath) return;
    setSelectedStashRef(repoPath, stashRef);
    setSelectedStashDiffPath(repoPath, filePath);
    setSelectedConflictPath(repoPath, null);
    setRightWorkspaceMode(repoPath, "stash-diff");
  };

  const handleCloseStashDiff = () => {
    if (!repoPath) return;
    setRightWorkspaceMode(repoPath, "history");
    setSelectedStashDiffPath(repoPath, null);
  };

  const handleOpenCommitDiff = (filePath: string) => {
    if (!repoPath) return;
    setSelectedCommitDiffPath(repoPath, filePath);
    setHistoryMiddleMode(repoPath, "commit-diff");
  };

  const handleCloseCommitDiff = () => {
    if (!repoPath) return;
    setHistoryMiddleMode(repoPath, "commit-list");
    setSelectedCommitDiffPath(repoPath, null);
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
    const handleWorkingChangesRefresh = () => {
      void refreshChanges();
    };

    window.addEventListener(APP_EVENTS.workingChangesRefresh, handleWorkingChangesRefresh);
    return () =>
      window.removeEventListener(
        APP_EVENTS.workingChangesRefresh,
        handleWorkingChangesRefresh,
    );
  }, [refreshChanges]);

  useEffect(() => {
    if (!repoPath) return;

    if (surfaceState.activeSurface === REPOSITORY_SURFACES.pullRequests) {
      setMountedPullRequestRepoPaths((repoPaths) => {
        if (repoPaths.has(repoPath)) return repoPaths;

        return new Set(repoPaths).add(repoPath);
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMountedPullRequestRepoPaths((repoPaths) => {
        if (repoPaths.has(repoPath)) return repoPaths;

        return new Set(repoPaths).add(repoPath);
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [repoPath, surfaceState.activeSurface]);

  useEffect(() => {
    if (workspaceState.rightWorkspaceMode === "working-diff") return;

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
    workspaceState.rightWorkspaceMode,
    workspaceState.commitDetailsWidth,
  ]);

  if (!tab) return null;

  const isPullRequestsSurfaceActive =
    repoPath !== undefined &&
    surfaceState.activeSurface === REPOSITORY_SURFACES.pullRequests;
  const shouldMountPullRequestsSurface =
    repoPath !== undefined &&
    (isPullRequestsSurfaceActive || mountedPullRequestRepoPaths.has(repoPath));

  return (
    <div className="flex h-full w-full flex-col">
      <TopToolbar />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {repoPath && shouldMountPullRequestsSurface ? (
          <div
            className={classNames(
              "absolute inset-0 min-h-0",
              isPullRequestsSurfaceActive ? "block" : "hidden",
            )}
          >
            <RepositoryPullRequestsSurface repoPath={repoPath} />
          </div>
        ) : null}
        <div
          className={classNames(
            "absolute inset-0 min-h-0",
            isPullRequestsSurfaceActive ? "hidden" : "block",
          )}
        >
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
              className="!h-full !min-h-0 flex flex-col border-r border-border bg-background"
            >
              <Tabs
                inverted
                keepMounted={false}
                value={workspaceState.leftPaneSection}
                onChange={(value) => {
                  if (!repoPath || !value) return;
                  setLeftPaneSection(repoPath, value as LeftPaneSection);
                }}
                variant="none"
                className="flex min-h-0 w-full flex-1 flex-col"
              >
                <Tabs.Panel
                  value="changes"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <div className="flex min-h-0 flex-1 flex-col">
                    {error ? (
                      <div className="p-4 text-center text-red-500">
                        Error: {error}
                      </div>
                    ) : null}
                    {!error ? (
                      <ChangesExplorer
                        className="min-w-0 border-r-0"
                        files={changes}
                        selectedPath={
                          workspaceState.rightWorkspaceMode ===
                          "conflict-resolution"
                            ? (selectedConflictFile?.path ??
                              selectedConflictPath)
                            : (selectedWorkingFile?.path ?? null)
                        }
                        onSelectFile={(file) =>
                          handleSelectWorkingFile(file)
                        }
                        viewMode={workspaceState.workingChangesViewMode}
                        onViewModeChange={(mode) => {
                          if (!repoPath) return;
                          setWorkingChangesViewMode(repoPath, mode);
                        }}
                        showFileCheckboxes={true}
                        surface="main"
                        showHeader={true}
                        repoPath={repoPath}
                        onImmediateStageChange={refreshChanges}
                        expandedState={workspaceState.mainChangesExpanded}
                        onExpandedStateChange={(expanded) => {
                          if (!repoPath) return;
                          setMainChangesExpanded(repoPath, expanded);
                        }}
                        scrollTop={surfaceState.mainWorkspaceScroll.changes ?? 0}
                        onScrollTopChange={(scrollTop) => {
                          if (!repoPath) return;
                          setMainWorkspaceScroll(repoPath, "changes", scrollTop);
                        }}
                        alignCountColumnWithHeaderActions
                        isLoading={loading && changes.length === 0}
                        emptyStateMessage={
                          hasLoadedOnce ? "There are no current changes" : ""
                        }
                      />
                    ) : null}
                  </div>
                  {repoPath ? (
                    <CurrentChangesCommitBar
                      repoPath={repoPath}
                      onCommitted={() => {
                        void refreshChanges();
                      }}
                    />
                  ) : null}
                </Tabs.Panel>
                <Tabs.Panel
                  value="branches"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <BranchList />
                </Tabs.Panel>
                <Tabs.Panel
                  value="workspaces"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  {repoPath ? <WorkspacesPanel repoPath={repoPath} /> : null}
                </Tabs.Panel>
                <Tabs.Panel
                  value="stashes"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  {repoPath ? (
                    <StashesPanel
                      repoPath={repoPath}
                      selectedStashRef={workspaceState.selectedStashRef}
                      selectedStashDiffPath={workspaceState.selectedStashDiffPath}
                      onSelectStashRef={(stashRef) => setSelectedStashRef(repoPath, stashRef)}
                      onSelectStashDiffPath={(stashPath) =>
                        setSelectedStashDiffPath(repoPath, stashPath)
                      }
                      onOpenStashDiff={handleOpenStashDiff}
                    />
                  ) : null}
                </Tabs.Panel>
                <Tabs.Panel
                  value="tags"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  {repoPath ? <TagsPanel repoPath={repoPath} /> : null}
                </Tabs.Panel>
                <Tabs.List className="grid h-10 min-h-10 grid-cols-5 border-t border-border bg-background-emphasis">
                  {LEFT_PANE_SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const isActive =
                      workspaceState.leftPaneSection === section.key;
                    const label =
                      section.key === "changes"
                        ? `Changes (${changes.length})`
                        : section.label;

                    return (
                      <Tooltip
                        key={section.key}
                        label={label}
                        openDelay={2000}
                        position="top"
                      >
                        <Tabs.Tab
                          value={section.key}
                          className={classNames(
                            "!rounded-none !border-0 border-r border-border/70 last:border-r-0",
                            "flex h-full items-center justify-center px-0",
                          )}
                          classNames={{
                            tab: classNames(
                              "transition-colors",
                              isActive
                                ? "!bg-background text-foreground"
                                : "text-zinc-500 hover:!bg-background hover:text-zinc-100",
                            ),
                            tabLabel: "inline-flex items-center justify-center",
                          }}
                          aria-label={label}
                        >
                          <span className="inline-flex items-center justify-center">
                            <Icon size={16} />
                          </span>
                        </Tabs.Tab>
                      </Tooltip>
                    );
                  })}
                </Tabs.List>
              </Tabs>
            </Split.Pane>
            <Split.Resizer className="!bg-transparent hover:!bg-foreground [--split-resizer-size:1px] !-ml-[1px] !rounded-none" />
            {/* Right panel: changes based on the selection */}
            <Split.Pane grow className="!h-full !min-h-0">
              {workspaceState.rightWorkspaceMode === "conflict-resolution" &&
              selectedConflictFile &&
              repoPath ? (
                <ConflictResolutionSurface
                  repoPath={repoPath}
                  filePath={selectedConflictFile.path}
                  fileSignature={selectedConflictFileSignature}
                  conflicts={conflictFiles}
                  onSelectConflictPath={handleSelectConflictPath}
                  onClose={handleCloseConflictResolution}
                  onResolved={() => {
                    void refreshChanges();
                    handleCloseConflictResolution();
                  }}
                />
              ) : workspaceState.rightWorkspaceMode === "working-diff" &&
              selectedWorkingFile &&
              repoPath ? (
                <InlineDiffSurface
                  repoPath={repoPath}
                  filePath={selectedWorkingFile.path}
                  title={selectedWorkingFile.path}
                  onClose={handleCloseWorkingDiff}
                  onWorkingTreeStageChange={refreshChanges}
                  loading={selectedWorkingFileDetail?.status === "loading"}
                  error={
                    selectedWorkingFileDetail?.status === "error"
                      ? selectedWorkingFileDetail.error
                      : null
                  }
                />
              ) : workspaceState.rightWorkspaceMode === "stash-diff" &&
                repoPath &&
                workspaceState.selectedStashRef &&
                workspaceState.selectedStashDiffPath ? (
                <InlineDiffSurface
                  repoPath={repoPath}
                  filePath={workspaceState.selectedStashDiffPath}
                  sha={workspaceState.selectedStashRef}
                  diffSource="stash"
                  title={workspaceState.selectedStashDiffPath}
                  onClose={handleCloseStashDiff}
                />
              ) : (
                <Split orientation="vertical" className="h-full w-full">
                  <Split.Pane
                    grow
                    initialWidth={REPO_LAYOUT.panes.middle.initial}
                    minWidth={REPO_LAYOUT.panes.middle.min}
                  >
                    {workspaceState.historyMiddleMode === "commit-diff" &&
                    repoPath &&
                    selectedCommit &&
                    workspaceState.selectedCommitDiffPath ? (
                      <InlineDiffSurface
                        repoPath={repoPath}
                        filePath={workspaceState.selectedCommitDiffPath}
                        sha={selectedCommit.sha}
                        title={workspaceState.selectedCommitDiffPath}
                        onClose={handleCloseCommitDiff}
                      />
                    ) : (
                      <CommitList
                        scrollTop={
                          surfaceState.mainWorkspaceScroll.commitList ?? 0
                        }
                        onScrollTopChange={(scrollTop) => {
                          if (!repoPath) return;
                          setMainWorkspaceScroll(
                            repoPath,
                            "commitList",
                            scrollTop,
                          );
                        }}
                      />
                    )}
                  </Split.Pane>
                  <Split.Resizer
                    className={
                      (selectedCommit
                        ? "!bg-transparent hover:!bg-primary [--split-resizer-size:1px]"
                        : "hidden") + " "
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
                    className={
                      (selectedCommit
                        ? "overflow-hidden"
                        : "hidden overflow-hidden") +
                      " border-l border-border -ml-[4px]"
                    }
                  >
                    {selectedCommit ? (
                      <ChangesPanel
                        selectedCommitDiffPath={workspaceState.selectedCommitDiffPath}
                        onSelectCommitFile={(file) => handleOpenCommitDiff(file.path)}
                      />
                    ) : null}
                  </Split.Pane>
                </Split>
              )}
            </Split.Pane>
          </Split>
        </div>
      </div>
    </div>
  );
};

export default RepoTabLayout;
