import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import type { GitTagRef } from "@/shared/types/git";

export type TagsPanelProps = {
  repoPath: string;
};

export type TagContextMenu = {
  x: number;
  y: number;
  node: BranchTreeNode;
};

export type TagActionLoading = {
  kind: "push" | "rename" | "delete";
  tagName: string;
};

export type RenameDialogState = {
  tag: GitTagRef;
  value: string;
};

export type DeleteDialogState = {
  tag: GitTagRef;
  deleteOrigin: boolean;
};
