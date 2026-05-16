import type { DiffHunk, DiffLine } from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export type DiffSource = "working" | "commit" | "stash";

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

export async function getCommitFileDiff(request: GetFileDiffRequest) {
  return invokeCommand<DiffHunk[]>("get_commit_file_diff", request);
}

export async function getStashFileDiff(request: GetFileDiffRequest) {
  return invokeCommand<DiffHunk[]>("get_stash_file_diff", request);
}

export async function getDiffContext(request: GetDiffContextRequest) {
  return invokeCommand<DiffLine[]>("get_diff_context", request);
}
