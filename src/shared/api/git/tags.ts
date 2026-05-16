import type { TagCommitOption } from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export async function getTags(repoPath: string) {
  return invokeCommand<string[]>("get_tags", { path: repoPath });
}

export async function searchTagCommits(repoPath: string, query: string) {
  return invokeCommand<TagCommitOption[]>("search_tag_commits", {
    path: repoPath,
    query,
    limit: 50,
  });
}

export async function createTag(
  repoPath: string,
  tagName: string,
  commitSha: string,
  annotated: boolean,
  description: string | null,
) {
  return invokeCommand<void>("create_tag", {
    path: repoPath,
    tagName,
    commitSha,
    annotated,
    description,
  });
}
