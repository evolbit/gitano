import { BranchName } from "../branch-name/branch-name";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "../branch-context-menu-parts/branch-context-menu-parts";

type BranchContextMenuWorktreeActionsProps = {
  branchName: string;
  worktreeBaseRef: string;
  localBranchActionDisabledReason: string | null;
  localBranchActionClass: string;
  createWorktreeDisabledReason: string | null;
  createWorktreeActionClass: string;
  creatingWorktree: boolean;
  onCheckoutBranch: (branchName: string) => void;
  onCreateRandomWorktreeFromBranch: (branchName: string) => void;
};

export function BranchContextMenuWorktreeActions({
  branchName,
  worktreeBaseRef,
  localBranchActionDisabledReason,
  localBranchActionClass,
  createWorktreeDisabledReason,
  createWorktreeActionClass,
  creatingWorktree,
  onCheckoutBranch,
  onCreateRandomWorktreeFromBranch,
}: BranchContextMenuWorktreeActionsProps) {
  return (
    <>
      <BranchContextMenuSectionTitle>Worktree</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className={localBranchActionClass}
        title={localBranchActionDisabledReason ?? undefined}
        onClick={() => {
          if (localBranchActionDisabledReason) return;
          onCheckoutBranch(branchName);
        }}
      >
        Checkout <BranchName>{branchName}</BranchName>
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={createWorktreeActionClass}
        title={createWorktreeDisabledReason ?? undefined}
        onClick={() => {
          if (createWorktreeDisabledReason) return;
          onCreateRandomWorktreeFromBranch(worktreeBaseRef);
        }}
      >
        {creatingWorktree ? "Creating worktree..." : "Create worktree from"}{" "}
        <BranchName>{branchName}</BranchName>
      </BranchContextMenuItem>
    </>
  );
}
