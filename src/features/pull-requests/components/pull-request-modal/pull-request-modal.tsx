import ReactDOM from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconCheck,
  IconSearch,
  IconX,
} from "@/shared/components/icons/icons";
import {
  listProviderIntegrations,
  mergeProviderPullRequest,
  submitProviderPullRequestReview,
  prepareProviderPullRequestRefs,
  type PullRequestListItem,
} from "@/shared/api/integrations";
import { usePullRequestMergeMethods } from "@/shared/hooks/use-pull-request-merge-methods";
import { usePullRequests } from "../../hooks/use-pull-requests";
import { PullRequestRow } from "./pull-request-row";
import { ReviewDecisionModal } from "./review-decision-modal";
import type {
  PullRequestReviewTarget,
  ReviewDecision,
  ReviewDecisionPayload,
} from "./types";

export type { PullRequestReviewTarget } from "./types";

type PullRequestModalProps = {
  open: boolean;
  repoPath: string | null | undefined;
  onClose: () => void;
  onReviewPullRequest?: (review: PullRequestReviewTarget) => void;
};

type PullRequestListSurfaceProps = {
  repoPath: string | null | undefined;
  onReviewPullRequest?: (review: PullRequestReviewTarget) => void;
  onClose?: () => void;
  onScrollTopChange?: (scrollTop: number) => void;
  scrollTop?: number;
  showCloseButton?: boolean;
};

function sameGitHubUser(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export function PullRequestListSurface({
  repoPath,
  onClose,
  onReviewPullRequest,
  onScrollTopChange,
  scrollTop = 0,
  showCloseButton = false,
}: PullRequestListSurfaceProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { availability, error, loading, pullRequests, refresh, refreshing } =
    usePullRequests({ open: true, repoPath });
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [preparingReviewNumber, setPreparingReviewNumber] = useState<
    number | null
  >(null);
  const providerIntegrationsQuery = useQuery({
    queryKey: ["provider-integrations"],
    queryFn: listProviderIntegrations,
    enabled: true,
    staleTime: 30_000,
  });
  const currentGitHubLogin = useMemo(() => {
    const githubProvider = providerIntegrationsQuery.data?.find(
      (provider) => provider.id === "github",
    );
    return githubProvider?.connection?.accountLogin ?? null;
  }, [providerIntegrationsQuery.data]);
  const sortedPullRequests = useMemo(
    () =>
      [...pullRequests].sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [pullRequests],
  );
  const {
    mergeMethods: availableMergeMethods,
    mergeOptionsError,
    mergeOptionsLoading,
    selectedMergeMethod,
    setSelectedMergeMethod,
  } = usePullRequestMergeMethods({
    enabled: availability === "ready",
    repoPath,
  });

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollTop;
  }, [scrollTop, availability, loading, sortedPullRequests.length]);

  const handleSubmitDecision = async (payload: ReviewDecisionPayload) => {
    if (!decision || !repoPath) return;

    setSubmitting(true);
    setSubmissionError(null);
    try {
      if (decision.event === "MERGE") {
        await mergeProviderPullRequest({
          providerId: "github",
          path: repoPath,
          number: decision.pullRequest.number,
          mergeMethod: decision.mergeMethod ?? selectedMergeMethod,
          title: payload.title,
          body: payload.body,
        });
      } else {
        await submitProviderPullRequestReview({
          providerId: "github",
          path: repoPath,
          number: decision.pullRequest.number,
          event: decision.event,
          body: payload.body,
          comments: [],
        });
      }
      setDecision(null);
      setReviewNotice(
        decision.event === "MERGE"
          ? `Merged #${decision.pullRequest.number}.`
          : `Requested changes on #${decision.pullRequest.number}.`,
      );
      await refresh();
    } catch (submitError) {
      setSubmissionError(
        submitError instanceof Error ? submitError.message : String(submitError),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewPullRequest = async (
    pullRequest: PullRequestListItem,
  ) => {
    if (!repoPath) return;

    setPreparingReviewNumber(pullRequest.number);
    setSubmissionError(null);
    try {
      const refs = await prepareProviderPullRequestRefs({
        providerId: "github",
        path: repoPath,
        number: pullRequest.number,
        baseRef: pullRequest.base.refName,
      });
      onReviewPullRequest?.({
        pullRequest,
        number: pullRequest.number,
        title: pullRequest.title,
        baseRef: refs.baseRef,
        headRef: refs.headRef,
        baseLabel: pullRequest.base.label,
        headLabel: pullRequest.head.label,
      });
    } catch (prepareError) {
      setSubmissionError(
        prepareError instanceof Error
          ? prepareError.message
          : String(prepareError),
      );
    } finally {
      setPreparingReviewNumber(null);
    }
  };

  const renderBody = () => {
    if (!repoPath) {
      return (
        <div className="rounded border border-border bg-background-emphasis px-4 py-3 text-sm text-zinc-300">
          Open a repository to view pull requests.
        </div>
      );
    }

    if (availability === "disconnected") {
      return (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
          Connect GitHub in Settings {">"} Integrations to load pull requests.
        </div>
      );
    }

    if (availability === "unavailable") {
      return (
        <div className="rounded border border-border bg-background-emphasis px-4 py-3 text-sm text-zinc-300">
          This repository remote does not resolve to GitHub.
        </div>
      );
    }

    if (loading) {
      return (
        <div className="rounded border border-border bg-background-emphasis px-4 py-3 text-sm text-zinc-300">
          Loading pull requests...
        </div>
      );
    }

    if (error) {
      return (
        <div
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
        >
          {error}
        </div>
      );
    }

    if (sortedPullRequests.length === 0) {
      return (
        <div className="rounded border border-border bg-background-emphasis px-4 py-3 text-sm text-zinc-300">
          No open pull requests.
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-border bg-background-emphasis text-left text-[10px] uppercase text-zinc-500">
            <tr>
              <th className="w-20 px-3 py-2 font-semibold">
                <span className="block truncate">Updated</span>
              </th>
              <th className="min-w-0 px-3 py-2 font-semibold">
                <span className="block truncate">Pull request</span>
              </th>
              <th className="w-32 px-3 py-2 font-semibold">
                <span className="block truncate">People</span>
              </th>
              <th className="w-44 px-3 py-2 font-semibold">
                <span className="block truncate">Repo/Branch</span>
              </th>
              <th className="w-80 px-3 py-2 text-right font-semibold">
                <span className="block truncate">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPullRequests.map((pullRequest) => (
              <PullRequestRow
                key={pullRequest.number}
                pullRequest={pullRequest}
                mergeMethods={availableMergeMethods}
                mergeOptionsLoading={mergeOptionsLoading}
                reviewDecisionDisabled={sameGitHubUser(
                  currentGitHubLogin,
                  pullRequest.user?.login,
                )}
                selectedMergeMethod={selectedMergeMethod}
                onMergeMethodChange={setSelectedMergeMethod}
                onReview={(nextPullRequest) => {
                  void handleReviewPullRequest(nextPullRequest);
                }}
                onDecision={setDecision}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
      <div
        aria-label="Pull requests"
        className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
      >
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-background-emphasis px-5">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-normal text-zinc-500">
              GitHub
            </div>
            <h2 className="truncate text-sm font-semibold text-foreground">
              Pull requests
            </h2>
          </div>
          {showCloseButton && onClose ? (
            <button
              type="button"
              className="ml-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
              aria-label="Close pull requests"
              onClick={onClose}
            >
              <IconX size={16} />
            </button>
          ) : null}
        </header>
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto p-5 text-sm text-zinc-300"
          onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0 text-xs text-zinc-400">
              {sortedPullRequests.length > 0
                ? `${sortedPullRequests.length} open pull request${
                    sortedPullRequests.length === 1 ? "" : "s"
                  }`
                : "Open pull requests"}
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || refreshing || !repoPath}
              onClick={() => {
                void refresh();
              }}
            >
              <IconSearch size={14} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
          {refreshing ? (
            <div className="mb-3 rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-300">
              Refreshing pull requests...
            </div>
          ) : null}
          {reviewNotice ? (
            <div className="mb-3 flex items-center gap-2 rounded border border-lime-500/30 bg-lime-500/10 px-3 py-2 text-xs text-lime-100">
              <IconCheck size={14} />
              <span>{reviewNotice}</span>
            </div>
          ) : null}
          {preparingReviewNumber !== null ? (
            <div className="mb-3 rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-300">
              Preparing review for #{preparingReviewNumber}...
            </div>
          ) : null}
          {submissionError && !decision ? (
            <div
              role="alert"
              className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
            >
              {submissionError}
            </div>
          ) : null}
          {mergeOptionsError ? (
            <div
              role="alert"
              className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100"
            >
              Could not load repository merge methods. {mergeOptionsError}
            </div>
          ) : null}
          {renderBody()}
        </div>
        {decision && repoPath ? (
          <ReviewDecisionModal
            decision={decision}
            repoPath={repoPath}
            submitting={submitting}
            errorMessage={submissionError}
            onCancel={() => {
              setDecision(null);
              setSubmissionError(null);
            }}
            onSubmit={handleSubmitDecision}
          />
        ) : null}
      </div>
  );
}

export function PullRequestModal({
  open,
  repoPath,
  onClose,
  onReviewPullRequest,
}: PullRequestModalProps) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/65 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pull requests"
        className="flex h-[min(720px,88vh)] w-[min(1180px,96vw)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <PullRequestListSurface
          repoPath={repoPath}
          onClose={onClose}
          onReviewPullRequest={onReviewPullRequest}
          showCloseButton
        />
      </div>
    </div>,
    document.body,
  );
}
