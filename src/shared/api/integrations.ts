import { invokeCommand } from "@/shared/platform/tauri/command";

export type ProviderCapability = "pullRequests" | "pullRequestReviews";

export type IntegrationConnectionStatus = "disconnected" | "connected";
export type GitHubAccessMethod = "oauth" | "ghCli" | "autoFallback";
export type GitHubCliAvailability =
  | "notInstalled"
  | "notAuthenticated"
  | "ready";

export type ProviderConnectionSummary = {
  accountLogin: string;
  avatarUrl: string | null;
  scopes: string[];
};

export type GitHubOAuthStatus = {
  status: IntegrationConnectionStatus;
  connection: ProviderConnectionSummary | null;
  lastError: string | null;
};

export type GitHubCliStatus = {
  availability: GitHubCliAvailability;
  version: string | null;
  connection: ProviderConnectionSummary | null;
  message: string | null;
};

export type ProviderIntegration = {
  id: string;
  displayName: string;
  capabilities: ProviderCapability[];
  status: IntegrationConnectionStatus;
  connection: ProviderConnectionSummary | null;
  lastError: string | null;
  selectedAccessMethod?: GitHubAccessMethod | null;
  oauth?: GitHubOAuthStatus | null;
  ghCli?: GitHubCliStatus | null;
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

export type GitHubSetAccessMethodRequest = {
  accessMethod: GitHubAccessMethod;
};

export type GitHubRepository = {
  owner: string;
  name: string;
};

export type GitHubRepositoryRequest = {
  path: string;
  remoteName?: string | null;
};

export type PullRequestProviderId = "github";

export type ProviderRepositoryRequest = GitHubRepositoryRequest & {
  providerId: PullRequestProviderId;
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
  body: string | null;
  state: string;
  draft: boolean;
  htmlUrl: string;
  user: GitHubPullRequestUser | null;
  base: GitHubPullRequestBranch;
  head: GitHubPullRequestBranch;
  createdAt: string;
  updatedAt: string;
};

export type PullRequestRepository = GitHubRepository;
export type PullRequestCount = GitHubPullRequestCount;
export type PullRequestUser = GitHubPullRequestUser;
export type PullRequestBranch = GitHubPullRequestBranch;
export type PullRequestListItem = GitHubPullRequestListItem;

export type GitHubPullRequestCommit = {
  sha: string;
  message: string;
  messageHeadline: string;
  messageBody: string;
};

export type PullRequestCommit = GitHubPullRequestCommit;

export type GitHubPullRequestNumberRequest = GitHubRepositoryRequest & {
  number: number;
};

export type ProviderPullRequestNumberRequest = ProviderRepositoryRequest & {
  number: number;
};

export type GitHubPreparePullRequestRefsRequest =
  GitHubPullRequestNumberRequest & {
    baseRef: string;
  };

export type ProviderPreparePullRequestRefsRequest =
  ProviderPullRequestNumberRequest & {
    baseRef: string;
  };

export type GitHubPreparedPullRequestRefs = {
  baseRef: string;
  headRef: string;
};

export type PreparedPullRequestRefs = GitHubPreparedPullRequestRefs;

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

export type PullRequestCommentKind = GitHubPullRequestCommentKind;
export type PullRequestComment = GitHubPullRequestComment;

export type GitHubPullRequestReviewEvent =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "COMMENT";
export type GitHubMergeMethod = "merge" | "squash" | "rebase";
export type PullRequestReviewEvent = GitHubPullRequestReviewEvent;
export type PullRequestMergeMethod = GitHubMergeMethod;

export type GitHubPullRequestReviewCommentDraft = {
  path: string;
  body: string;
  side?: string;
  line?: number;
  subjectType?: "line" | "file";
};

export type PullRequestReviewCommentDraft =
  GitHubPullRequestReviewCommentDraft;

export type GitHubSubmitPullRequestReviewRequest =
  GitHubPullRequestNumberRequest & {
    event: GitHubPullRequestReviewEvent;
    body?: string | null;
    comments: GitHubPullRequestReviewCommentDraft[];
  };

export type ProviderSubmitPullRequestReviewRequest =
  ProviderPullRequestNumberRequest & {
    event: PullRequestReviewEvent;
    body?: string | null;
    comments: PullRequestReviewCommentDraft[];
  };

export type GitHubSubmitPullRequestConversationCommentRequest =
  GitHubPullRequestNumberRequest & {
    body: string;
  };

export type ProviderSubmitPullRequestConversationCommentRequest =
  ProviderPullRequestNumberRequest & {
    body: string;
  };

export type GitHubSubmittedPullRequestReview = {
  id: number;
  state: string;
  htmlUrl: string | null;
};

export type SubmittedPullRequestReview = GitHubSubmittedPullRequestReview;

export type GitHubRepositoryMergeOptionsRequest = GitHubRepositoryRequest;
export type ProviderRepositoryMergeOptionsRequest = ProviderRepositoryRequest;

export type GitHubRepositoryMergeOptions = {
  mergeCommit: boolean;
  squash: boolean;
  rebase: boolean;
};

export type RepositoryMergeOptions = GitHubRepositoryMergeOptions;

export type GitHubMergePullRequestRequest =
  GitHubPullRequestNumberRequest & {
    mergeMethod: GitHubMergeMethod;
    title?: string | null;
    body?: string | null;
  };

export type ProviderMergePullRequestRequest =
  ProviderPullRequestNumberRequest & {
    mergeMethod: PullRequestMergeMethod;
    title?: string | null;
    body?: string | null;
  };

export type GitHubMergedPullRequest = {
  sha: string | null;
  merged: boolean;
  message: string;
};

export type MergedPullRequest = GitHubMergedPullRequest;

export type GitHubUpdatePullRequestCommentRequest =
  GitHubPullRequestNumberRequest & {
    commentId: number;
    kind: GitHubPullRequestCommentKind;
    body: string;
  };

export type ProviderUpdatePullRequestCommentRequest =
  ProviderPullRequestNumberRequest & {
    commentId: number;
    kind: PullRequestCommentKind;
    body: string;
  };

export type GitHubSubmitPullRequestReviewReplyRequest =
  GitHubPullRequestNumberRequest & {
    commentId: number;
    body: string;
  };

export type ProviderSubmitPullRequestReviewReplyRequest =
  ProviderPullRequestNumberRequest & {
    commentId: number;
    body: string;
  };

export type GitHubResolvePullRequestReviewThreadRequest =
  GitHubPullRequestNumberRequest & {
    threadId: string;
    resolved: boolean;
  };

export type ProviderResolvePullRequestReviewThreadRequest =
  ProviderPullRequestNumberRequest & {
    threadId: string;
    resolved: boolean;
  };

export type GitHubPullRequestReviewThreadState = {
  threadId: string;
  resolved: boolean;
};

export type PullRequestReviewThreadState =
  GitHubPullRequestReviewThreadState;

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

export function setGitHubAccessMethod(request: GitHubSetAccessMethodRequest) {
  return invokeCommand<ProviderIntegration>(
    "integration_set_github_access_method",
    { request },
  );
}

export function getGitHubPullRequestCount(request: GitHubRepositoryRequest) {
  return invokeCommand<GitHubPullRequestCount>("github_pull_request_count", {
    request,
  });
}

export function getProviderPullRequestCount(
  request: ProviderRepositoryRequest,
) {
  return invokeCommand<PullRequestCount>("provider_pull_request_count", {
    request,
  });
}

export function listGitHubPullRequests(request: GitHubRepositoryRequest) {
  return invokeCommand<GitHubPullRequestListItem[]>(
    "github_list_pull_requests",
    { request },
  );
}

export function listGitHubPullRequestCommits(
  request: GitHubPullRequestNumberRequest,
) {
  return invokeCommand<GitHubPullRequestCommit[]>(
    "github_list_pull_request_commits",
    { request },
  );
}

export function listProviderPullRequests(
  request: ProviderRepositoryRequest,
) {
  return invokeCommand<PullRequestListItem[]>(
    "provider_list_pull_requests",
    { request },
  );
}

export function listProviderPullRequestCommits(
  request: ProviderPullRequestNumberRequest,
) {
  return invokeCommand<PullRequestCommit[]>(
    "provider_list_pull_request_commits",
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

export function prepareProviderPullRequestRefs(
  request: ProviderPreparePullRequestRefsRequest,
) {
  return invokeCommand<PreparedPullRequestRefs>(
    "provider_prepare_pull_request_refs",
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

export function listProviderPullRequestComments(
  request: ProviderPullRequestNumberRequest,
) {
  return invokeCommand<PullRequestComment[]>(
    "provider_list_pull_request_comments",
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

export function submitProviderPullRequestReview(
  request: ProviderSubmitPullRequestReviewRequest,
) {
  return invokeCommand<SubmittedPullRequestReview>(
    "provider_submit_pull_request_review",
    { request },
  );
}

export function submitGitHubPullRequestConversationComment(
  request: GitHubSubmitPullRequestConversationCommentRequest,
) {
  return invokeCommand<GitHubPullRequestComment>(
    "github_submit_pull_request_conversation_comment",
    { request },
  );
}

export function submitProviderPullRequestConversationComment(
  request: ProviderSubmitPullRequestConversationCommentRequest,
) {
  return invokeCommand<PullRequestComment>(
    "provider_submit_pull_request_conversation_comment",
    { request },
  );
}

export function getGitHubRepositoryMergeOptions(
  request: GitHubRepositoryMergeOptionsRequest,
) {
  return invokeCommand<GitHubRepositoryMergeOptions>(
    "github_repository_merge_options",
    {
      request,
    },
  );
}

export function getProviderRepositoryMergeOptions(
  request: ProviderRepositoryMergeOptionsRequest,
) {
  return invokeCommand<RepositoryMergeOptions>(
    "provider_repository_merge_options",
    {
      request,
    },
  );
}

export function mergeGitHubPullRequest(
  request: GitHubMergePullRequestRequest,
) {
  return invokeCommand<GitHubMergedPullRequest>("github_merge_pull_request", {
    request,
  });
}

export function mergeProviderPullRequest(
  request: ProviderMergePullRequestRequest,
) {
  return invokeCommand<MergedPullRequest>("provider_merge_pull_request", {
    request,
  });
}

export function updateGitHubPullRequestComment(
  request: GitHubUpdatePullRequestCommentRequest,
) {
  return invokeCommand<GitHubPullRequestComment>(
    "github_update_pull_request_comment",
    { request },
  );
}

export function updateProviderPullRequestComment(
  request: ProviderUpdatePullRequestCommentRequest,
) {
  return invokeCommand<PullRequestComment>(
    "provider_update_pull_request_comment",
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

export function submitProviderPullRequestReviewReply(
  request: ProviderSubmitPullRequestReviewReplyRequest,
) {
  return invokeCommand<PullRequestComment>(
    "provider_submit_pull_request_review_reply",
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

export function resolveProviderPullRequestReviewThread(
  request: ProviderResolvePullRequestReviewThreadRequest,
) {
  return invokeCommand<PullRequestReviewThreadState>(
    "provider_resolve_pull_request_review_thread",
    { request },
  );
}
