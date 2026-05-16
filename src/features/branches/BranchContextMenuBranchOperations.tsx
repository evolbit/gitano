import { BranchName } from "./BranchName";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "./BranchContextMenuParts";
import type { BranchOperationCommand } from "./types";

type BranchContextMenuBranchOperationsProps = {
  branchName: string;
  selectedBranch?: string | null;
  currentBranchLabel: string;
  disabledReason: string | null;
  itemClass: string;
  onRunBranchOperation: (
    command: BranchOperationCommand,
    targetBranch: string,
    successTitle: string,
    successDetails: string,
    failureTitle: string,
    selectedRowAfter: string | null,
  ) => void;
};

export function BranchContextMenuBranchOperations({
  branchName,
  selectedBranch,
  currentBranchLabel,
  disabledReason,
  itemClass,
  onRunBranchOperation,
}: BranchContextMenuBranchOperationsProps) {
  return (
    <>
      <BranchContextMenuSectionTitle>Branch operations</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (disabledReason || !selectedBranch) return;
          onRunBranchOperation(
            "git_branch_fast_forward_to_branch",
            branchName,
            "Fast-forward succeeded",
            `Fast-forwarded ${branchName} to ${selectedBranch}.`,
            "Fast-forward failed",
            branchName,
          );
        }}
      >
        Fast-forward <BranchName>{branchName}</BranchName> to{" "}
        <BranchName>{currentBranchLabel}</BranchName>
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (disabledReason || !selectedBranch) return;
          onRunBranchOperation(
            "git_branch_merge_into",
            branchName,
            "Merge succeeded",
            `Merged ${selectedBranch} into ${branchName}.`,
            "Merge failed",
            branchName,
          );
        }}
      >
        Merge <BranchName>{currentBranchLabel}</BranchName> into{" "}
        <BranchName>{branchName}</BranchName>
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (disabledReason || !selectedBranch) return;
          onRunBranchOperation(
            "git_branch_rebase_onto",
            branchName,
            "Rebase succeeded",
            `Rebased ${branchName} onto ${selectedBranch}.`,
            "Rebase failed",
            branchName,
          );
        }}
      >
        Rebase <BranchName>{branchName}</BranchName> onto{" "}
        <BranchName>{currentBranchLabel}</BranchName>
      </BranchContextMenuItem>
    </>
  );
}
