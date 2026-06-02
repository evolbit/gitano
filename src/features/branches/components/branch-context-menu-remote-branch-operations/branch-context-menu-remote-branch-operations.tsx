import { BranchName } from "../branch-name/branch-name";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "../branch-context-menu-parts/branch-context-menu-parts";
import type { RemoteBranchOperationCommand } from "../../types";

type BranchContextMenuRemoteBranchOperationsProps = {
  remoteBranchName: string;
  currentBranchLabel: string;
  disabledReason: string | null;
  itemClass: string;
  onRunRemoteBranchOperation: (
    command: RemoteBranchOperationCommand,
    remoteBranchName: string,
    successTitle: string,
    successDetails: string,
    failureTitle: string,
  ) => void;
};

export function BranchContextMenuRemoteBranchOperations({
  remoteBranchName,
  currentBranchLabel,
  disabledReason,
  itemClass,
  onRunRemoteBranchOperation,
}: BranchContextMenuRemoteBranchOperationsProps) {
  return (
    <>
      <BranchContextMenuSectionTitle>Branch operations</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (disabledReason) return;
          onRunRemoteBranchOperation(
            "git_branch_merge_remote_into_current",
            remoteBranchName,
            "Merge succeeded",
            `Merged ${remoteBranchName} into ${currentBranchLabel}.`,
            "Merge failed",
          );
        }}
      >
        Merge <BranchName>{remoteBranchName}</BranchName> into{" "}
        <BranchName>{currentBranchLabel}</BranchName>
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (disabledReason) return;
          onRunRemoteBranchOperation(
            "git_branch_rebase_current_onto_remote",
            remoteBranchName,
            "Rebase succeeded",
            `Rebased ${currentBranchLabel} onto ${remoteBranchName}.`,
            "Rebase failed",
          );
        }}
      >
        Rebase <BranchName>{currentBranchLabel}</BranchName> onto{" "}
        <BranchName>{remoteBranchName}</BranchName>
      </BranchContextMenuItem>
    </>
  );
}
