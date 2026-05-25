import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PullRequestModal } from "./pull-request-modal";

const integrationApiMocks = vi.hoisted(() => ({
  listGitHubPullRequests: vi.fn(),
  listProviderIntegrations: vi.fn(),
  prepareGitHubPullRequestRefs: vi.fn(),
  submitGitHubPullRequestReview: vi.fn(),
}));

vi.mock("@/shared/api/integrations", () => integrationApiMocks);

const pullRequest = {
  number: 12,
  title: "Improve checkout flow",
  state: "open",
  draft: false,
  htmlUrl: "https://github.com/acme/app/pull/12",
  user: {
    login: "marco",
    avatarUrl: null,
  },
  base: {
    label: "acme:main",
    refName: "main",
    sha: "base",
    repositoryFullName: "acme/app",
  },
  head: {
    label: "acme:feature",
    refName: "feature",
    sha: "head",
    repositoryFullName: "acme/app",
  },
  createdAt: "2026-05-20T10:00:00Z",
  updatedAt: "2026-05-21T10:00:00Z",
};

describe("PullRequestModal", () => {
  beforeEach(() => {
    Object.values(integrationApiMocks).forEach((mock) => mock.mockReset());
    integrationApiMocks.listProviderIntegrations.mockResolvedValue([
      {
        id: "github",
        displayName: "GitHub",
        capabilities: ["pullRequests", "pullRequestReviews"],
        status: "connected",
        connection: null,
        lastError: null,
      },
    ]);
    integrationApiMocks.listGitHubPullRequests.mockResolvedValue([pullRequest]);
    integrationApiMocks.submitGitHubPullRequestReview.mockResolvedValue({
      id: 99,
      state: "APPROVED",
      htmlUrl: "https://github.com/acme/app/pull/12#pullrequestreview-99",
    });
    integrationApiMocks.prepareGitHubPullRequestRefs.mockResolvedValue({
      baseRef: "refs/remotes/origin/main",
      headRef: "refs/remotes/origin/pull/12/head",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders pull request rows with GitHub review actions", async () => {
    render(
      <PullRequestModal open repoPath="/repo" onClose={vi.fn()} />,
    );

    expect(await screen.findByText("Improve checkout flow")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request changes" }),
    ).toBeInTheDocument();
  });

  it("shows disconnected state when GitHub is not connected", async () => {
    integrationApiMocks.listProviderIntegrations.mockResolvedValueOnce([
      {
        id: "github",
        displayName: "GitHub",
        capabilities: ["pullRequests", "PullRequestReviews"],
        status: "disconnected",
        connection: null,
        lastError: null,
      },
    ]);

    render(
      <PullRequestModal open repoPath="/repo" onClose={vi.fn()} />,
    );

    expect(
      await screen.findByText(
        "Connect GitHub in Settings > Integrations to load pull requests.",
      ),
    ).toBeInTheDocument();
    expect(integrationApiMocks.listGitHubPullRequests).not.toHaveBeenCalled();
  });

  it("submits approve reviews with the composed comment", async () => {
    const user = userEvent.setup();
    render(
      <PullRequestModal open repoPath="/repo" onClose={vi.fn()} />,
    );

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await user.type(screen.getByPlaceholderText("Leave a review comment"), "Looks good.");
    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[approveButtons.length - 1]);

    await waitFor(() => {
      expect(
        integrationApiMocks.submitGitHubPullRequestReview,
      ).toHaveBeenCalledWith({
        path: "/repo",
        number: 12,
        event: "APPROVE",
        body: "Looks good.",
        comments: [],
      });
    });
    expect(await screen.findByText("Approved #12.")).toBeInTheDocument();
  });

  it("prepares refs before opening pull request review", async () => {
    const user = userEvent.setup();
    const onReviewPullRequest = vi.fn();
    render(
      <PullRequestModal
        open
        repoPath="/repo"
        onClose={vi.fn()}
        onReviewPullRequest={onReviewPullRequest}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(integrationApiMocks.prepareGitHubPullRequestRefs).toHaveBeenCalledWith({
        path: "/repo",
        number: 12,
        baseRef: "main",
      });
    });
    expect(onReviewPullRequest).toHaveBeenCalledWith({
      number: 12,
      title: "Improve checkout flow",
      baseRef: "refs/remotes/origin/main",
      headRef: "refs/remotes/origin/pull/12/head",
      baseLabel: "acme:main",
      headLabel: "acme:feature",
    });
  });

  it("submits request changes reviews and keeps failure feedback visible", async () => {
    const user = userEvent.setup();
    integrationApiMocks.submitGitHubPullRequestReview.mockRejectedValueOnce(
      new Error("Review comments are invalid"),
    );
    render(
      <PullRequestModal open repoPath="/repo" onClose={vi.fn()} />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Request changes" }),
    );
    await user.type(
      screen.getByPlaceholderText("Leave a review comment"),
      "Please address this.",
    );
    const requestChangesButtons = screen.getAllByRole("button", {
      name: "Request changes",
    });
    await user.click(requestChangesButtons[requestChangesButtons.length - 1]);

    await waitFor(() => {
      expect(
        integrationApiMocks.submitGitHubPullRequestReview,
      ).toHaveBeenCalledWith({
        path: "/repo",
        number: 12,
        event: "REQUEST_CHANGES",
        body: "Please address this.",
        comments: [],
      });
    });
    expect(await screen.findByText("Review comments are invalid")).toBeInTheDocument();
  });
});
