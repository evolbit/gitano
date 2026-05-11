import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { REPO_LAYOUT } from "../constants/layout";
import { tauriStorage } from "./tauriStorage";

export type WorkspaceViewMode = "flat" | "tree";
export type LeftPaneSection = "changes" | "branches" | "folders";
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
  branchTreeExpanded: Record<string, boolean>;
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
  setBranchTreeExpanded: (
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
  branchTreeExpanded: {},
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

  return {
    ...DEFAULT_REPO_WORKSPACE_STATE,
    ...repoState,
    leftPaneSection: repoState.leftPaneSection ?? "changes",
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
      setBranchTreeExpanded: (repoPath, expanded) =>
        get().updateRepoState(repoPath, { branchTreeExpanded: expanded }),
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
