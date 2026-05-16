import type { GitWorktree } from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export type BranchListType = "local" | "remote";

export type BranchOperationCommand =
  | "git_branch_fast_forward_to_branch"
  | "git_branch_merge_into"
  | "git_branch_rebase_onto";

export type RemoteBranchActionCommand =
  | "git_branch_pull_fast_forward"
  | "git_branch_push"
  | "git_branch_set_upstream";

export async function getBranches(repoPath: string, type: BranchListType) {
  const command = type === "local" ? "get_branches" : "get_remote_branches";
  return invokeCommand<string[]>(command, { path: repoPath });
}

export async function createGitBranch(
  repoPath: string,
  branchName: string,
  baseRef: string,
) {
  return invokeCommand<void>("git_create_branch", {
    path: repoPath,
    branchName,
    baseRef,
  });
}

export async function getCurrentBranch(repoPath: string) {
  return invokeCommand<string>("get_current_branch", { path: repoPath });
}

export async function checkoutGitBranch(repoPath: string, branchName: string) {
  return invokeCommand<void>("git_checkout_branch", {
    path: repoPath,
    branchName,
  });
}

export async function runGitBranchOperation(
  repoPath: string,
  command: BranchOperationCommand,
  targetBranch: string,
  sourceBranch: string,
) {
  return invokeCommand<void>(command, {
    path: repoPath,
    targetBranch,
    sourceBranch,
  });
}

export async function getBranchTipSha(repoPath: string, branchName: string) {
  return invokeCommand<string>("git_branch_tip_sha", {
    path: repoPath,
    branchName,
  });
}

export async function renameGitBranch(
  repoPath: string,
  oldBranchName: string,
  newBranchName: string,
) {
  return invokeCommand<void>("git_rename_branch", {
    path: repoPath,
    oldBranchName,
    newBranchName,
  });
}

export async function deleteGitBranch(repoPath: string, branchName: string) {
  return invokeCommand<void>("git_delete_branch", {
    path: repoPath,
    branchName,
  });
}

export async function runRemoteBranchAction(
  repoPath: string,
  command: RemoteBranchActionCommand,
  branchName: string,
) {
  return invokeCommand<void>(command, {
    path: repoPath,
    branchName,
  });
}

export async function getWorktrees(repoPath: string) {
  return invokeCommand<GitWorktree[]>("get_worktrees", { path: repoPath });
}

export async function createGitWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseRef: string,
) {
  return invokeCommand<GitWorktree>("git_create_worktree", {
    path: repoPath,
    worktreePath,
    branch,
    baseRef,
  });
}
