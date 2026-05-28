import { useState } from "react";
import { PullRequestMergeDecisionModal } from "@/shared/components/pull-request-merge-decision-modal/pull-request-merge-decision-modal";
import { MarkdownComposer } from "../markdown-composer/markdown-composer";
import type { ReviewDecision, ReviewDecisionPayload } from "./types";

type ReviewDecisionModalProps = {
  decision: ReviewDecision;
  repoPath: string;
  submitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (payload: ReviewDecisionPayload) => void | Promise<void>;
};

export function ReviewDecisionModal({
  decision,
  repoPath,
  submitting,
  errorMessage = null,
  onCancel,
  onSubmit,
}: ReviewDecisionModalProps) {
  const [body, setBody] = useState("");
  const isMerge = decision.event === "MERGE";
  const title = "Request changes";
  const saveLabel = submitting ? "Submitting" : "Request changes";

  if (isMerge) {
    return (
      <PullRequestMergeDecisionModal
        pullRequest={decision.pullRequest}
        mergeMethod={decision.mergeMethod ?? "merge"}
        repoPath={repoPath}
        submitting={submitting}
        errorMessage={errorMessage}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  }

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
          {errorMessage ? (
            <div
              role="alert"
              className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
            >
              {errorMessage}
            </div>
          ) : null}
          <MarkdownComposer
            value={body}
            onChange={setBody}
            onSave={() => {
              void onSubmit({ body });
            }}
            onCancel={onCancel}
            saveLabel={saveLabel}
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
