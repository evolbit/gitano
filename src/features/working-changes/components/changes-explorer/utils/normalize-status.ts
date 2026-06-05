import { ChangeType, type FileChange } from "@/shared/types/git";

const ALLOWED_STATUSES: readonly FileChange["status"][] = [
  ChangeType.Added,
  ChangeType.Deleted,
  ChangeType.Modified,
  ChangeType.Renamed,
  ChangeType.Copied,
  ChangeType.TypeChanged,
  ChangeType.Conflicted,
] as const;

export function normalizeStatus(status: string): FileChange["status"] {
  return ALLOWED_STATUSES.includes(status as FileChange["status"])
    ? (status as FileChange["status"])
    : ChangeType.Modified;
}
