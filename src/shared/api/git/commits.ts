import type {
  CommitDiff,
  CommitGraphWindow,
  CommitHistoryMode,
  CommitHistorySearchResponse,
  CommitHistoryStatusResponse,
  CommitHistoryWindow,
  CommitListPage,
  CommitSearchDirection,
} from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

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

export type PrepareCommitHistoryRequest = {
  path: string;
  historyMode?: CommitHistoryMode;
  forceRefresh?: boolean;
};

export async function prepareCommitHistory(
  request: PrepareCommitHistoryRequest,
) {
  return invokeCommand<CommitHistoryStatusResponse>("prepare_commit_history", {
    path: request.path,
    historyMode: request.historyMode,
    forceRefresh: request.forceRefresh,
  });
}

export type GetCommitHistoryWindowRequest = {
  path: string;
  historyMode?: CommitHistoryMode;
  offset?: number;
  limit?: number;
  anchorSha?: string;
  anchorRowIndex?: number;
};

export async function getCommitHistoryWindow(
  request: GetCommitHistoryWindowRequest,
) {
  return invokeCommand<CommitHistoryWindow>("get_commit_history_window", {
    path: request.path,
    historyMode: request.historyMode,
    offset: request.offset,
    limit: request.limit,
    anchorSha: request.anchorSha,
    anchorRowIndex: request.anchorRowIndex,
  });
}

export type GetCommitGraphWindowRequest = {
  path: string;
  historyMode?: CommitHistoryMode;
  offset?: number;
  limit?: number;
};

export async function getCommitGraphWindow(
  request: GetCommitGraphWindowRequest,
) {
  return invokeCommand<CommitGraphWindow>("get_commit_graph_window", {
    path: request.path,
    historyMode: request.historyMode,
    offset: request.offset,
    limit: request.limit,
  });
}

export type SearchCommitHistoryRequest = {
  path: string;
  historyMode?: CommitHistoryMode;
  query: string;
  currentRowIndex?: number;
  direction?: CommitSearchDirection;
};

export async function searchCommitHistory(
  request: SearchCommitHistoryRequest,
) {
  return invokeCommand<CommitHistorySearchResponse>("search_commit_history", {
    path: request.path,
    historyMode: request.historyMode,
    query: request.query,
    currentRowIndex: request.currentRowIndex,
    direction: request.direction,
  });
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
