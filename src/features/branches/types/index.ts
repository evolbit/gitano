import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";

export type BranchType = "local" | "remote";

export type BranchCreateFormState = {
  baseRef: string;
  prefix: string;
  name: string;
};

export type BranchContextRequest = {
  branchName: string;
  force?: boolean;
  remote?: boolean;
};

export type BranchContextMenuState = {
  x: number;
  y: number;
  node: BranchTreeNode;
};

export type BranchComparisonSelection = {
  sourceBranch: string | null;
  targetBranch: string | null;
};

export type BranchOperationCommand =
  | "git_branch_fast_forward_to_branch"
  | "git_branch_merge_into"
  | "git_branch_rebase_onto";

export type RemoteBranchActionCommand =
  | "git_branch_pull_fast_forward"
  | "git_branch_push"
  | "git_branch_set_upstream";

export type RemoteBranchOperationCommand =
  | "git_branch_merge_remote_into_current"
  | "git_branch_rebase_current_onto_remote";

export type MatchingBranchPullRequest = {
  number: number;
  title: string;
  htmlUrl: string;
  baseRef: string;
  headRef: string;
  baseLabel: string;
  headLabel: string;
};

export type PendingRemoteBranchAction = "pull" | "push";

export type MenuPosition = {
  x: number;
  y: number;
};
