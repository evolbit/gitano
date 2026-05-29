import type {
  GitPushMode,
  WorkingDirectoryChangesResponse,
  WorkingDirectorySummaryResponse,
  WorkingFileDetailResponse,
} from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export async function getWorkingDirectoryChanges(repoPath: string) {
  return invokeCommand<WorkingDirectoryChangesResponse>(
    "get_working_directory_changes",
    { path: repoPath },
  );
}

export async function getWorkingDirectorySummary(repoPath: string) {
  return invokeCommand<WorkingDirectorySummaryResponse>(
    "get_working_directory_summary",
    { path: repoPath },
  );
}

export async function getWorkingFileDetail(repoPath: string, filePath: string) {
  return invokeCommand<WorkingFileDetailResponse>("get_working_file_detail", {
    path: repoPath,
    filePath,
  });
}

export async function hasStagedChanges(repoPath: string) {
  return invokeCommand<boolean>("git_has_staged_changes", { path: repoPath });
}

export async function commitStagedChanges(
  repoPath: string,
  message: string,
  amend = false,
) {
  return invokeCommand<void>("git_commit", { path: repoPath, message, amend });
}

export async function pushRepository(
  repoPath: string,
  mode: GitPushMode = "push-branch",
) {
  return invokeCommand<void>("git_push", { path: repoPath, mode });
}

export async function stageAll(repoPath: string) {
  return invokeCommand<void>("git_stage_all", { path: repoPath });
}

export async function unstageAll(repoPath: string) {
  return invokeCommand<void>("git_unstage_all", { path: repoPath });
}

export async function stageFile(repoPath: string, filePath: string) {
  return invokeCommand<void>("git_add_file", { path: repoPath, filePath });
}

export async function stageFiles(repoPath: string, filePaths: string[]) {
  return invokeCommand<void>("git_stage_paths", { path: repoPath, filePaths });
}

export async function unstageFile(repoPath: string, filePath: string) {
  return invokeCommand<void>("git_unstage_file", { path: repoPath, filePath });
}

export async function unstageFiles(repoPath: string, filePaths: string[]) {
  return invokeCommand<void>("git_unstage_paths", { path: repoPath, filePaths });
}

export async function stageLines(
  repoPath: string,
  filePath: string,
  hunks: Record<number, number[]>,
) {
  return invokeCommand<void>("git_stage_lines", {
    path: repoPath,
    filePath,
    hunks,
  });
}

export async function discardFileChanges(repoPath: string, filePath: string) {
  return invokeCommand<void>("git_discard_file_changes", {
    path: repoPath,
    filePath,
  });
}

export async function trashUntrackedFile(repoPath: string, filePath: string) {
  return invokeCommand<void>("trash_untracked_file", {
    path: repoPath,
    filePath,
  });
}
