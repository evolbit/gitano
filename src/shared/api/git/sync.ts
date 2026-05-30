import type { GitFetchMode, GitPushMode } from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export type PullRepositoryStrategy =
  | "pull-ff-if-possible"
  | "pull-ff-only"
  | "pull-rebase";

export async function fetchAllRemotes(
  repoPath: string,
  mode: GitFetchMode = "fetch-all",
) {
  return invokeCommand<void>("git_fetch", { path: repoPath, mode });
}

export async function hasRemoteRefUpdates(repoPath: string) {
  return invokeCommand<boolean>("git_remote_refs_changed", { path: repoPath });
}

export async function pullRepository(
  repoPath: string,
  strategy: PullRepositoryStrategy,
) {
  return invokeCommand<void>("git_pull", { path: repoPath, strategy });
}

export async function pushRepository(
  repoPath: string,
  mode: GitPushMode = "push-branch",
) {
  return invokeCommand<void>("git_push", { path: repoPath, mode });
}
