import { useEffect } from "react";
import { PrReview } from "@/features/branches";
import {
  PullRequestListSurface,
  type PullRequestReviewTarget,
} from "@/features/pull-requests";
import {
  DEFAULT_PULL_REQUEST_REVIEW_UI_STATE,
  DEFAULT_REPOSITORY_SURFACE_STATE,
  PULL_REQUESTS_SURFACE_MODES,
  useRepositorySurfaceStore,
  type PullRequestReviewContextState,
} from "../../stores/repository-surface-store";

type RepositoryPullRequestsSurfaceProps = {
  repoPath: string;
};

function reviewTargetToContext(
  review: PullRequestReviewTarget,
): PullRequestReviewContextState {
  return {
    number: review.number,
    title: review.title,
    baseRef: review.baseRef,
    headRef: review.headRef,
    baseLabel: review.baseLabel,
    headLabel: review.headLabel,
  };
}

export function RepositoryPullRequestsSurface({
  repoPath,
}: RepositoryPullRequestsSurfaceProps) {
  const surfaceState = useRepositorySurfaceStore(
    (state) =>
      state.repoSurfaceStateByPath[repoPath] ?? DEFAULT_REPOSITORY_SURFACE_STATE,
  );
  const showPullRequestList = useRepositorySurfaceStore(
    (state) => state.showPullRequestList,
  );
  const showPullRequestReview = useRepositorySurfaceStore(
    (state) => state.showPullRequestReview,
  );
  const showWorkspaceSurface = useRepositorySurfaceStore(
    (state) => state.showWorkspaceSurface,
  );
  const setPullRequestListScrollTop = useRepositorySurfaceStore(
    (state) => state.setPullRequestListScrollTop,
  );
  const updatePullRequestReviewState = useRepositorySurfaceStore(
    (state) => state.updatePullRequestReviewState,
  );
  const activePullRequestNumber = surfaceState.activePullRequestNumber;
  const activeReviewContext =
    activePullRequestNumber === null
      ? null
      : (surfaceState.pullRequestReviewContextByNumber[
          activePullRequestNumber
        ] ?? null);

  useEffect(() => {
    if (
      surfaceState.pullRequestsSurfaceMode ===
        PULL_REQUESTS_SURFACE_MODES.review &&
      !activeReviewContext
    ) {
      showPullRequestList(repoPath);
    }
  }, [
    activeReviewContext,
    repoPath,
    showPullRequestList,
    surfaceState.pullRequestsSurfaceMode,
  ]);

  if (
    surfaceState.pullRequestsSurfaceMode === PULL_REQUESTS_SURFACE_MODES.review &&
    activeReviewContext
  ) {
    const reviewState =
      surfaceState.pullRequestReviewByNumber[activeReviewContext.number] ??
      DEFAULT_PULL_REQUEST_REVIEW_UI_STATE;

    return (
      <PrReview
        repoPath={repoPath}
        pullRequestContext={activeReviewContext}
        onBackToList={() => showPullRequestList(repoPath)}
        onClose={() => showWorkspaceSurface(repoPath)}
        uiState={reviewState}
        onUiStateChange={(nextState) =>
          updatePullRequestReviewState(
            repoPath,
            activeReviewContext.number,
            nextState,
          )
        }
      />
    );
  }

  return (
    <PullRequestListSurface
      repoPath={repoPath}
      scrollTop={surfaceState.pullRequestListScrollTop}
      onScrollTopChange={(scrollTop) =>
        setPullRequestListScrollTop(repoPath, scrollTop)
      }
      onReviewPullRequest={(review) =>
        showPullRequestReview(
          repoPath,
          review.number,
          reviewTargetToContext(review),
        )
      }
    />
  );
}
