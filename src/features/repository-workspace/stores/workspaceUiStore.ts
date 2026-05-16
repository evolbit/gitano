import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { REPO_LAYOUT } from "@/shared/config/layout";
import { tauriStorage } from "@/shared/platform/tauri/storage";

export type WorkspaceViewMode = "flat" | "tree";
export type LeftPaneSection =
  | "changes"
  | "branches"
  | "workspaces"
  | "tags"
  | "stashes";
export type RightWorkspaceMode = "history" | "working-diff" | "stash-diff";
export type HistoryMiddleMode = "commit-list" | "commit-diff";
export type PullStrategy =
  | "fetch-all"
  | "pull-ff-if-possible"
  | "pull-ff-only"
  | "pull-rebase";

export interface WindowBoundsState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface RepoWorkspaceState {
  leftPaneSection: LeftPaneSection;
  rightWorkspaceMode: RightWorkspaceMode;
  historyMiddleMode: HistoryMiddleMode;
  selectedWorkingDiffPath: string | null;
  selectedCommitDiffPath: string | null;
  selectedStashRef: string | null;
  selectedStashDiffPath: string | null;
  branchTreeExpanded: Record<string, boolean>;
  worktreeTreeExpanded: Record<string, boolean>;
  worktreeCreateBaseRef: string | null;
  tagTreeExpanded: Record<string, boolean>;
  mainChangesExpanded: Record<string, boolean>;
  workingChangesViewMode: WorkspaceViewMode;
  commitChangesViewMode: WorkspaceViewMode;
  leftPaneWidth?: number;
  commitDetailsWidth?: number;
}

interface WorkspaceUiStore {
  window: WindowBoundsState;
  repoStateByPath: Record<string, RepoWorkspaceState>;
  pullStrategy: PullStrategy;
  setWindowBounds: (bounds: Partial<WindowBoundsState>) => void;
  setPullStrategy: (strategy: PullStrategy) => void;
  updateRepoState: (repoPath: string, data: Partial<RepoWorkspaceState>) => void;
  setLeftPaneSection: (repoPath: string, section: LeftPaneSection) => void;
  setRightWorkspaceMode: (repoPath: string, mode: RightWorkspaceMode) => void;
  setHistoryMiddleMode: (repoPath: string, mode: HistoryMiddleMode) => void;
  setSelectedWorkingDiffPath: (repoPath: string, path: string | null) => void;
  setSelectedCommitDiffPath: (repoPath: string, path: string | null) => void;
  setSelectedStashRef: (repoPath: string, stashRef: string | null) => void;
  setSelectedStashDiffPath: (repoPath: string, path: string | null) => void;
  setBranchTreeExpanded: (
    repoPath: string,
    expanded: Record<string, boolean>,
  ) => void;
  setWorktreeTreeExpanded: (
    repoPath: string,
    expanded: Record<string, boolean>,
  ) => void;
  setWorktreeCreateBaseRef: (repoPath: string, baseRef: string | null) => void;
  setTagTreeExpanded: (
    repoPath: string,
    expanded: Record<string, boolean>,
  ) => void;
  setMainChangesExpanded: (
    repoPath: string,
    expanded: Record<string, boolean>,
  ) => void;
  setWorkingChangesViewMode: (
    repoPath: string,
    mode: WorkspaceViewMode,
  ) => void;
  setCommitChangesViewMode: (
    repoPath: string,
    mode: WorkspaceViewMode,
  ) => void;
  setLeftPaneWidth: (repoPath: string, width: number) => void;
  setCommitDetailsWidth: (repoPath: string, width: number) => void;
}

export const DEFAULT_WINDOW_BOUNDS: WindowBoundsState = {
  width: REPO_LAYOUT.window.width,
  height: REPO_LAYOUT.window.height,
};

export const DEFAULT_PULL_STRATEGY: PullStrategy = "pull-ff-if-possible";

export const DEFAULT_REPO_WORKSPACE_STATE: RepoWorkspaceState = {
  leftPaneSection: "changes",
  rightWorkspaceMode: "history",
  historyMiddleMode: "commit-list",
  selectedWorkingDiffPath: null,
  selectedCommitDiffPath: null,
  selectedStashRef: null,
  selectedStashDiffPath: null,
  branchTreeExpanded: {},
  worktreeTreeExpanded: {},
  worktreeCreateBaseRef: null,
  tagTreeExpanded: {},
  mainChangesExpanded: {},
  workingChangesViewMode: "tree",
  commitChangesViewMode: "tree",
  leftPaneWidth:
    typeof REPO_LAYOUT.panes.left.initial === "number"
      ? REPO_LAYOUT.panes.left.initial
      : REPO_LAYOUT.panes.left.min,
  commitDetailsWidth:
    typeof REPO_LAYOUT.panes.right.initial === "number"
      ? REPO_LAYOUT.panes.right.initial
      : REPO_LAYOUT.panes.right.min,
};

function getRepoWorkspaceState(
  repoStateByPath: Record<string, RepoWorkspaceState>,
  repoPath: string,
) {
  const repoState = repoStateByPath[repoPath];

  if (!repoState) {
    return DEFAULT_REPO_WORKSPACE_STATE;
  }

  const legacyLeftPaneSection = (repoState as { leftPaneSection?: string })
    .leftPaneSection;

  return {
    ...DEFAULT_REPO_WORKSPACE_STATE,
    ...repoState,
    leftPaneSection:
      legacyLeftPaneSection === "folders"
        ? "stashes"
        : (repoState.leftPaneSection ?? "changes"),
    rightWorkspaceMode: repoState.rightWorkspaceMode ?? "history",
    historyMiddleMode: repoState.historyMiddleMode ?? "commit-list",
    selectedWorkingDiffPath: repoState.selectedWorkingDiffPath ?? null,
    selectedCommitDiffPath: repoState.selectedCommitDiffPath ?? null,
    selectedStashRef: repoState.selectedStashRef ?? null,
    selectedStashDiffPath: repoState.selectedStashDiffPath ?? null,
    worktreeTreeExpanded: repoState.worktreeTreeExpanded ?? {},
    worktreeCreateBaseRef: repoState.worktreeCreateBaseRef ?? null,
    tagTreeExpanded: repoState.tagTreeExpanded ?? {},
  };
}

export const useWorkspaceUiStore = create<WorkspaceUiStore>()(
  persist(
    (set, get) => ({
      window: DEFAULT_WINDOW_BOUNDS,
      pullStrategy: DEFAULT_PULL_STRATEGY,
      repoStateByPath: {},
      setWindowBounds: (bounds) =>
        set((state) => ({
          window: { ...state.window, ...bounds },
        })),
      setPullStrategy: (strategy) => set({ pullStrategy: strategy }),
      updateRepoState: (repoPath, data) =>
        set((state) => ({
          repoStateByPath: {
            ...state.repoStateByPath,
            [repoPath]: {
              ...getRepoWorkspaceState(state.repoStateByPath, repoPath),
              ...data,
            },
          },
        })),
      setLeftPaneSection: (repoPath, section) =>
        get().updateRepoState(repoPath, { leftPaneSection: section }),
      setRightWorkspaceMode: (repoPath, mode) =>
        get().updateRepoState(repoPath, { rightWorkspaceMode: mode }),
      setHistoryMiddleMode: (repoPath, mode) =>
        get().updateRepoState(repoPath, { historyMiddleMode: mode }),
      setSelectedWorkingDiffPath: (repoPath, path) =>
        get().updateRepoState(repoPath, { selectedWorkingDiffPath: path }),
      setSelectedCommitDiffPath: (repoPath, path) =>
        get().updateRepoState(repoPath, { selectedCommitDiffPath: path }),
      setSelectedStashRef: (repoPath, stashRef) =>
        get().updateRepoState(repoPath, { selectedStashRef: stashRef }),
      setSelectedStashDiffPath: (repoPath, path) =>
        get().updateRepoState(repoPath, { selectedStashDiffPath: path }),
      setBranchTreeExpanded: (repoPath, expanded) =>
        get().updateRepoState(repoPath, { branchTreeExpanded: expanded }),
      setWorktreeTreeExpanded: (repoPath, expanded) =>
        get().updateRepoState(repoPath, { worktreeTreeExpanded: expanded }),
      setWorktreeCreateBaseRef: (repoPath, baseRef) =>
        get().updateRepoState(repoPath, { worktreeCreateBaseRef: baseRef }),
      setTagTreeExpanded: (repoPath, expanded) =>
        get().updateRepoState(repoPath, { tagTreeExpanded: expanded }),
      setMainChangesExpanded: (repoPath, expanded) =>
        get().updateRepoState(repoPath, { mainChangesExpanded: expanded }),
      setWorkingChangesViewMode: (repoPath, mode) =>
        get().updateRepoState(repoPath, { workingChangesViewMode: mode }),
      setCommitChangesViewMode: (repoPath, mode) =>
        get().updateRepoState(repoPath, { commitChangesViewMode: mode }),
      setLeftPaneWidth: (repoPath, width) =>
        get().updateRepoState(repoPath, { leftPaneWidth: width }),
      setCommitDetailsWidth: (repoPath, width) =>
        get().updateRepoState(repoPath, { commitDetailsWidth: width }),
    }),
    {
      name: "workspace-ui-storage",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        window: state.window,
        pullStrategy: state.pullStrategy,
        repoStateByPath: state.repoStateByPath,
      }),
      skipHydration: true,
    },
  ),
);

export async function rehydrateWorkspaceUiStore() {
  await useWorkspaceUiStore.persist.rehydrate();
}

