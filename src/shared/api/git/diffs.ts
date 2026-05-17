import type { DiffHunk, DiffLine, FileChange } from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export type DiffSource = "working" | "commit" | "stash";
export type BranchComparisonMode = "direct" | "mergeBase";

export type GetDiffContextRequest = {
  path: string;
  filePath: string;
  hunkIndex: number;
  direction: "Above" | "Below";
  lines: number;
  context: number;
  offset: number;
};

export type GetFileDiffRequest = {
  path: string;
  filePath: string;
  context: number;
  sha?: string;
};

export type GetBranchComparisonFilesRequest = {
  path: string;
  baseRef: string;
  headRef: string;
  comparisonMode?: BranchComparisonMode;
};

export type GetBranchComparisonFileDiffRequest =
  GetBranchComparisonFilesRequest & {
    filePath: string;
    context: number;
  };

export async function getCommitFileDiff(request: GetFileDiffRequest) {
  return invokeCommand<DiffHunk[]>("get_commit_file_diff", request);
}

export async function getStashFileDiff(request: GetFileDiffRequest) {
  return invokeCommand<DiffHunk[]>("get_stash_file_diff", request);
}

export async function getDiffContext(request: GetDiffContextRequest) {
  return invokeCommand<DiffLine[]>("get_diff_context", request);
}

export async function getBranchComparisonFiles(
  request: GetBranchComparisonFilesRequest,
) {
  return invokeCommand<FileChange[]>("get_branch_comparison_files", request);
}

export async function getBranchComparisonFileDiff(
  request: GetBranchComparisonFileDiffRequest,
) {
  return invokeCommand<DiffHunk[]>("get_branch_comparison_file_diff", request);
}
