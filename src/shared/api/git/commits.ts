import type { CommitDiff, CommitListPage } from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export type CommitHistoryMode = "git_log" | "first_parent";

export type GetCommitsListRequest = {
  path: string;
  branch?: string | null;
  search?: string;
  offset?: number;
  limit?: number;
  mode?: CommitHistoryMode;
  forceRefresh?: boolean;
};

export async function getCommitsListPaginated(request: GetCommitsListRequest) {
  return invokeCommand<CommitListPage>("get_commits_list_paginated", request);
}

export async function getCommitDiff(repoPath: string, sha: string) {
  return invokeCommand<CommitDiff>("get_commit_diff", {
    path: repoPath,
    sha,
  });
}

export async function amendCommitMessage(
  repoPath: string,
  sha: string,
  newMessage: string,
) {
  return invokeCommand<void>("amend_commit_message", {
    path: repoPath,
    sha,
    newMessage,
  });
}

export async function getCommitPatch(repoPath: string, sha: string) {
  return invokeCommand<string>("git_commit_patch", {
    path: repoPath,
    sha,
  });
}

export async function cherryPickCommit(repoPath: string, sha: string) {
  return invokeCommand<void>("git_cherry_pick_commit", {
    path: repoPath,
    sha,
  });
}

export async function revertCommit(repoPath: string, sha: string) {
  return invokeCommand<void>("git_revert_commit", {
    path: repoPath,
    sha,
  });
}

export async function getRemoteUrl(repoPath: string, remoteName = "origin") {
  return invokeCommand<string | null>("get_remote_url", {
    path: repoPath,
    remoteName,
  });
}
