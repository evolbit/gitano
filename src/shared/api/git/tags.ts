import type {
  GitTagRefsResponse,
  TagCommitOption,
  TagNameAvailability,
} from "@/shared/types/git";
import { invokeCommand } from "@/shared/platform/tauri/command";

export async function getTags(repoPath: string) {
  return invokeCommand<string[]>("get_tags", { path: repoPath });
}

export async function getTagRefs(repoPath: string) {
  return invokeCommand<GitTagRefsResponse>("get_tag_refs", { path: repoPath });
}

export async function getLocalTagRefs(repoPath: string) {
  return invokeCommand<GitTagRefsResponse["tags"]>("get_local_tag_refs", {
    path: repoPath,
  });
}

export async function getOriginTagRefs(repoPath: string) {
  return invokeCommand<GitTagRefsResponse["tags"]>("get_origin_tag_refs", {
    path: repoPath,
  });
}

export async function checkTagNameAvailability(repoPath: string, tagName: string) {
  return invokeCommand<TagNameAvailability>("check_tag_name_availability", {
    path: repoPath,
    tagName,
  });
}

export async function searchTagCommits(repoPath: string, query: string) {
  return invokeCommand<TagCommitOption[]>("search_tag_commits", {
    path: repoPath,
    query,
    limit: 50,
  });
}

export async function pushTag(repoPath: string, tagName: string) {
  return invokeCommand<void>("push_tag", {
    path: repoPath,
    tagName,
  });
}

export async function renameTag(
  repoPath: string,
  oldTagName: string,
  newTagName: string,
) {
  return invokeCommand<void>("rename_tag", {
    path: repoPath,
    oldTagName,
    newTagName,
  });
}

export async function deleteTag(
  repoPath: string,
  tagName: string,
  options: { deleteLocal: boolean; deleteOrigin: boolean },
) {
  return invokeCommand<void>("delete_tag", {
    path: repoPath,
    tagName,
    deleteLocal: options.deleteLocal,
    deleteOrigin: options.deleteOrigin,
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
