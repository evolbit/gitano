import { create } from "zustand";
import type { WorkspaceViewMode } from "./workspace-ui-store";

export const REPOSITORY_SURFACES = {
  workspace: "workspace",
  pullRequests: "pull-requests",
} as const;
export type RepositorySurface =
  (typeof REPOSITORY_SURFACES)[keyof typeof REPOSITORY_SURFACES];

export const PULL_REQUESTS_SURFACE_MODES = {
  list: "list",
  review: "review",
} as const;
export type PullRequestsSurfaceMode =
  (typeof PULL_REQUESTS_SURFACE_MODES)[keyof typeof PULL_REQUESTS_SURFACE_MODES];

export const PULL_REQUEST_REVIEW_DISPLAY_MODES = {
  unified: "unified",
  split: "split",
} as const;
export type PullRequestReviewDisplayMode =
  (typeof PULL_REQUEST_REVIEW_DISPLAY_MODES)[keyof typeof PULL_REQUEST_REVIEW_DISPLAY_MODES];

export interface PullRequestReviewUiState {
  selectedPath: string | null;
  displayMode: PullRequestReviewDisplayMode;
  viewMode: WorkspaceViewMode;
  historyOpen: boolean;
  conversationCommentBody: string;
  scroll: Record<string, number>;
}

export interface PullRequestReviewContextState {
  number: number;
  title: string;
  baseRef: string;
  headRef: string;
  baseLabel: string;
  headLabel: string;
}

export interface RepositorySurfaceState {
  activeSurface: RepositorySurface;
  pullRequestsSurfaceMode: PullRequestsSurfaceMode;
  activePullRequestNumber: number | null;
  mainWorkspaceScroll: Record<string, number>;
  pullRequestListScrollTop: number;
  pullRequestReviewContextByNumber: Record<
    number,
    PullRequestReviewContextState
  >;
  pullRequestReviewByNumber: Record<number, PullRequestReviewUiState>;
}

interface RepositorySurfaceStore {
  repoSurfaceStateByPath: Record<string, RepositorySurfaceState>;
  setRepositorySurface: (repoPath: string, surface: RepositorySurface) => void;
  showWorkspaceSurface: (repoPath: string) => void;
  showPullRequestsSurface: (repoPath: string) => void;
  showPullRequestList: (repoPath: string) => void;
  showPullRequestReview: (
    repoPath: string,
    pullRequestNumber: number,
    context?: PullRequestReviewContextState,
  ) => void;
  updatePullRequestReviewState: (
    repoPath: string,
    pullRequestNumber: number,
    data: Partial<PullRequestReviewUiState>,
  ) => void;
  setMainWorkspaceScroll: (
    repoPath: string,
    scrollKey: string,
    scrollTop: number,
  ) => void;
  setPullRequestListScrollTop: (repoPath: string, scrollTop: number) => void;
}

export const DEFAULT_PULL_REQUEST_REVIEW_UI_STATE: PullRequestReviewUiState = {
  selectedPath: null,
  displayMode: PULL_REQUEST_REVIEW_DISPLAY_MODES.unified,
  viewMode: "tree",
  historyOpen: false,
  conversationCommentBody: "",
  scroll: {},
};

export const DEFAULT_REPOSITORY_SURFACE_STATE: RepositorySurfaceState = {
  activeSurface: REPOSITORY_SURFACES.workspace,
  pullRequestsSurfaceMode: PULL_REQUESTS_SURFACE_MODES.list,
  activePullRequestNumber: null,
  mainWorkspaceScroll: {},
  pullRequestListScrollTop: 0,
  pullRequestReviewContextByNumber: {},
  pullRequestReviewByNumber: {},
};

function getRepositorySurfaceState(
  repoSurfaceStateByPath: Record<string, RepositorySurfaceState>,
  repoPath: string,
) {
  const repoState = repoSurfaceStateByPath[repoPath];

  if (!repoState) {
    return DEFAULT_REPOSITORY_SURFACE_STATE;
  }

  return {
    ...DEFAULT_REPOSITORY_SURFACE_STATE,
    ...repoState,
    mainWorkspaceScroll: repoState.mainWorkspaceScroll ?? {},
    pullRequestListScrollTop: repoState.pullRequestListScrollTop ?? 0,
    pullRequestReviewContextByNumber:
      repoState.pullRequestReviewContextByNumber ?? {},
    pullRequestReviewByNumber: Object.fromEntries(
      Object.entries(repoState.pullRequestReviewByNumber ?? {}).map(
        ([number, reviewState]) => [
          number,
          {
            ...DEFAULT_PULL_REQUEST_REVIEW_UI_STATE,
            ...reviewState,
            scroll: reviewState.scroll ?? {},
          },
        ],
      ),
    ),
  };
}

function getPullRequestReviewUiState(
  repoState: RepositorySurfaceState,
  pullRequestNumber: number,
) {
  return {
    ...DEFAULT_PULL_REQUEST_REVIEW_UI_STATE,
    ...(repoState.pullRequestReviewByNumber[pullRequestNumber] ?? {}),
  };
}

export const useRepositorySurfaceStore = create<RepositorySurfaceStore>()(
  (set) => ({
    repoSurfaceStateByPath: {},
    setRepositorySurface: (repoPath, surface) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              activeSurface: surface,
            },
          },
        };
      }),
    showWorkspaceSurface: (repoPath) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              activeSurface: REPOSITORY_SURFACES.workspace,
            },
          },
        };
      }),
    showPullRequestsSurface: (repoPath) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              activeSurface: REPOSITORY_SURFACES.pullRequests,
            },
          },
        };
      }),
    showPullRequestList: (repoPath) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              activeSurface: REPOSITORY_SURFACES.pullRequests,
              pullRequestsSurfaceMode: PULL_REQUESTS_SURFACE_MODES.list,
              activePullRequestNumber: null,
            },
          },
        };
      }),
    showPullRequestReview: (repoPath, pullRequestNumber, context) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              activeSurface: REPOSITORY_SURFACES.pullRequests,
              pullRequestsSurfaceMode: PULL_REQUESTS_SURFACE_MODES.review,
              activePullRequestNumber: pullRequestNumber,
              pullRequestReviewByNumber: {
                ...repoState.pullRequestReviewByNumber,
                [pullRequestNumber]: getPullRequestReviewUiState(
                  repoState,
                  pullRequestNumber,
                ),
              },
              pullRequestReviewContextByNumber: {
                ...repoState.pullRequestReviewContextByNumber,
                ...(context ? { [pullRequestNumber]: context } : {}),
              },
            },
          },
        };
      }),
    updatePullRequestReviewState: (repoPath, pullRequestNumber, data) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );
        const currentReviewState = getPullRequestReviewUiState(
          repoState,
          pullRequestNumber,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              pullRequestReviewByNumber: {
                ...repoState.pullRequestReviewByNumber,
                [pullRequestNumber]: {
                  ...currentReviewState,
                  ...data,
                  scroll: {
                    ...currentReviewState.scroll,
                    ...(data.scroll ?? {}),
                  },
                },
              },
            },
          },
        };
      }),
    setMainWorkspaceScroll: (repoPath, scrollKey, scrollTop) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              mainWorkspaceScroll: {
                ...repoState.mainWorkspaceScroll,
                [scrollKey]: scrollTop,
              },
            },
          },
        };
      }),
    setPullRequestListScrollTop: (repoPath, scrollTop) =>
      set((state) => {
        const repoState = getRepositorySurfaceState(
          state.repoSurfaceStateByPath,
          repoPath,
        );

        return {
          repoSurfaceStateByPath: {
            ...state.repoSurfaceStateByPath,
            [repoPath]: {
              ...repoState,
              pullRequestListScrollTop: scrollTop,
            },
          },
        };
      }),
  }),
);
