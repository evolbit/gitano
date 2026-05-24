import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommitListItem } from "@/shared/types/git";
import {
  CommitActionDialog,
  commitActionFailureTitle,
  isBranchMutationDialog,
  type CommitDialogState,
} from "./commit-action-dialog";

const commit: CommitListItem = {
  sha: "abcdef123456",
  message: "Add feature",
  author: "Ada",
  author_initial: "A",
  date: 0,
  current_branch: "main",
  source_branch: "main",
  commit_history: [],
  files: 1,
};

describe("CommitActionDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("enables branch creation only after a branch name is entered", () => {
    const onConfirm = vi.fn();
    const dialog: CommitDialogState = { kind: "branch", commit };

    function Harness() {
      const [branchName, setBranchName] = useState("");
      const [tagName, setTagName] = useState("");
      const [tagAnnotated, setTagAnnotated] = useState(false);
      const [tagDescription, setTagDescription] = useState("");
      const [worktreeBranch, setWorktreeBranch] = useState("");
      const [worktreePath, setWorktreePath] = useState("");

      return (
        <CommitActionDialog
          dialog={dialog}
          dialogLoading={false}
          dialogError={null}
          branchName={branchName}
          setBranchName={setBranchName}
          tagName={tagName}
          setTagName={setTagName}
          tagAnnotated={tagAnnotated}
          setTagAnnotated={setTagAnnotated}
          tagDescription={tagDescription}
          setTagDescription={setTagDescription}
          worktreeBranch={worktreeBranch}
          setWorktreeBranch={setWorktreeBranch}
          worktreePath={worktreePath}
          setWorktreePath={setWorktreePath}
          repoPath="/repo"
          selectedBranch="main"
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
    }

    render(<Harness />);

    const confirmButton = screen.getByRole("button", { name: "Create Branch" });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Branch name"), {
      target: { value: "feature/from-commit" },
    });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("classifies branch mutation dialogs and failure titles", () => {
    expect(isBranchMutationDialog("cherryPick")).toBe(true);
    expect(isBranchMutationDialog("branch")).toBe(false);
    expect(commitActionFailureTitle("revert")).toBe("Revert failed");
  });
});
