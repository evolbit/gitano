import ReactDOM from "react-dom";
import { useMemo, useState } from "react";
import {
  IconCheck,
  IconGitPullRequest,
  IconSearch,
  IconX,
} from "@/shared/components/icons/icons";
import {
  submitGitHubPullRequestReview,
  prepareGitHubPullRequestRefs,
  type GitHubPullRequestListItem,
  type GitHubPullRequestReviewEvent,
} from "@/shared/api/integrations";
import { MarkdownComposer } from "../markdown-composer/markdown-composer";
import { usePullRequests } from "../../hooks/use-pull-requests";

type PullRequestModalProps = {
  open: boolean;
  repoPath: string | null | undefined;
  onClose: () => void;
  onReviewPullRequest?: (review: PullRequestReviewTarget) => void;
};

export type PullRequestReviewTarget = {
  number: number;
  title: string;
  baseRef: string;
  headRef: string;
  baseLabel: string;
  headLabel: string;
};

type ReviewDecision = {
  pullRequest: GitHubPullRequestListItem;
  event: GitHubPullRequestReviewEvent;
};

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function ReviewDecisionModal({
  decision,
  repoPath,
  submitting,
  onCancel,
  onSubmit,
}: {
  decision: ReviewDecision;
  repoPath: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (body: string) => void | Promise<void>;
}) {
  const [body, setBody] = useState("");
  const isApprove = decision.event === "APPROVE";
  const title = isApprove ? "Approve pull request" : "Request changes";
  const saveLabel = isApprove ? "Approve" : "Request changes";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <div className="border-b border-border bg-background-emphasis px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-normal text-zinc-500">
            GitHub Review
          </div>
          <h3 className="mt-1 text-sm font-semibold text-foreground">
            {title}
          </h3>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-300">
            #{decision.pullRequest.number} {decision.pullRequest.title}
          </div>
          <MarkdownComposer
            value={body}
            onChange={setBody}
            onSave={() => {
              void onSubmit(body);
            }}
            onCancel={onCancel}
            saveLabel={submitting ? "Submitting" : saveLabel}
            placeholder="Leave a review comment"
            autoFocus
          />
          {!repoPath ? (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              Repository path is unavailable.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PullRequestRow({
  pullRequest,
  onReview,
  onDecision,
}: {
  pullRequest: GitHubPullRequestListItem;
  onReview: (pullRequest: GitHubPullRequestListItem) => void;
  onDecision: (decision: ReviewDecision) => void;
}) {
  return (
    <tr className="border-b border-border text-sm last:border-b-0">
      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-400">
        {formatDate(pullRequest.updatedAt)}
      </td>
      <td className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <IconGitPullRequest size={15} className="shrink-0 text-lime-400" />
          <span className="truncate font-medium text-zinc-100">
            {pullRequest.title}
          </span>
          <span className="shrink-0 text-blue-300">
            #{pullRequest.number}
          </span>
          {pullRequest.draft ? (
            <span className="shrink-0 rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">
              Draft
            </span>
          ) : null}
        </div>
        <div className="mt-1 truncate text-xs text-zinc-500">
          {pullRequest.head.label} {"->"} {pullRequest.base.label}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-300">
        {pullRequest.user?.login ?? "Unknown"}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-300">
        {pullRequest.base.repositoryFullName ?? "GitHub"}
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-8 rounded border border-border bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
            onClick={() => onReview(pullRequest)}
          >
            Review
          </button>
          <button
            type="button"
            className="h-8 rounded border border-lime-500/40 bg-lime-500/15 px-3 text-xs font-semibold text-lime-100 transition-colors hover:bg-lime-500/25"
            onClick={() =>
              onDecision({
                pullRequest,
                event: "APPROVE",
              })
            }
          >
            Approve
          </button>
          <button
            type="button"
            className="h-8 rounded border border-amber-500/40 bg-amber-500/15 px-3 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/25"
            onClick={() =>
              onDecision({
                pullRequest,
                event: "REQUEST_CHANGES",
              })
            }
          >
            Request changes
          </button>
        </div>
      </td>
    </tr>
  );
}

export function PullRequestModal({
  open,
  repoPath,
  onClose,
  onReviewPullRequest,
}: PullRequestModalProps) {
  const { availability, error, loading, pullRequests, refresh } =
    usePullRequests({ open, repoPath });
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [preparingReviewNumber, setPreparingReviewNumber] = useState<
    number | null
  >(null);
  const sortedPullRequests = useMemo(
    () =>
      [...pullRequests].sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [pullRequests],
  );

  if (!open) return null;

  const handleSubmitDecision = async (body: string) => {
    if (!decision || !repoPath) return;

    setSubmitting(true);
    setSubmissionError(null);
    try {
      await submitGitHubPullRequestReview({
        path: repoPath,
        number: decision.pullRequest.number,
        event: decision.event,
        body,
        comments: [],
      });
      setDecision(null);
      setReviewNotice(
        decision.event === "APPROVE"
          ? `Approved #${decision.pullRequest.number}.`
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
    pullRequest: GitHubPullRequestListItem,
  ) => {
    if (!repoPath) return;

    setPreparingReviewNumber(pullRequest.number);
    setSubmissionError(null);
    try {
      const refs = await prepareGitHubPullRequestRefs({
        path: repoPath,
        number: pullRequest.number,
        baseRef: pullRequest.base.refName,
      });
      onReviewPullRequest?.({
        number: pullRequest.number,
        title: pullRequest.title,
        baseRef: refs.baseRef,
        headRef: refs.headRef,
        baseLabel: pullRequest.base.label,
        headLabel: pullRequest.head.label,
      });
      onClose();
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
              <th className="w-20 px-3 py-2 font-semibold">Updated</th>
              <th className="px-3 py-2 font-semibold">Pull request</th>
              <th className="w-32 px-3 py-2 font-semibold">People</th>
              <th className="w-44 px-3 py-2 font-semibold">Repo/Branch</th>
              <th className="w-80 px-3 py-2 text-right font-semibold">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPullRequests.map((pullRequest) => (
              <PullRequestRow
                key={pullRequest.number}
                pullRequest={pullRequest}
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

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/65 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pull requests"
        className="flex h-[min(720px,88vh)] w-[min(1180px,96vw)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
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
          <button
            type="button"
            className="ml-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
            aria-label="Close pull requests"
            onClick={onClose}
          >
            <IconX size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5 text-sm text-zinc-300">
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
              disabled={loading || !repoPath}
              onClick={() => {
                void refresh();
              }}
            >
              <IconSearch size={14} />
              Refresh
            </button>
          </div>
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
          {submissionError ? (
            <div
              role="alert"
              className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
            >
              {submissionError}
            </div>
          ) : null}
          {renderBody()}
        </div>
        {decision && repoPath ? (
          <ReviewDecisionModal
            decision={decision}
            repoPath={repoPath}
            submitting={submitting}
            onCancel={() => {
              setDecision(null);
              setSubmissionError(null);
            }}
            onSubmit={handleSubmitDecision}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
