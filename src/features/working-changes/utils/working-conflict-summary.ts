import { ChangeType, type WorkingChangeFileSummary } from "@/shared/types/git";
import type { GitConflictSummary } from "@/shared/types/git-conflicts";

const CONFLICT_INSERTION_COUNT = 0;
const CONFLICT_DELETION_COUNT = 0;
const CONFLICT_IS_UNTRACKED = false;

export type WorkingConflictFileSummary = Omit<
  WorkingChangeFileSummary,
  "isUntracked" | "status"
> &
  Omit<GitConflictSummary, "status"> & {
    status: ChangeType.Conflicted;
    isUntracked: false;
  };

export type WorkingChangeSummaryFile =
  | WorkingChangeFileSummary
  | WorkingConflictFileSummary;

export function conflictSummaryToWorkingFile(
  conflict: GitConflictSummary,
): WorkingConflictFileSummary {
  return {
    ...conflict,
    status: ChangeType.Conflicted,
    insertions: CONFLICT_INSERTION_COUNT,
    deletions: CONFLICT_DELETION_COUNT,
    isUntracked: CONFLICT_IS_UNTRACKED,
  };
}

export function mergeWorkingChangeSummaries(
  changes: WorkingChangeFileSummary[],
  conflicts: GitConflictSummary[],
): WorkingChangeSummaryFile[] {
  const conflictPaths = new Set(conflicts.map((conflict) => conflict.path));
  const nonConflictingChanges = changes.filter(
    (change) => !conflictPaths.has(change.path),
  );

  return [
    ...conflicts.map(conflictSummaryToWorkingFile),
    ...nonConflictingChanges,
  ];
}
