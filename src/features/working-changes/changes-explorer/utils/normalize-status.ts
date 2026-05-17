import type { FileChange } from "@/shared/types/git";

const ALLOWED_STATUSES = [
  "added",
  "deleted",
  "modified",
  "renamed",
  "copied",
  "typeChanged",
] as const;

export function normalizeStatus(status: string): FileChange["status"] {
  return ALLOWED_STATUSES.includes(status as FileChange["status"])
    ? (status as FileChange["status"])
    : "modified";
}
