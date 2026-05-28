import type {
  PullRequestListItem,
  PullRequestMergeMethod,
} from "@/shared/api/integrations";

export type PullRequestReviewDecision = {
  pullRequest: PullRequestListItem;
  event: "MERGE" | "REQUEST_CHANGES";
  mergeMethod?: PullRequestMergeMethod;
};

export type PullRequestReviewDecisionPayload = {
  title?: string | null;
  body?: string | null;
};
