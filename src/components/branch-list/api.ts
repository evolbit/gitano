import { core } from "@tauri-apps/api";
import type { GitWorktree } from "../../types/git";
import type {
  BranchOperationCommand,
  BranchType,
  RemoteBranchActionCommand,
} from "./types";

export async function getBranches(repoPath: string, type: BranchType) {
  const command = type === "local" ? "get_branches" : "get_remote_branches";
  return core.invoke<string[]>(command, { path: repoPath });
}

export async function createGitBranch(
  repoPath: string,
  branchName: string,
  baseRef: string,
) {
  return core.invoke("git_create_branch", {
    path: repoPath,
    branchName,
    baseRef,
  });
}

export async function getCurrentBranch(repoPath: string) {
  return core.invoke<string>("get_current_branch", { path: repoPath });
}

export async function checkoutGitBranch(repoPath: string, branchName: string) {
  return core.invoke("git_checkout_branch", {
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
  return core.invoke(command, {
    path: repoPath,
    targetBranch,
    sourceBranch,
  });
}

export async function getBranchTipSha(repoPath: string, branchName: string) {
  return core.invoke<string>("git_branch_tip_sha", {
    path: repoPath,
    branchName,
  });
}

export async function renameGitBranch(
  repoPath: string,
  oldBranchName: string,
  newBranchName: string,
) {
  return core.invoke("git_rename_branch", {
    path: repoPath,
    oldBranchName,
    newBranchName,
  });
}

export async function deleteGitBranch(repoPath: string, branchName: string) {
  return core.invoke("git_delete_branch", {
    path: repoPath,
    branchName,
  });
}

export async function runRemoteBranchAction(
  repoPath: string,
  command: RemoteBranchActionCommand,
  branchName: string,
) {
  return core.invoke(command, {
    path: repoPath,
    branchName,
  });
}

export async function getWorktrees(repoPath: string) {
  return core.invoke<GitWorktree[]>("get_worktrees", { path: repoPath });
}

export async function createGitWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseRef: string,
) {
  return core.invoke<GitWorktree>("git_create_worktree", {
    path: repoPath,
    worktreePath,
    branch,
    baseRef,
  });
}
