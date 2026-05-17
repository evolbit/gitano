import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommitListItem } from "@/shared/types/git";
import {
  CommitContextMenu,
  type CommitContextMenuAction,
} from "./commit-context-menu";

function commit(overrides: Partial<CommitListItem> = {}): CommitListItem {
  return {
    sha: "abc123456789",
    parents: ["parent"],
    refs: [],
    message: "Add context menu",
    author: "Test User",
    author_initial: "T",
    date: 1,
    current_branch: "main",
    source_branch: "main",
    commit_history: [],
    files: 1,
    ...overrides,
  };
}

function renderMenu({
  remoteCommitUrl = "https://github.com/acme/app/commit/abc123",
  currentBranch = "main",
  onAction = vi.fn(),
}: {
  remoteCommitUrl?: string | null;
  currentBranch?: string | null;
  onAction?: (action: CommitContextMenuAction) => void;
} = {}) {
  const menuRef = { current: null } as RefObject<HTMLDivElement>;
  render(
    <CommitContextMenu
      commit={commit()}
      x={10}
      y={20}
      menuRef={menuRef}
      remoteCommitUrl={remoteCommitUrl}
      currentBranch={currentBranch}
      onAction={onAction}
    />,
  );

  return { onAction };
}

describe("CommitContextMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders grouped first-pass commit actions without rewrite actions", () => {
    renderMenu();

    expect(screen.getByText("Commit")).toBeInTheDocument();
    expect(screen.getByText("Copy commit SHA")).toBeInTheDocument();
    expect(screen.getByText("Copy commit message")).toBeInTheDocument();
    expect(screen.getByText("Copy patch")).toBeInTheDocument();

    expect(screen.getByText("Compare")).toBeInTheDocument();
    expect(screen.queryByText("Show commit changes")).not.toBeInTheDocument();
    expect(screen.getByText("Compare with parent...")).toBeInTheDocument();
    expect(screen.getByText("Compare with working tree...")).toBeInTheDocument();

    expect(screen.getByText("Create From Commit")).toBeInTheDocument();
    expect(screen.getByText("Create branch from commit...")).toBeInTheDocument();
    expect(screen.getByText("Create tag at commit...")).toBeInTheDocument();
    expect(screen.getByText("Create worktree from commit...")).toBeInTheDocument();

    expect(screen.getByText("Apply To Current Branch")).toBeInTheDocument();
    expect(screen.getByText("Cherry-pick commit...")).toBeInTheDocument();
    expect(screen.getByText("Revert commit...")).toBeInTheDocument();

    expect(screen.queryByText("Delete commit")).not.toBeInTheDocument();
    expect(screen.queryByText("Undo last commit...")).not.toBeInTheDocument();
    expect(screen.queryByText("Drop commit...")).not.toBeInTheDocument();
    expect(screen.queryByText("Reset current branch to this commit...")).not.toBeInTheDocument();
  });

  it("hides remote actions when no remote commit URL exists", () => {
    renderMenu({ remoteCommitUrl: null });

    expect(screen.queryByText("Remote")).not.toBeInTheDocument();
    expect(screen.queryByText("Open commit on remote")).not.toBeInTheDocument();
    expect(screen.queryByText("Copy commit URL")).not.toBeInTheDocument();
  });

  it("disables apply actions without a current branch", () => {
    const { onAction } = renderMenu({ currentBranch: null });

    fireEvent.click(screen.getByText("Cherry-pick commit..."));
    fireEvent.click(screen.getByText("Revert commit..."));

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText("Cherry-pick commit...")).toHaveAttribute(
      "title",
      "A current branch is required for this operation",
    );
  });

  it("dispatches selected actions", () => {
    const { onAction } = renderMenu();

    fireEvent.click(screen.getByText("Copy patch"));

    expect(onAction).toHaveBeenCalledWith("copyPatch");
  });
});
