import type { BranchType } from "../types";

const localBranchPrefixes = [
  "feature/",
  "hotfix/",
  "release/",
  "bugfix/",
  "chore/",
  "test/",
  "fix/",
  "refactor/",
  "task/",
];

export function filterBranchesByType(branches: string[], type: BranchType) {
  if (type === "remote") {
    return branches.filter((branch) => /^\w+\//.test(branch));
  }

  return branches.filter(
    (branch) =>
      !/^\w+\//.test(branch) ||
      localBranchPrefixes.some((prefix) => branch.startsWith(prefix)),
  );
}
