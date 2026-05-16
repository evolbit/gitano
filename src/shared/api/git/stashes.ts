import type { GitStashEntry, StashFileChange } from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export async function listStashes(repoPath: string) {
  return invokeCommand<GitStashEntry[]>("git_stash_list", { path: repoPath });
}

export async function getStashFiles(repoPath: string, stash: string) {
  return invokeCommand<StashFileChange[]>("git_stash_files", {
    path: repoPath,
    stashRef: stash,
  });
}

export async function stashAll(repoPath: string, message: string) {
  return invokeCommand<void>("git_stash_all", { path: repoPath, message });
}

export async function stashSelectedFiles(
  repoPath: string,
  filePaths: string[],
  message: string,
) {
  return invokeCommand<void>("git_stash_selected", {
    path: repoPath,
    filePaths,
    message,
  });
}

export async function applyStash(repoPath: string, stash: string) {
  return invokeCommand<void>("git_stash_apply", { path: repoPath, stashRef: stash });
}

export async function popStash(repoPath: string, stash?: string) {
  return invokeCommand<void>("git_stash_pop", { path: repoPath, stashRef: stash });
}

export async function dropStash(repoPath: string, stash: string) {
  return invokeCommand<void>("git_stash_drop", { path: repoPath, stashRef: stash });
}

export async function applyStashFiles(
  repoPath: string,
  stash: string,
  files: string[],
) {
  return invokeCommand<void>("git_stash_apply_files", {
    path: repoPath,
    stashRef: stash,
    filePaths: files,
  });
}

export async function editStashMessage(
  repoPath: string,
  stash: string,
  message: string,
) {
  return invokeCommand<void>("git_stash_edit_message", {
    path: repoPath,
    stashRef: stash,
    newMessage: message,
  });
}
