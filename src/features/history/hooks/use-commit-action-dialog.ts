import {
  useCallback,
  useState,
} from "react";
import { buildDefaultWorktreeFolder } from "@/features/worktrees";
import { createGitBranch, createGitWorktree } from "@/shared/api/git/branches";
import { cherryPickCommit, revertCommit } from "@/shared/api/git/commits";
import { createTag } from "@/shared/api/git/tags";
import type { CommitListItem } from "@/shared/types/git";
import {
  commitActionFailureTitle,
  isBranchMutationDialog,
} from "../components/commit-list/components/commit-action-dialog/commit-action-dialog";
import type { CommitDialogState } from "../types/commit-list";

type UseCommitActionDialogParams = {
  notifyError: (title: string, actionError: unknown) => void;
  notifySuccess: (title: string, details: string) => void;
  refreshRepositorySurfaces: () => void;
  repoPath?: string | null;
  selectedBranch?: string | null;
};

export function useCommitActionDialog({
  notifyError,
  notifySuccess,
  refreshRepositorySurfaces,
  repoPath,
  selectedBranch,
}: UseCommitActionDialogParams) {
  const [dialog, setDialog] = useState<CommitDialogState | null>(null);
  const [branchName, setBranchName] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagAnnotated, setTagAnnotated] = useState(false);
  const [tagDescription, setTagDescription] = useState("");
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [worktreePath, setWorktreePath] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const openCommitDialog = useCallback(
    (kind: CommitDialogState["kind"], commit: CommitListItem) => {
      const shortSha = commit.sha.slice(0, 7);
      setDialog({ kind, commit });
      setDialogError(null);
      setBranchName(`commit-${shortSha}`);
      setTagName("");
      setTagAnnotated(false);
      setTagDescription("");
      setWorktreeBranch(`commit-${shortSha}`);
      setWorktreePath(
        buildDefaultWorktreeFolder(repoPath ?? "", `commit-${shortSha}`),
      );
    },
    [repoPath],
  );

  const closeDialog = useCallback(() => {
    if (dialogLoading) return;
    setDialog(null);
    setDialogError(null);
  }, [dialogLoading]);

  const handleConfirmDialog = useCallback(async () => {
    if (!dialog || !repoPath || dialogLoading) return;

    const { commit } = dialog;
    setDialogLoading(true);
    setDialogError(null);

    try {
      switch (dialog.kind) {
        case "branch": {
          const nextBranchName = branchName.trim();
          await createGitBranch(repoPath, nextBranchName, commit.sha);
          notifySuccess(
            "Created branch",
            `Created ${nextBranchName} from ${commit.sha.slice(0, 12)}.`,
          );
          break;
        }
        case "tag": {
          const nextTagName = tagName.trim();
          await createTag(
            repoPath,
            nextTagName,
            commit.sha,
            tagAnnotated,
            tagAnnotated ? tagDescription.trim() : null,
          );
          notifySuccess(
            "Created tag",
            `Created ${nextTagName} at ${commit.sha.slice(0, 12)}.`,
          );
          break;
        }
        case "worktree": {
          const nextBranch = worktreeBranch.trim();
          const nextPath = worktreePath.trim();
          await createGitWorktree(repoPath, nextPath, nextBranch, commit.sha);
          notifySuccess(
            "Created worktree",
            `Created ${nextBranch} from ${commit.sha.slice(0, 12)} at ${nextPath}.`,
          );
          break;
        }
        case "cherryPick":
          await cherryPickCommit(repoPath, commit.sha);
          notifySuccess(
            "Cherry-pick succeeded",
            `Cherry-picked ${commit.sha.slice(0, 12)} onto ${selectedBranch}.`,
          );
          break;
        case "revert":
          await revertCommit(repoPath, commit.sha);
          notifySuccess(
            "Revert succeeded",
            `Reverted ${commit.sha.slice(0, 12)} on ${selectedBranch}.`,
          );
          break;
      }

      setDialog(null);
      refreshRepositorySurfaces();
    } catch (operationError) {
      const details =
        operationError instanceof Error
          ? operationError.message
          : String(operationError || "Unknown error");
      setDialogError(details);
      notifyError(commitActionFailureTitle(dialog.kind), operationError);

      if (isBranchMutationDialog(dialog.kind)) {
        refreshRepositorySurfaces();
      }
    } finally {
      setDialogLoading(false);
    }
  }, [
    branchName,
    dialog,
    dialogLoading,
    notifyError,
    notifySuccess,
    refreshRepositorySurfaces,
    repoPath,
    selectedBranch,
    tagAnnotated,
    tagDescription,
    tagName,
    worktreeBranch,
    worktreePath,
  ]);

  return {
    branchName,
    closeDialog,
    dialog,
    dialogError,
    dialogLoading,
    handleConfirmDialog,
    openCommitDialog,
    setBranchName,
    setTagAnnotated,
    setTagDescription,
    setTagName,
    setWorktreeBranch,
    setWorktreePath,
    tagAnnotated,
    tagDescription,
    tagName,
    worktreeBranch,
    worktreePath,
  };
}
