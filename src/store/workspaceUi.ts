import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { REPO_LAYOUT } from "../constants/layout";
import { tauriStorage } from "./tauriStorage";

export type WorkspaceViewMode = "flat" | "tree";

export interface WindowBoundsState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface RepoWorkspaceState {
  leftAccordionOpen: string[];
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
  setWindowBounds: (bounds: Partial<WindowBoundsState>) => void;
  updateRepoState: (repoPath: string, data: Partial<RepoWorkspaceState>) => void;
  setLeftAccordionOpen: (repoPath: string, value: string[]) => void;
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

export const DEFAULT_REPO_WORKSPACE_STATE: RepoWorkspaceState = {
  leftAccordionOpen: ["changes"],
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
  return repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE;
}

export const useWorkspaceUiStore = create<WorkspaceUiStore>()(
  persist(
    (set, get) => ({
      window: DEFAULT_WINDOW_BOUNDS,
      repoStateByPath: {},
      setWindowBounds: (bounds) =>
        set((state) => ({
          window: { ...state.window, ...bounds },
        })),
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
      setLeftAccordionOpen: (repoPath, value) =>
        get().updateRepoState(repoPath, { leftAccordionOpen: value }),
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
        repoStateByPath: state.repoStateByPath,
      }),
      skipHydration: true,
    },
  ),
);

export async function rehydrateWorkspaceUiStore() {
  await useWorkspaceUiStore.persist.rehydrate();
}
