import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
} from "@/shared/types/git-conflicts";
import type { GitConflictFileDetail } from "@/shared/types/git-conflicts";

function conflictKindLabels(detail: GitConflictFileDetail) {
  return detail.conflictKinds.length
    ? detail.conflictKinds
    : [GIT_CONFLICT_KIND.Unsupported];
}

export function getConflictMetadataMessage(detail: GitConflictFileDetail) {
  if (detail.contentKind === GIT_CONFLICT_CONTENT_KIND.Binary) {
    return "Binary conflict. Choose a side when available or resolve in an external editor.";
  }
  if (detail.contentKind === GIT_CONFLICT_CONTENT_KIND.Symlink) {
    return "Symlink conflict. Choose a side when available or resolve in an external editor.";
  }
  if (detail.contentKind === GIT_CONFLICT_CONTENT_KIND.Submodule) {
    return "Submodule conflict. Resolve the submodule pointer outside the text editor.";
  }

  if (detail.conflictKinds.includes(GIT_CONFLICT_KIND.AddAdd)) {
    return "Add/add conflict. Both sides added this path independently.";
  }
  if (detail.conflictKinds.includes(GIT_CONFLICT_KIND.DeletedByIncoming)) {
    return "Incoming deleted this file. Use Incoming File to accept deletion or Current File to keep it.";
  }
  if (detail.conflictKinds.includes(GIT_CONFLICT_KIND.DeletedByCurrent)) {
    return "Current deleted this file. Use Current File to accept deletion or Incoming File to keep it.";
  }
  if (detail.conflictKinds.includes(GIT_CONFLICT_KIND.MissingStage)) {
    return "Conflict stages are incomplete. Refresh or resolve this file externally.";
  }
  if (detail.conflictKinds.includes(GIT_CONFLICT_KIND.Unsupported)) {
    return "Unsupported conflict shape. Resolve this file externally.";
  }

  return "Text conflict. Edit the result or accept a side.";
}

export function getConflictMetadataLabels(detail: GitConflictFileDetail) {
  return conflictKindLabels(detail);
}
