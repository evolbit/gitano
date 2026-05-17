import type { BranchType } from "../types";

export function filterBranchesByType(
  branches: string[],
  type: BranchType,
  remoteBranches: string[] = [],
) {
  if (type === "remote") return branches;

  const remoteBranchSet = new Set(remoteBranches);
  return branches.filter((branch) => !remoteBranchSet.has(branch));
}
