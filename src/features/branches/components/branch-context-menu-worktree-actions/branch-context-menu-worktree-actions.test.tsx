import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenuWorktreeActions } from "./branch-context-menu-worktree-actions";

function getByExactText(text: string) {
  return screen.getByText((_content, element) => element?.textContent === text);
}

describe("BranchContextMenuWorktreeActions", () => {
  afterEach(() => {
    cleanup();
  });

  it("checks out a branch and creates a worktree when enabled", () => {
    const onCheckoutBranch = vi.fn();
    const onCreateRandomWorktreeFromBranch = vi.fn();

    render(
      <BranchContextMenuWorktreeActions
        branchName="feature/auth"
        worktreeBaseRef="feature/auth"
        localBranchActionDisabledReason={null}
        localBranchActionClass="cursor-pointer"
        createWorktreeDisabledReason={null}
        createWorktreeActionClass="cursor-pointer"
        creatingWorktree={false}
        onCheckoutBranch={onCheckoutBranch}
        onCreateRandomWorktreeFromBranch={onCreateRandomWorktreeFromBranch}
      />,
    );

    fireEvent.click(getByExactText("Checkout feature/auth"));
    fireEvent.click(getByExactText("Create worktree from feature/auth"));

    expect(onCheckoutBranch).toHaveBeenCalledWith("feature/auth");
    expect(onCreateRandomWorktreeFromBranch).toHaveBeenCalledWith("feature/auth");
  });

  it("blocks checkout when local branch actions are disabled", () => {
    const onCheckoutBranch = vi.fn();

    render(
      <BranchContextMenuWorktreeActions
        branchName="origin/main"
        worktreeBaseRef="origin/main"
        localBranchActionDisabledReason="Checkout is only available for local branches"
        localBranchActionClass="cursor-not-allowed"
        createWorktreeDisabledReason="A worktree is already being created"
        createWorktreeActionClass="cursor-not-allowed"
        creatingWorktree
        onCheckoutBranch={onCheckoutBranch}
        onCreateRandomWorktreeFromBranch={vi.fn()}
      />,
    );

    fireEvent.click(getByExactText("Checkout origin/main"));
    expect(screen.getByText("Creating worktree...")).toBeInTheDocument();
    expect(onCheckoutBranch).not.toHaveBeenCalled();
  });
});
