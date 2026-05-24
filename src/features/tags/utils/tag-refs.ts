import type { GitTagRef, TagRefStatus } from "@/shared/types/git";

export function getTagStatusLabel(status: TagRefStatus) {
  switch (status) {
    case "local-origin":
      return "Local · Origin";
    case "local":
      return "Local";
    case "origin":
      return "Origin";
    case "conflict":
      return "Conflict";
    case "unknown":
      return "Unknown";
  }
}

export function canPushTag(tag: GitTagRef) {
  return tag.status === "local";
}

export function canRenameTag(tag: GitTagRef) {
  return tag.localObjectId !== null;
}

export function canDeleteLocalTag(tag: GitTagRef) {
  return tag.localObjectId !== null;
}

export function canDeleteOriginTag(tag: GitTagRef) {
  return tag.originObjectId !== null;
}
