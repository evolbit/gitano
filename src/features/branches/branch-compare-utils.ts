export type BranchTargetSection = "local" | "remote";

export type BranchTargetOption = {
  name: string;
  section: BranchTargetSection;
};

const DEFAULT_BASE_BRANCH_PRIORITY = [
  "main",
  "master",
  "develop",
  "development",
  "dev",
  "origin/main",
  "origin/master",
  "origin/develop",
  "origin/development",
  "origin/dev",
];

function findBranchByName(branches: string[], branchName: string) {
  const normalizedBranchName = branchName.toLowerCase();
  return branches.find(
    (branch) => branch.toLowerCase() === normalizedBranchName,
  );
}

export function buildBranchTargetOptions({
  localBranches,
  remoteBranches,
  sourceBranch,
}: {
  localBranches: string[];
  remoteBranches: string[];
  sourceBranch: string;
}) {
  const normalizedSource = sourceBranch.toLowerCase();
  const toOption = (
    section: BranchTargetSection,
    name: string,
  ): BranchTargetOption => ({ section, name });
  const localOptions = localBranches
    .filter((branch) => branch.toLowerCase() !== normalizedSource)
    .map((branch) => toOption("local", branch));
  const remoteOptions = remoteBranches
    .filter((branch) => branch.toLowerCase() !== normalizedSource)
    .map((branch) => toOption("remote", branch));

  return [...localOptions, ...remoteOptions];
}

export function getDefaultBranchComparisonBase({
  currentBranch,
  localBranches,
  remoteBranches,
  sourceBranch,
}: {
  currentBranch?: string | null;
  localBranches: string[];
  remoteBranches: string[];
  sourceBranch: string;
}) {
  const normalizedSource = sourceBranch.toLowerCase();
  const allBranches = [...localBranches, ...remoteBranches];
  const currentBranchMatch = currentBranch
    ? findBranchByName(allBranches, currentBranch)
    : undefined;

  if (
    currentBranchMatch &&
    currentBranchMatch.toLowerCase() !== normalizedSource
  ) {
    return currentBranchMatch;
  }

  for (const branchName of DEFAULT_BASE_BRANCH_PRIORITY) {
    const branch = findBranchByName(allBranches, branchName);
    if (branch && branch.toLowerCase() !== normalizedSource) {
      return branch;
    }
  }

  return (
    localBranches.find((branch) => branch.toLowerCase() !== normalizedSource) ??
    remoteBranches.find((branch) => branch.toLowerCase() !== normalizedSource) ??
    null
  );
}
