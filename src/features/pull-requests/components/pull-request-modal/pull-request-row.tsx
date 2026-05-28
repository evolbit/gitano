import { IconGitPullRequest } from "@/shared/components/icons/icons";
import { PullRequestMergeAction } from "@/shared/components/pull-request-merge-action/pull-request-merge-action";
import type {
  PullRequestListItem,
  PullRequestMergeMethod,
} from "@/shared/api/integrations";
import type { MergeMethodOption } from "@/shared/lib/pull-requests/merge-methods";
import type { ReviewDecision } from "./types";

type PullRequestRowProps = {
  pullRequest: PullRequestListItem;
  mergeMethods: MergeMethodOption[];
  mergeOptionsLoading: boolean;
  reviewDecisionDisabled: boolean;
  selectedMergeMethod: PullRequestMergeMethod;
  onMergeMethodChange: (method: PullRequestMergeMethod) => void;
  onReview: (pullRequest: PullRequestListItem) => void;
  onDecision: (decision: ReviewDecision) => void;
};

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

export function PullRequestRow({
  pullRequest,
  mergeMethods,
  mergeOptionsLoading,
  reviewDecisionDisabled,
  selectedMergeMethod,
  onMergeMethodChange,
  onReview,
  onDecision,
}: PullRequestRowProps) {
  return (
    <tr className="border-b border-border text-sm last:border-b-0">
      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-400">
        {formatDate(pullRequest.updatedAt)}
      </td>
      <td className="min-w-0 overflow-hidden px-3 py-2">
        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
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
      <td className="min-w-0 overflow-hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-300">
        <span className="block truncate">
          {pullRequest.user?.login ?? "Unknown"}
        </span>
      </td>
      <td className="min-w-0 overflow-hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-300">
        <span className="block truncate">
          {pullRequest.base.repositoryFullName ?? "GitHub"}
        </span>
      </td>
      <td className="min-w-0 overflow-hidden px-3 py-2">
        <div className="flex min-w-0 justify-end gap-2 overflow-hidden">
          <button
            type="button"
            className="h-8 shrink-0 rounded border border-border bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
            onClick={() => onReview(pullRequest)}
          >
            Review
          </button>
          <PullRequestMergeAction
            mergeMethods={mergeMethods}
            mergeOptionsLoading={mergeOptionsLoading}
            selectedMergeMethod={selectedMergeMethod}
            onMergeMethodChange={onMergeMethodChange}
            onMerge={() =>
              onDecision({
                pullRequest,
                event: "MERGE",
                mergeMethod: selectedMergeMethod,
              })
            }
          />
          <button
            type="button"
            className="h-8 shrink-0 rounded border border-amber-500/40 bg-amber-500/15 px-3 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={reviewDecisionDisabled}
            title={
              reviewDecisionDisabled
                ? "Unavailable because you authored this pull request"
                : undefined
            }
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
