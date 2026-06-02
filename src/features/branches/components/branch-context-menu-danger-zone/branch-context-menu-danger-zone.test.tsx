import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenuDangerZone } from "./branch-context-menu-danger-zone";

function getByExactText(text: string) {
  return screen.getByText((_content, element) => element?.textContent === text);
}

describe("BranchContextMenuDangerZone", () => {
  afterEach(() => {
    cleanup();
  });

  it("requests rename and delete actions for enabled local branches", () => {
    const onRequestRenameBranch = vi.fn();
    const onRequestDeleteBranch = vi.fn();

    render(
      <BranchContextMenuDangerZone
        branchName="feature/auth"
        remoteBranchName={null}
        localBranchActionDisabledReason={null}
        localBranchActionClass="cursor-pointer"
        onRequestRenameBranch={onRequestRenameBranch}
        onRequestDeleteBranch={onRequestDeleteBranch}
        onRequestDeleteRemoteBranch={vi.fn()}
      />,
    );

    fireEvent.click(getByExactText("Rename feature/auth"));
    fireEvent.click(getByExactText("Delete feature/auth"));
    fireEvent.click(getByExactText("Force delete feature/auth"));

    expect(onRequestRenameBranch).toHaveBeenCalledWith("feature/auth");
    expect(onRequestDeleteBranch).toHaveBeenNthCalledWith(1, "feature/auth", false);
    expect(onRequestDeleteBranch).toHaveBeenNthCalledWith(2, "feature/auth", true);
  });

  it("does not request dangerous actions while disabled", () => {
    const onRequestRenameBranch = vi.fn();
    const onRequestDeleteBranch = vi.fn();

    render(
      <BranchContextMenuDangerZone
        branchName="origin/main"
        remoteBranchName={null}
        localBranchActionDisabledReason="Checkout is only available for local branches"
        localBranchActionClass="cursor-not-allowed"
        onRequestRenameBranch={onRequestRenameBranch}
        onRequestDeleteBranch={onRequestDeleteBranch}
        onRequestDeleteRemoteBranch={vi.fn()}
      />,
    );

    fireEvent.click(getByExactText("Rename origin/main"));
    fireEvent.click(getByExactText("Delete origin/main"));
    fireEvent.click(getByExactText("Force delete origin/main"));

    expect(onRequestRenameBranch).not.toHaveBeenCalled();
    expect(onRequestDeleteBranch).not.toHaveBeenCalled();
  });

  it("requests remote branch deletion separately", () => {
    const onRequestDeleteRemoteBranch = vi.fn();

    render(
      <BranchContextMenuDangerZone
        branchName="origin/feature/auth"
        remoteBranchName="origin/feature/auth"
        localBranchActionDisabledReason={null}
        localBranchActionClass="cursor-pointer"
        onRequestRenameBranch={vi.fn()}
        onRequestDeleteBranch={vi.fn()}
        onRequestDeleteRemoteBranch={onRequestDeleteRemoteBranch}
      />,
    );

    fireEvent.click(getByExactText("Delete origin/feature/auth..."));

    expect(onRequestDeleteRemoteBranch).toHaveBeenCalledWith(
      "origin/feature/auth",
    );
  });
});
