import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import { BranchContextMenuBranchingItems } from "./branch-context-menu-branching-items";

describe("BranchContextMenuBranchingItems", () => {
  afterEach(() => {
    cleanup();
  });

  it("only renders branch creation in the branch menu branching section", () => {
    const node: BranchTreeNode = {
      type: "branch",
      name: "feature/auth",
      full: "feature/auth",
    };

    render(
      <BranchContextMenuBranchingItems
        node={node}
        branchName="feature/auth"
        type="local"
        isBranchNode
        selectedBranch="main"
        onBeginCreateBranch={vi.fn()}
        onCloseMenus={vi.fn()}
      />,
    );

    expect(screen.getByText("Create branch here")).toBeInTheDocument();
    expect(screen.queryByText("Cherry pick commit")).not.toBeInTheDocument();
    expect(screen.queryByText("Reset ... to this commit")).not.toBeInTheDocument();
    expect(screen.queryByText("Revert commit")).not.toBeInTheDocument();
  });

  it("starts branch creation from the targeted branch", () => {
    const onBeginCreateBranch = vi.fn();
    const onCloseMenus = vi.fn();
    const node: BranchTreeNode = {
      type: "branch",
      name: "feature/auth",
      full: "feature/auth",
    };

    render(
      <BranchContextMenuBranchingItems
        node={node}
        branchName="feature/auth"
        type="local"
        isBranchNode
        selectedBranch="main"
        onBeginCreateBranch={onBeginCreateBranch}
        onCloseMenus={onCloseMenus}
      />,
    );

    fireEvent.click(screen.getByText("Create branch here"));

    expect(onCloseMenus).toHaveBeenCalledOnce();
    expect(onBeginCreateBranch).toHaveBeenCalledWith("feature/auth", "feature/");
  });
});
