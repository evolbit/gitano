import { invokeCommand } from "@/shared/platform/tauri/command";

export type ProviderCapability = "pullRequests" | "pullRequestReviews";

export type IntegrationConnectionStatus = "disconnected" | "connected";

export type ProviderConnectionSummary = {
  accountLogin: string;
  avatarUrl: string | null;
  scopes: string[];
};

export type ProviderIntegration = {
  id: string;
  displayName: string;
  capabilities: ProviderCapability[];
  status: IntegrationConnectionStatus;
  connection: ProviderConnectionSummary | null;
  lastError: string | null;
};

export type GitHubOAuthStartResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

export type GitHubOAuthCompleteRequest = {
  deviceCode: string;
};

export type GitHubRepository = {
  owner: string;
  name: string;
};

export type GitHubRepositoryRequest = {
  path: string;
  remoteName?: string | null;
};

export type GitHubPullRequestCount = {
  repository: GitHubRepository;
  count: number;
};

export type GitHubPullRequestUser = {
  login: string;
  avatarUrl: string | null;
};

export type GitHubPullRequestBranch = {
  label: string;
  refName: string;
  sha: string;
  repositoryFullName: string | null;
};

export type GitHubPullRequestListItem = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  htmlUrl: string;
  user: GitHubPullRequestUser | null;
  base: GitHubPullRequestBranch;
  head: GitHubPullRequestBranch;
  createdAt: string;
  updatedAt: string;
};

export type GitHubPullRequestNumberRequest = GitHubRepositoryRequest & {
  number: number;
};

export type GitHubPreparePullRequestRefsRequest =
  GitHubPullRequestNumberRequest & {
    baseRef: string;
  };

export type GitHubPreparedPullRequestRefs = {
  baseRef: string;
  headRef: string;
};

export type GitHubPullRequestCommentKind = "conversation" | "review";

export type GitHubPullRequestComment = {
  id: number;
  kind: GitHubPullRequestCommentKind;
  author: GitHubPullRequestUser | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  path: string | null;
  side: string | null;
  line: number | null;
  originalLine: number | null;
  diffHunk: string | null;
  subjectType: "line" | "file" | null;
  inReplyToId: number | null;
  reviewThreadId?: string | null;
  reviewThreadResolved?: boolean | null;
};

export type GitHubPullRequestReviewEvent =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "COMMENT";

export type GitHubPullRequestReviewCommentDraft = {
  path: string;
  body: string;
  side?: string;
  line?: number;
  subjectType?: "line" | "file";
};

export type GitHubSubmitPullRequestReviewRequest =
  GitHubPullRequestNumberRequest & {
    event: GitHubPullRequestReviewEvent;
    body?: string | null;
    comments: GitHubPullRequestReviewCommentDraft[];
  };

export type GitHubSubmittedPullRequestReview = {
  id: number;
  state: string;
  htmlUrl: string | null;
};

export type GitHubUpdatePullRequestCommentRequest =
  GitHubPullRequestNumberRequest & {
    commentId: number;
    kind: GitHubPullRequestCommentKind;
    body: string;
  };

export type GitHubSubmitPullRequestReviewReplyRequest =
  GitHubPullRequestNumberRequest & {
    commentId: number;
    body: string;
  };

export type GitHubResolvePullRequestReviewThreadRequest =
  GitHubPullRequestNumberRequest & {
    threadId: string;
    resolved: boolean;
  };

export type GitHubPullRequestReviewThreadState = {
  threadId: string;
  resolved: boolean;
};

export function listProviderIntegrations() {
  return invokeCommand<ProviderIntegration[]>("integration_list_providers");
}

export function startGitHubOAuthIntegration() {
  return invokeCommand<GitHubOAuthStartResponse>(
    "integration_start_github_oauth",
  );
}

export function completeGitHubOAuthIntegration(
  request: GitHubOAuthCompleteRequest,
) {
  return invokeCommand<ProviderIntegration>("integration_complete_github_oauth", {
    request,
  });
}

export function verifyProviderIntegration(providerId: string) {
  return invokeCommand<ProviderIntegration>("integration_verify_provider", {
    providerId,
  });
}

export function disconnectProviderIntegration(providerId: string) {
  return invokeCommand<ProviderIntegration>(
    "integration_disconnect_provider",
    { providerId },
  );
}

export function getGitHubPullRequestCount(request: GitHubRepositoryRequest) {
  return invokeCommand<GitHubPullRequestCount>("github_pull_request_count", {
    request,
  });
}

export function listGitHubPullRequests(request: GitHubRepositoryRequest) {
  return invokeCommand<GitHubPullRequestListItem[]>(
    "github_list_pull_requests",
    { request },
  );
}

export function prepareGitHubPullRequestRefs(
  request: GitHubPreparePullRequestRefsRequest,
) {
  return invokeCommand<GitHubPreparedPullRequestRefs>(
    "github_prepare_pull_request_refs",
    { request },
  );
}

export function listGitHubPullRequestComments(
  request: GitHubPullRequestNumberRequest,
) {
  return invokeCommand<GitHubPullRequestComment[]>(
    "github_list_pull_request_comments",
    { request },
  );
}

export function submitGitHubPullRequestReview(
  request: GitHubSubmitPullRequestReviewRequest,
) {
  return invokeCommand<GitHubSubmittedPullRequestReview>(
    "github_submit_pull_request_review",
    { request },
  );
}

export function updateGitHubPullRequestComment(
  request: GitHubUpdatePullRequestCommentRequest,
) {
  return invokeCommand<GitHubPullRequestComment>(
    "github_update_pull_request_comment",
    { request },
  );
}

export function submitGitHubPullRequestReviewReply(
  request: GitHubSubmitPullRequestReviewReplyRequest,
) {
  return invokeCommand<GitHubPullRequestComment>(
    "github_submit_pull_request_review_reply",
    { request },
  );
}

export function resolveGitHubPullRequestReviewThread(
  request: GitHubResolvePullRequestReviewThreadRequest,
) {
  return invokeCommand<GitHubPullRequestReviewThreadState>(
    "github_resolve_pull_request_review_thread",
    { request },
  );
}
