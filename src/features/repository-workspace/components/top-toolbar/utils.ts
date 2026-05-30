import type {
  GitPushMode,
  GitWorktree,
  RepositoryState,
} from "@/shared/types/git";
import type { PullStrategy } from "../../stores/workspace-ui-store";
import {
  DETACHED_HEAD_LABEL,
  NO_BRANCH_LABEL,
  PULL_STRATEGIES,
  PUSH_MODES,
} from "./config";

const SHORT_COMMIT_SHA_LENGTH = 7;

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
    PULL_STRATEGIES.find((option) => option.value === "pull-ff-if-possible")
      ?.label ??
    "Pull (fast-forward if possible)"
  );
}

export function getPushModeLabel(mode: GitPushMode) {
  return (
    PUSH_MODES.find((option) => option.value === mode)?.label ??
    PUSH_MODES[0].label
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

export function getDetachedHeadLabel(head: string | null | undefined) {
  return head
    ? `${DETACHED_HEAD_LABEL} @ ${head.slice(0, SHORT_COMMIT_SHA_LENGTH)}`
    : DETACHED_HEAD_LABEL;
}

export function getCurrentBranchLabel({
  currentBranch,
  isDetached,
  repositoryState,
  currentWorktree,
  isLoading,
}: {
  currentBranch: string | null | undefined;
  isDetached: boolean;
  repositoryState: RepositoryState | null;
  currentWorktree: GitWorktree | null;
  isLoading: boolean;
}) {
  if (isDetached || repositoryState?.isDetached || currentWorktree?.isDetached) {
    return getDetachedHeadLabel(currentWorktree?.head);
  }
  if (currentBranch) return currentBranch;
  if (repositoryState?.branch) return repositoryState.branch;
  if (currentWorktree?.branch) return currentWorktree.branch;
  if (isLoading) return "Loading...";

  return NO_BRANCH_LABEL;
}

export function getResolvedCurrentBranch({
  currentBranch,
  isDetached,
  repositoryState,
  currentWorktree,
}: {
  currentBranch: string | null | undefined;
  isDetached: boolean;
  repositoryState: RepositoryState | null;
  currentWorktree: GitWorktree | null;
}) {
  if (isDetached || repositoryState?.isDetached || currentWorktree?.isDetached) {
    return null;
  }

  return currentBranch ?? repositoryState?.branch ?? currentWorktree?.branch ?? null;
}

export function getCreateBaseOptions(currentBranch: string | null | undefined) {
  const options: Array<{ refName: string; label: string }> = [];

  if (currentBranch && currentBranch !== DETACHED_HEAD_LABEL) {
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
