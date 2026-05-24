import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenu } from "./branch-context-menu";

describe("BranchContextMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("closes the menu and runs enabled remote branch actions", () => {
    const onCloseContextMenu = vi.fn();
    const onRunRemoteBranchAction = vi.fn();

    render(
      <BranchContextMenu
        contextMenu={{ x: 10, y: 20, node: { type: "branch", name: "main", full: "main" } }}
        menuPos={{ x: 10, y: 20 }}
        menuRef={createRef<HTMLDivElement>()}
        selectedBranch="develop"
        type="local"
        creatingWorktree={false}
        onCloseContextMenu={onCloseContextMenu}
        onBeginCreateBranch={vi.fn()}
        onCheckoutBranch={vi.fn()}
        onRunBranchOperation={vi.fn()}
        onRunRemoteBranchAction={onRunRemoteBranchAction}
        onCreateRandomWorktreeFromBranch={vi.fn()}
        onCopyText={vi.fn()}
        onCopyBranchTipSha={vi.fn()}
        onCompareBranch={vi.fn()}
        onRequestRenameBranch={vi.fn()}
        onRequestDeleteBranch={vi.fn()}
      />,
    );

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
    render(
      <BranchContextMenu
        contextMenu={null}
        menuPos={null}
        menuRef={createRef<HTMLDivElement>()}
        selectedBranch="main"
        type="local"
        creatingWorktree={false}
        onCloseContextMenu={vi.fn()}
        onBeginCreateBranch={vi.fn()}
        onCheckoutBranch={vi.fn()}
        onRunBranchOperation={vi.fn()}
        onRunRemoteBranchAction={vi.fn()}
        onCreateRandomWorktreeFromBranch={vi.fn()}
        onCopyText={vi.fn()}
        onCopyBranchTipSha={vi.fn()}
        onCompareBranch={vi.fn()}
        onRequestRenameBranch={vi.fn()}
        onRequestDeleteBranch={vi.fn()}
      />,
    );

    expect(screen.queryByText("Remote actions")).not.toBeInTheDocument();
  });
});
