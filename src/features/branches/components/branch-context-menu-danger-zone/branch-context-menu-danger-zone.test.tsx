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
        localBranchActionDisabledReason={null}
        localBranchActionClass="cursor-pointer"
        onRequestRenameBranch={onRequestRenameBranch}
        onRequestDeleteBranch={onRequestDeleteBranch}
      />,
    );

    fireEvent.click(getByExactText("Rename feature/auth"));
    fireEvent.click(getByExactText("Delete feature/auth"));

    expect(onRequestRenameBranch).toHaveBeenCalledWith("feature/auth");
    expect(onRequestDeleteBranch).toHaveBeenCalledWith("feature/auth");
  });

  it("does not request dangerous actions while disabled", () => {
    const onRequestRenameBranch = vi.fn();

    render(
      <BranchContextMenuDangerZone
        branchName="origin/main"
        localBranchActionDisabledReason="Checkout is only available for local branches"
        localBranchActionClass="cursor-not-allowed"
        onRequestRenameBranch={onRequestRenameBranch}
        onRequestDeleteBranch={vi.fn()}
      />,
    );

    fireEvent.click(getByExactText("Rename origin/main"));

    expect(onRequestRenameBranch).not.toHaveBeenCalled();
  });
});
