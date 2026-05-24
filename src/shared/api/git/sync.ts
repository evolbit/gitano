import { invokeCommand } from "@/shared/platform/tauri/command";

export type PullRepositoryStrategy =
  | "pull-ff-if-possible"
  | "pull-ff-only"
  | "pull-rebase";

export async function fetchAllRemotes(repoPath: string) {
  return invokeCommand<void>("git_fetch", { path: repoPath });
}

export async function pullRepository(
  repoPath: string,
  strategy: PullRepositoryStrategy,
) {
  return invokeCommand<void>("git_pull", { path: repoPath, strategy });
}

export async function pushRepository(repoPath: string) {
  return invokeCommand<void>("git_push", { path: repoPath });
}
