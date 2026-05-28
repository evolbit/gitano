import type {
  PullRequestListItem,
} from "@/shared/api/integrations";
import type {
  PullRequestReviewDecision,
  PullRequestReviewDecisionPayload,
} from "@/shared/types/pull-requests";

export type PullRequestReviewTarget = {
  pullRequest: PullRequestListItem;
  number: number;
  title: string;
  baseRef: string;
  headRef: string;
  baseLabel: string;
  headLabel: string;
};

export type ReviewDecision = PullRequestReviewDecision;
export type ReviewDecisionPayload = PullRequestReviewDecisionPayload;
