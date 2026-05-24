import type { GitWorktree } from "@/shared/types/git";
import type { PullStrategy } from "../../stores/workspace-ui-store";
import { PULL_STRATEGIES } from "./config";

export function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function getPullStrategyLabel(strategy: PullStrategy) {
  return (
    PULL_STRATEGIES.find((option) => option.value === strategy)?.label ??
    PULL_STRATEGIES[1].label
  );
}

export function getPathBasename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

export function getWorktreeDisplayName(worktree: GitWorktree) {
  if (worktree.isMain) return "main worktree";
  return worktree.name || getPathBasename(worktree.path) || "worktree";
}

export function getWorktreeTargetLabel(
  worktree: GitWorktree | null,
  repoPath?: string,
) {
  if (worktree) {
    return worktree.isMain ? "main" : getWorktreeDisplayName(worktree);
  }

  return repoPath ? getPathBasename(repoPath) : "No workspace";
}

export function getCreateBaseOptions(currentBranch: string | null | undefined) {
  const options: Array<{ refName: string; label: string }> = [];

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
