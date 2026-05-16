import { invokeCommand } from "@/shared/platform/tauri/command";
import { createGitWorktree, getWorktrees } from "./branches";

export { createGitWorktree, getWorktrees };

export async function removeGitWorktree(
  repoPath: string,
  worktreePath: string,
  force: boolean,
) {
  return invokeCommand<void>("git_remove_worktree", {
    path: repoPath,
    worktreePath,
    force,
  });
}
