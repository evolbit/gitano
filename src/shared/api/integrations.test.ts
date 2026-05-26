import { describe, expect, it, vi } from "vitest";
import {
  completeGitHubOAuthIntegration,
  disconnectProviderIntegration,
  getGitHubPullRequestCount,
  listGitHubPullRequestComments,
  listGitHubPullRequests,
  listProviderIntegrations,
  prepareGitHubPullRequestRefs,
  resolveGitHubPullRequestReviewThread,
  startGitHubOAuthIntegration,
  submitGitHubPullRequestReview,
  submitGitHubPullRequestReviewReply,
  updateGitHubPullRequestComment,
  verifyProviderIntegration,
} from "./integrations";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("integrations API", () => {
  it("lists provider integrations", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await listProviderIntegrations();

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "integration_list_providers",
    );
  });

  it("starts GitHub OAuth with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      deviceCode: "device-code",
      userCode: "ABCD-1234",
      verificationUri: "https://github.com/login/device",
      expiresIn: 900,
      interval: 5,
    });

    await startGitHubOAuthIntegration();

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "integration_start_github_oauth",
    );
  });

  it("completes GitHub OAuth with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      id: "github",
      displayName: "GitHub",
      capabilities: ["pullRequests"],
      status: "connected",
      connection: null,
      lastError: null,
    });

    await completeGitHubOAuthIntegration({ deviceCode: "device-code" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "integration_complete_github_oauth",
      {
        request: { deviceCode: "device-code" },
      },
    );
  });

  it("verifies provider integrations", async () => {
    invokeCommandMock.mockResolvedValueOnce(null);

    await verifyProviderIntegration("github");

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "integration_verify_provider",
      {
        providerId: "github",
      },
    );
  });

  it("disconnects provider integrations", async () => {
    invokeCommandMock.mockResolvedValueOnce(null);

    await disconnectProviderIntegration("github");

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "integration_disconnect_provider",
      {
        providerId: "github",
      },
    );
  });

  it("requests GitHub pull request count", async () => {
    invokeCommandMock.mockResolvedValueOnce({ count: 2 });

    await getGitHubPullRequestCount({ path: "/repo", remoteName: "origin" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_pull_request_count",
      {
        request: { path: "/repo", remoteName: "origin" },
      },
    );
  });

  it("lists GitHub pull requests", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await listGitHubPullRequests({ path: "/repo" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_list_pull_requests",
      {
        request: { path: "/repo" },
      },
    );
  });

  it("prepares GitHub pull request refs", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      baseRef: "refs/remotes/origin/main",
      headRef: "refs/remotes/origin/pull/7/head",
    });

    await prepareGitHubPullRequestRefs({
      path: "/repo",
      number: 7,
      baseRef: "main",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_prepare_pull_request_refs",
      {
        request: { path: "/repo", number: 7, baseRef: "main" },
      },
    );
  });

  it("lists GitHub pull request comments", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await listGitHubPullRequestComments({ path: "/repo", number: 7 });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_list_pull_request_comments",
      {
        request: { path: "/repo", number: 7 },
      },
    );
  });

  it("submits GitHub pull request reviews", async () => {
    invokeCommandMock.mockResolvedValueOnce({ id: 1, state: "APPROVED" });

    await submitGitHubPullRequestReview({
      path: "/repo",
      number: 7,
      event: "APPROVE",
      body: "Looks good",
      comments: [],
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_submit_pull_request_review",
      {
        request: {
          path: "/repo",
          number: 7,
          event: "APPROVE",
          body: "Looks good",
          comments: [],
        },
      },
    );
  });

  it("updates GitHub pull request comments", async () => {
    invokeCommandMock.mockResolvedValueOnce({ id: 4, body: "Updated" });

    await updateGitHubPullRequestComment({
      path: "/repo",
      number: 7,
      kind: "review",
      commentId: 4,
      body: "Updated",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_update_pull_request_comment",
      {
        request: {
          path: "/repo",
          number: 7,
          kind: "review",
          commentId: 4,
          body: "Updated",
        },
      },
    );
  });

  it("submits GitHub pull request review replies", async () => {
    invokeCommandMock.mockResolvedValueOnce({ id: 5, body: "Reply" });

    await submitGitHubPullRequestReviewReply({
      path: "/repo",
      number: 7,
      commentId: 4,
      body: "Reply",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_submit_pull_request_review_reply",
      {
        request: {
          path: "/repo",
          number: 7,
          commentId: 4,
          body: "Reply",
        },
      },
    );
  });

  it("resolves GitHub pull request review threads", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      threadId: "PRRT_kwDOExample",
      resolved: true,
    });

    await resolveGitHubPullRequestReviewThread({
      path: "/repo",
      number: 7,
      threadId: "PRRT_kwDOExample",
      resolved: true,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "github_resolve_pull_request_review_thread",
      {
        request: {
          path: "/repo",
          number: 7,
          threadId: "PRRT_kwDOExample",
          resolved: true,
        },
      },
    );
  });
});
