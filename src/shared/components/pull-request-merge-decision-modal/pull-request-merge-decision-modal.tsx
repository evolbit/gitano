import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listProviderPullRequestCommits,
  type PullRequestCommit,
  type PullRequestListItem,
  type PullRequestMergeMethod,
} from "@/shared/api/integrations";
import type { PullRequestReviewDecisionPayload } from "@/shared/types/pull-requests";

type PullRequestMergeDecisionModalProps = {
  pullRequest: PullRequestListItem;
  mergeMethod: PullRequestMergeMethod;
  repoPath: string;
  submitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (payload: PullRequestReviewDecisionPayload) => void | Promise<void>;
};

function sourceBranchForMergeTitle(pullRequest: PullRequestListItem) {
  const repositoryOwner =
    pullRequest.head.repositoryFullName?.split("/")[0] ?? null;
  if (repositoryOwner) {
    return `${repositoryOwner}/${pullRequest.head.refName}`;
  }

  return pullRequest.head.label.replace(":", "/");
}

function defaultMergeTitle(
  pullRequest: PullRequestListItem,
  mergeMethod: PullRequestMergeMethod,
) {
  if (mergeMethod === "squash") {
    return `${pullRequest.title} (#${pullRequest.number})`;
  }

  return `Merge pull request #${pullRequest.number} from ${sourceBranchForMergeTitle(
    pullRequest,
  )}`;
}

function defaultMergeBody(
  pullRequest: PullRequestListItem,
  mergeMethod: PullRequestMergeMethod,
) {
  if (mergeMethod === "merge") {
    return pullRequest.title;
  }

  return "";
}

function squashCommitListBody(commits: PullRequestCommit[]) {
  return commits
    .map((commit) => commit.messageHeadline.trim())
    .filter(Boolean)
    .map((headline) => `* ${headline}`)
    .join("\n");
}

function mergeTitle(mergeMethod: PullRequestMergeMethod) {
  switch (mergeMethod) {
    case "squash":
      return "Squash and merge pull request";
    case "rebase":
      return "Rebase and merge pull request";
    case "merge":
    default:
      return "Merge pull request";
  }
}

function mergeSaveLabel(
  mergeMethod: PullRequestMergeMethod,
  submitting: boolean,
) {
  if (submitting) return "Merging";

  switch (mergeMethod) {
    case "squash":
      return "Confirm squash and merge";
    case "rebase":
      return "Confirm rebase and merge";
    case "merge":
    default:
      return "Confirm merge";
  }
}

export function PullRequestMergeDecisionModal({
  pullRequest,
  mergeMethod,
  repoPath,
  submitting,
  errorMessage = null,
  onCancel,
  onSubmit,
}: PullRequestMergeDecisionModalProps) {
  const [mergeCommitTitle, setMergeCommitTitle] = useState(() =>
    defaultMergeTitle(pullRequest, mergeMethod),
  );
  const [mergeCommitBody, setMergeCommitBody] = useState(() =>
    defaultMergeBody(pullRequest, mergeMethod),
  );
  const [mergeCommitBodyEdited, setMergeCommitBodyEdited] = useState(false);
  const isSquashMerge = mergeMethod === "squash";
  const squashCommitsQuery = useQuery({
    queryKey: [
      "pull-requests",
      "github",
      repoPath,
      pullRequest.number,
      "commits",
    ],
    queryFn: () =>
      listProviderPullRequestCommits({
        providerId: "github",
        path: repoPath,
        number: pullRequest.number,
      }),
    enabled: isSquashMerge && Boolean(repoPath),
    staleTime: 30_000,
  });
  const title = mergeTitle(mergeMethod);
  const saveLabel = mergeSaveLabel(mergeMethod, submitting);
  const squashCommitsLoading = isSquashMerge && squashCommitsQuery.isLoading;
  const squashCommitsError =
    isSquashMerge && squashCommitsQuery.error
      ? squashCommitsQuery.error instanceof Error
        ? squashCommitsQuery.error.message
        : String(squashCommitsQuery.error)
      : null;

  useEffect(() => {
    if (!isSquashMerge || mergeCommitBodyEdited || !squashCommitsQuery.data) {
      return;
    }

    setMergeCommitBody(squashCommitListBody(squashCommitsQuery.data));
  }, [isSquashMerge, mergeCommitBodyEdited, squashCommitsQuery.data]);

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
            #{pullRequest.number} {pullRequest.title}
          </div>
          {errorMessage ? (
            <div
              role="alert"
              className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
            >
              {errorMessage}
            </div>
          ) : null}
          {mergeMethod === "rebase" ? (
            <div className="rounded border border-border bg-background px-4 py-4">
              <p className="text-sm text-zinc-300">
                This will rebase your changes and merge them into{" "}
                {pullRequest.base.refName}.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded bg-lime-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={submitting}
                  onClick={() => void onSubmit({ title: null, body: null })}
                >
                  {saveLabel}
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-border bg-background">
              <div className="space-y-3 p-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-zinc-200">
                    Commit message
                  </span>
                  <input
                    value={mergeCommitTitle}
                    onChange={(event) =>
                      setMergeCommitTitle(event.currentTarget.value)
                    }
                    className="h-10 w-full rounded border border-border bg-background-emphasis px-3 text-sm text-foreground outline-none focus:border-blue-500"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-zinc-200">
                    Extended description
                  </span>
                  <textarea
                    value={mergeCommitBody}
                    onChange={(event) => {
                      setMergeCommitBodyEdited(true);
                      setMergeCommitBody(event.currentTarget.value);
                    }}
                    className="min-h-40 w-full resize-y rounded border border-border bg-background-emphasis px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-blue-500"
                    placeholder={
                      squashCommitsLoading ? "Loading commits..." : undefined
                    }
                  />
                </label>
                {squashCommitsError ? (
                  <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    Could not load commits. {squashCommitsError}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background-emphasis px-3 py-2">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
                  onClick={onCancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded bg-lime-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    submitting ||
                    mergeCommitTitle.trim().length === 0 ||
                    squashCommitsLoading
                  }
                  onClick={() =>
                    void onSubmit({
                      title: mergeCommitTitle,
                      body: mergeCommitBody,
                    })
                  }
                >
                  {saveLabel}
                </button>
              </div>
            </div>
          )}
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
