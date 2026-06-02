import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitBranchRef } from "@/shared/types/git";
import { BranchContextMenu } from "./branch-context-menu";

const branchRefByName = new Map<string, GitBranchRef>([
  [
    "main",
    {
      name: "main",
      localName: "main",
      originName: "origin/main",
      localTargetId: "local",
      originTargetId: "origin",
      upstreamName: "origin/main",
      presence: "local-origin",
      aheadCount: 0,
      behindCount: 0,
    },
  ],
]);

const remoteBranchRefByName = new Map<string, GitBranchRef>([
  [
    "feature/login",
    {
      name: "feature/login",
      localName: null,
      originName: "origin/feature/login",
      localTargetId: null,
      originTargetId: "abc123",
      upstreamName: null,
      presence: "origin",
      aheadCount: null,
      behindCount: null,
    },
  ],
]);

function renderMenu(
  overrides: Partial<ComponentProps<typeof BranchContextMenu>> = {},
) {
  const props: ComponentProps<typeof BranchContextMenu> = {
    contextMenu: {
      x: 10,
      y: 20,
      node: { type: "branch", name: "main", full: "main" },
    },
    menuPos: { x: 10, y: 20 },
    menuRef: createRef<HTMLDivElement>(),
    selectedBranch: "develop",
    branchRefByName,
    branchType: "local",
    creatingWorktree: false,
    matchingPullRequestByHead: new Map(),
    remoteUrl: null,
    onCloseContextMenu: vi.fn(),
    onBeginCreateBranch: vi.fn(),
    onCheckoutBranch: vi.fn(),
    onRunBranchOperation: vi.fn(),
    onRunRemoteBranchOperation: vi.fn(),
    onRunRemoteBranchAction: vi.fn(),
    onCreateRandomWorktreeFromBranch: vi.fn(),
    onCopyText: vi.fn(),
    onCopyBranchTipSha: vi.fn(),
    onCopyRemoteBranchUrl: vi.fn(),
    onCopyRemoteCommitUrl: vi.fn(),
    onCompareBranch: vi.fn(),
    onOpenPullRequestReview: vi.fn(),
    onOpenPullRequestUrl: vi.fn(),
    onRequestRenameBranch: vi.fn(),
    onRequestDeleteBranch: vi.fn(),
    onRequestDeleteRemoteBranch: vi.fn(),
    ...overrides,
  };

  render(<BranchContextMenu {...props} />);
  return props;
}

describe("BranchContextMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("closes the menu and runs enabled remote branch actions", () => {
    const onCloseContextMenu = vi.fn();
    const onRunRemoteBranchAction = vi.fn();

    renderMenu({ onCloseContextMenu, onRunRemoteBranchAction });

    fireEvent.click(screen.getByText("Push"));

    expect(onCloseContextMenu).toHaveBeenCalledOnce();
    expect(onRunRemoteBranchAction).toHaveBeenCalledWith(
      "git_branch_push",
      "main",
      "push",
      "git push succeeded",
      "Pushed main to origin/main.",
      "git push failed",
    );
  });

  it("does not render when context is missing", () => {
    renderMenu({ contextMenu: null, menuPos: null, selectedBranch: "main" });

    expect(screen.queryByText("Remote actions")).not.toBeInTheDocument();
  });

  it("renders remote branch actions with explicit directions", () => {
    const onRunRemoteBranchOperation = vi.fn();
    const onCheckoutBranch = vi.fn();
    const onRequestDeleteRemoteBranch = vi.fn();

    renderMenu({
      contextMenu: {
        x: 10,
        y: 20,
        node: { type: "branch", name: "login", full: "feature/login" },
      },
      branchRefByName: remoteBranchRefByName,
      branchType: "remote",
      selectedBranch: "main",
      remoteUrl: "https://github.com/acme/app.git",
      onRunRemoteBranchOperation,
      onCheckoutBranch,
      onRequestDeleteRemoteBranch,
    });

    fireEvent.click(screen.getByText("Checkout", { exact: false }));
    fireEvent.click(screen.getByText("Merge", { exact: false }));
    fireEvent.click(screen.getByText("Delete", { exact: false }));

    expect(onCheckoutBranch).toHaveBeenCalledWith("origin/feature/login");
    expect(onRunRemoteBranchOperation).toHaveBeenCalledWith(
      "git_branch_merge_remote_into_current",
      "origin/feature/login",
      "Merge succeeded",
      "Merged origin/feature/login into main.",
      "Merge failed",
    );
    expect(onRequestDeleteRemoteBranch).toHaveBeenCalledWith(
      "origin/feature/login",
    );
    expect(screen.queryByText("Push")).not.toBeInTheDocument();
    expect(screen.queryByText(/Force delete/)).not.toBeInTheDocument();
  });

  it("renders pull request actions only for a matching remote branch", () => {
    const onOpenPullRequestReview = vi.fn();
    const onOpenPullRequestUrl = vi.fn();
    const pullRequest = {
      number: 7,
      title: "Feature login",
      htmlUrl: "https://github.com/acme/app/pull/7",
      baseRef: "main",
      headRef: "feature/login",
      baseLabel: "acme:main",
      headLabel: "acme:feature/login",
    };

    renderMenu({
      contextMenu: {
        x: 10,
        y: 20,
        node: { type: "branch", name: "login", full: "feature/login" },
      },
      branchRefByName: remoteBranchRefByName,
      branchType: "remote",
      matchingPullRequestByHead: new Map([["feature/login", pullRequest]]),
      onOpenPullRequestReview,
      onOpenPullRequestUrl,
    });

    fireEvent.click(screen.getByText("Review pull request #7"));
    fireEvent.click(screen.getByText("View pull request #7 on GitHub.com"));

    expect(onOpenPullRequestReview).toHaveBeenCalledWith(pullRequest);
    expect(onOpenPullRequestUrl).toHaveBeenCalledWith(pullRequest.htmlUrl);
  });
});
