import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PullRequestModal } from "./pull-request-modal";

const integrationApiMocks = vi.hoisted(() => ({
  getProviderRepositoryMergeOptions: vi.fn(),
  listProviderIntegrations: vi.fn(),
  listProviderPullRequestCommits: vi.fn(),
  listProviderPullRequests: vi.fn(),
  mergeProviderPullRequest: vi.fn(),
  prepareProviderPullRequestRefs: vi.fn(),
  submitProviderPullRequestReview: vi.fn(),
}));

vi.mock("@/shared/api/integrations", () => integrationApiMocks);

const pullRequest = {
  number: 12,
  title: "Improve checkout flow",
  body: "This PR improves checkout validation.",
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

function renderPullRequestModal(
  props: Partial<ComponentProps<typeof PullRequestModal>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <PullRequestModal open repoPath="/repo" onClose={vi.fn()} {...props} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("PullRequestModal", () => {
  beforeEach(() => {
    Object.values(integrationApiMocks).forEach((mock) => mock.mockReset());
    integrationApiMocks.listProviderIntegrations.mockResolvedValue([
      {
        id: "github",
        displayName: "GitHub",
        capabilities: ["pullRequests", "pullRequestReviews"],
        status: "connected",
        connection: { accountLogin: "reviewer", avatarUrl: null, scopes: [] },
        lastError: null,
        selectedAccessMethod: "autoFallback",
        oauth: null,
        ghCli: null,
      },
    ]);
    integrationApiMocks.listProviderPullRequests.mockResolvedValue([pullRequest]);
    integrationApiMocks.getProviderRepositoryMergeOptions.mockResolvedValue({
      mergeCommit: true,
      squash: true,
      rebase: true,
    });
    integrationApiMocks.listProviderPullRequestCommits.mockResolvedValue([
      {
        sha: "a1",
        message: "Add checkout validation",
        messageHeadline: "Add checkout validation",
        messageBody: "",
      },
      {
        sha: "b2",
        message: "Update checkout copy",
        messageHeadline: "Update checkout copy",
        messageBody: "",
      },
    ]);
    integrationApiMocks.mergeProviderPullRequest.mockResolvedValue({
      sha: "merge-sha",
      merged: true,
      message: "Pull Request successfully merged",
    });
    integrationApiMocks.submitProviderPullRequestReview.mockResolvedValue({
      id: 99,
      state: "APPROVED",
      htmlUrl: "https://github.com/acme/app/pull/12#pullrequestreview-99",
    });
    integrationApiMocks.prepareProviderPullRequestRefs.mockResolvedValue({
      baseRef: "refs/remotes/origin/main",
      headRef: "refs/remotes/origin/pull/12/head",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders pull request rows with GitHub review actions", async () => {
    renderPullRequestModal();

    expect(await screen.findByText("Improve checkout flow")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Merge" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose merge method" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request changes" }),
    ).toBeInTheDocument();
  });

  it("shows disconnected state when GitHub is not connected", async () => {
    integrationApiMocks.listProviderPullRequests.mockRejectedValueOnce(
      new Error("GitHub is not connected"),
    );

    renderPullRequestModal();

    expect(
      await screen.findByText(
        "Connect GitHub in Settings > Integrations to load pull requests.",
      ),
    ).toBeInTheDocument();
    expect(integrationApiMocks.listProviderPullRequests).toHaveBeenCalledWith({
      providerId: "github",
      path: "/repo",
    });
  });

  it("merges pull requests with the composed merge message", async () => {
    const user = userEvent.setup();
    renderPullRequestModal();

    await screen.findByRole("button", { name: "Merge" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Merge" })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await user.clear(screen.getByLabelText("Commit message"));
    await user.type(screen.getByLabelText("Commit message"), "Merge checkout changes");
    await user.clear(screen.getByLabelText("Extended description"));
    await user.type(screen.getByLabelText("Extended description"), "Looks good.");
    await user.click(
      screen.getByRole("button", { name: "Confirm merge" }),
    );

    await waitFor(() => {
      expect(integrationApiMocks.mergeProviderPullRequest).toHaveBeenCalledWith({
        providerId: "github",
        path: "/repo",
        number: 12,
        mergeMethod: "merge",
        title: "Merge checkout changes",
        body: "Looks good.",
      });
    });
    expect(await screen.findByText("Merged #12.")).toBeInTheDocument();
  });

  it("keeps merge failure feedback visible in the active confirmation dialog", async () => {
    const user = userEvent.setup();
    integrationApiMocks.mergeProviderPullRequest.mockRejectedValueOnce(
      new Error("Pull request requirements have not been met"),
    );
    renderPullRequestModal();

    await screen.findByRole("button", { name: "Merge" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Merge" })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await user.click(screen.getByRole("button", { name: "Confirm merge" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Merge pull request",
    });
    expect(
      within(dialog).getByText("Pull request requirements have not been met"),
    ).toBeInTheDocument();
  });

  it("uses the pull request commit list for squash merge messages", async () => {
    const user = userEvent.setup();
    renderPullRequestModal();

    const chooseMergeMethod = await screen.findByRole("button", {
      name: "Choose merge method",
    });
    await waitFor(() => expect(chooseMergeMethod).not.toBeDisabled());
    await user.click(chooseMergeMethod);
    await user.click(await screen.findByText("Squash and merge"));
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Extended description")).toHaveValue(
        "* Add checkout validation\n* Update checkout copy",
      );
    });
    await user.click(
      screen.getByRole("button", { name: "Confirm squash and merge" }),
    );

    await waitFor(() => {
      expect(integrationApiMocks.listProviderPullRequestCommits).toHaveBeenCalledWith({
        providerId: "github",
        path: "/repo",
        number: 12,
      });
      expect(integrationApiMocks.mergeProviderPullRequest).toHaveBeenCalledWith({
        providerId: "github",
        path: "/repo",
        number: 12,
        mergeMethod: "squash",
        title: "Improve checkout flow (#12)",
        body: "* Add checkout validation\n* Update checkout copy",
      });
    });
  });

  it("shows a compact confirmation for rebase merges", async () => {
    const user = userEvent.setup();
    renderPullRequestModal();

    const chooseMergeMethod = await screen.findByRole("button", {
      name: "Choose merge method",
    });
    await waitFor(() => expect(chooseMergeMethod).not.toBeDisabled());
    await user.click(chooseMergeMethod);
    await user.click(await screen.findByText("Rebase and merge"));
    await user.click(screen.getByRole("button", { name: "Merge" }));

    expect(
      screen.getByText("This will rebase your changes and merge them into main."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Confirm rebase and merge" }),
    );

    await waitFor(() => {
      expect(integrationApiMocks.mergeProviderPullRequest).toHaveBeenCalledWith({
        providerId: "github",
        path: "/repo",
        number: 12,
        mergeMethod: "rebase",
        title: null,
        body: null,
      });
    });
  });

  it("uses the first repository-enabled merge method as the default", async () => {
    integrationApiMocks.getProviderRepositoryMergeOptions.mockResolvedValueOnce({
      mergeCommit: false,
      squash: true,
      rebase: true,
    });
    renderPullRequestModal();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Merge" })).toHaveAttribute(
        "title",
        "Squash and merge",
      ),
    );
  });

  it("shows only repository-enabled merge methods in the dropdown", async () => {
    const user = userEvent.setup();
    integrationApiMocks.getProviderRepositoryMergeOptions.mockResolvedValueOnce({
      mergeCommit: false,
      squash: true,
      rebase: true,
    });
    renderPullRequestModal();

    const chooseMergeMethod = await screen.findByRole("button", {
      name: "Choose merge method",
    });
    await waitFor(() => expect(chooseMergeMethod).not.toBeDisabled());
    await user.click(chooseMergeMethod);

    expect(screen.queryByText("Create a merge commit")).not.toBeInTheDocument();
    expect(await screen.findByText("Squash and merge")).toBeInTheDocument();
    expect(screen.getByText("Rebase and merge")).toBeInTheDocument();
  });

  it("keeps standard merge methods visible when repository options are unavailable", async () => {
    const user = userEvent.setup();
    integrationApiMocks.getProviderRepositoryMergeOptions.mockRejectedValueOnce(
      new Error("GitHub request failed"),
    );
    renderPullRequestModal();

    const chooseMergeMethod = await screen.findByRole("button", {
      name: "Choose merge method",
    });
    await waitFor(() => expect(chooseMergeMethod).not.toBeDisabled());
    await user.click(chooseMergeMethod);

    expect(await screen.findByText("Create a merge commit")).toBeInTheDocument();
    expect(screen.getByText("Squash and merge")).toBeInTheDocument();
    expect(screen.getByText("Rebase and merge")).toBeInTheDocument();
  });

  it("keeps standard merge methods visible when provider reports no enabled methods", async () => {
    const user = userEvent.setup();
    integrationApiMocks.getProviderRepositoryMergeOptions.mockResolvedValueOnce({
      mergeCommit: false,
      squash: false,
      rebase: false,
    });
    renderPullRequestModal();

    const chooseMergeMethod = await screen.findByRole("button", {
      name: "Choose merge method",
    });
    await waitFor(() => expect(chooseMergeMethod).not.toBeDisabled());
    await user.click(chooseMergeMethod);

    expect(await screen.findByText("Create a merge commit")).toBeInTheDocument();
    expect(screen.getByText("Squash and merge")).toBeInTheDocument();
    expect(screen.getByText("Rebase and merge")).toBeInTheDocument();
  });

  it("prepares refs before opening pull request review", async () => {
    const user = userEvent.setup();
    const onReviewPullRequest = vi.fn();
    renderPullRequestModal({ onReviewPullRequest });

    await user.click(await screen.findByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(integrationApiMocks.prepareProviderPullRequestRefs).toHaveBeenCalledWith({
        providerId: "github",
        path: "/repo",
        number: 12,
        baseRef: "main",
      });
    });
    expect(onReviewPullRequest).toHaveBeenCalledWith({
      pullRequest,
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
    integrationApiMocks.submitProviderPullRequestReview.mockRejectedValueOnce(
      new Error("Review comments are invalid"),
    );
    renderPullRequestModal();

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
        integrationApiMocks.submitProviderPullRequestReview,
      ).toHaveBeenCalledWith({
        providerId: "github",
        path: "/repo",
        number: 12,
        event: "REQUEST_CHANGES",
        body: "Please address this.",
        comments: [],
      });
    });
    expect(await screen.findByText("Review comments are invalid")).toBeInTheDocument();
  });

  it("disables request changes for pull requests authored by the current user", async () => {
    integrationApiMocks.listProviderIntegrations.mockResolvedValueOnce([
      {
        id: "github",
        displayName: "GitHub",
        capabilities: ["pullRequests", "pullRequestReviews"],
        status: "connected",
        connection: { accountLogin: "marco", avatarUrl: null, scopes: [] },
        lastError: null,
        selectedAccessMethod: "autoFallback",
        oauth: null,
        ghCli: null,
      },
    ]);
    renderPullRequestModal();

    expect(
      await screen.findByRole("button", { name: "Request changes" }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Merge" })).toBeEnabled(),
    );
  });
});
