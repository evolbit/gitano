import type { GitWorktree } from "@/shared/types/git";
import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import { getFileName } from "@/shared/lib/path";

export type CreateBaseOption = {
  refName: string;
  label: string;
};

export function normalizeWorktreeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function getWorktreeDisplayName(worktree: GitWorktree) {
  if (worktree.isMain) return "main worktree";
  return worktree.name || getFileName(worktree.path);
}

export function getWorktreeTreeKey(worktree: GitWorktree) {
  return getWorktreeDisplayName(worktree);
}

export function pinMainWorktreeFirst(
  nodes: BranchTreeNode[],
  mainWorktreeKey: string | null,
) {
  if (!mainWorktreeKey) return nodes;

  return [...nodes].sort((left, right) => {
    if (left.full === mainWorktreeKey) return -1;
    if (right.full === mainWorktreeKey) return 1;
    return 0;
  });
}

export function getCreateBaseOptions(
  currentBranch: string | null | undefined,
): CreateBaseOption[] {
  const options: CreateBaseOption[] = [];

  if (currentBranch && currentBranch !== "Detached HEAD") {
    options.push({
      refName: currentBranch,
      label: `Create new worktree based on ${currentBranch}`,
    });
  }

  if (!options.some((option) => option.refName === "master")) {
    options.push({
      refName: "master",
      label: "Create new worktree based on master",
    });
  }

  return options;
}

