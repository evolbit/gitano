import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenuBranchOperations } from "./branch-context-menu-branch-operations";

function getByExactText(text: string) {
  return screen.getByText((_content, element) => element?.textContent === text);
}

describe("BranchContextMenuBranchOperations", () => {
  afterEach(() => {
    cleanup();
  });

  it("runs a selected branch operation with command metadata", () => {
    const onRunBranchOperation = vi.fn();

    render(
      <BranchContextMenuBranchOperations
        branchName="feature/auth"
        selectedBranch="main"
        currentBranchLabel="main"
        disabledReason={null}
        itemClass="cursor-pointer"
        onRunBranchOperation={onRunBranchOperation}
      />,
    );

    fireEvent.click(getByExactText("Fast-forward feature/auth to main"));

    expect(onRunBranchOperation).toHaveBeenCalledWith(
      "git_branch_fast_forward_to_branch",
      "feature/auth",
      "Fast-forward succeeded",
      "Fast-forwarded feature/auth to main.",
      "Fast-forward failed",
      "feature/auth",
    );
  });

  it("does not run operations when disabled", () => {
    const onRunBranchOperation = vi.fn();

    render(
      <BranchContextMenuBranchOperations
        branchName="feature/auth"
        selectedBranch="main"
        currentBranchLabel="main"
        disabledReason="Source and target branch are the same"
        itemClass="cursor-not-allowed"
        onRunBranchOperation={onRunBranchOperation}
      />,
    );

    fireEvent.click(getByExactText("Merge main into feature/auth"));

    expect(onRunBranchOperation).not.toHaveBeenCalled();
  });
});
