import { invokeCommand } from "@/shared/platform/tauri/command";
import type {
  GitConflictContentRange,
  GitConflictFileDetail,
  GitConflictSide,
  GitConflictSummary,
} from "@/shared/types/git-conflicts";
import { GIT_CONFLICT_STALE_ERROR_MESSAGE } from "@/shared/types/git-conflicts";

export const GIT_CONFLICT_COMMANDS = {
  List: "get_merge_conflicts",
  Detail: "get_merge_conflict_file",
  ContentRange: "get_merge_conflict_content_range",
  WriteResult: "git_write_conflict_result",
  AcceptSide: "git_accept_conflict_side",
  MarkResolved: "git_mark_conflict_resolved",
} as const;

export type GetMergeConflictContentRangeRequest = {
  repoPath: string;
  filePath: string;
  side: GitConflictSide;
  startLine: number;
  lineCount: number;
};

export type WriteConflictResultRequest = {
  repoPath: string;
  filePath: string;
  content: string;
  expectedIndexSignature: string;
  expectedResultSignature: string;
};

export type AcceptConflictSideRequest = {
  repoPath: string;
  filePath: string;
  side: GitConflictSide;
  expectedIndexSignature: string;
  expectedResultSignature: string;
};

export type MarkConflictResolvedRequest = {
  repoPath: string;
  filePath: string;
  expectedIndexSignature: string;
  expectedResultSignature: string;
};

export async function getMergeConflicts(repoPath: string) {
  return invokeCommand<GitConflictSummary[]>(GIT_CONFLICT_COMMANDS.List, {
    path: repoPath,
  });
}

export async function getMergeConflictFile(
  repoPath: string,
  filePath: string,
) {
  return invokeCommand<GitConflictFileDetail>(GIT_CONFLICT_COMMANDS.Detail, {
    path: repoPath,
    filePath,
  });
}

export async function getMergeConflictContentRange(
  request: GetMergeConflictContentRangeRequest,
) {
  return invokeCommand<GitConflictContentRange>(
    GIT_CONFLICT_COMMANDS.ContentRange,
    {
      path: request.repoPath,
      filePath: request.filePath,
      side: request.side,
      startLine: request.startLine,
      lineCount: request.lineCount,
    },
  );
}

export async function writeConflictResult(request: WriteConflictResultRequest) {
  return invokeCommand<GitConflictFileDetail>(GIT_CONFLICT_COMMANDS.WriteResult, {
    path: request.repoPath,
    filePath: request.filePath,
    content: request.content,
    expectedIndexSignature: request.expectedIndexSignature,
    expectedResultSignature: request.expectedResultSignature,
  });
}

export async function acceptConflictSide(request: AcceptConflictSideRequest) {
  return invokeCommand<GitConflictFileDetail>(GIT_CONFLICT_COMMANDS.AcceptSide, {
    path: request.repoPath,
    filePath: request.filePath,
    side: request.side,
    expectedIndexSignature: request.expectedIndexSignature,
    expectedResultSignature: request.expectedResultSignature,
  });
}

export async function markConflictResolved(
  request: MarkConflictResolvedRequest,
) {
  return invokeCommand<void>(GIT_CONFLICT_COMMANDS.MarkResolved, {
    path: request.repoPath,
    filePath: request.filePath,
    expectedIndexSignature: request.expectedIndexSignature,
    expectedResultSignature: request.expectedResultSignature,
  });
}

export function getGitConflictErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

export function isGitConflictStaleError(error: unknown) {
  return getGitConflictErrorMessage(error) === GIT_CONFLICT_STALE_ERROR_MESSAGE;
}
