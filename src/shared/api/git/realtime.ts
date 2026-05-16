import { invokeCommand } from "@/shared/platform/tauri/command";

export type RepoChangeKind =
  | "working-tree"
  | "index"
  | "head"
  | "branches"
  | "tags"
  | "stashes"
  | "remote-refs"
  | "config";

export type RepoChangedEventPayload = {
  repoPath: string;
  kinds: RepoChangeKind[];
  timestampMs: number;
};

export async function syncRepoWatchers(repoPaths: string[]) {
  return invokeCommand<void>("sync_repo_watchers", { repoPaths });
}
