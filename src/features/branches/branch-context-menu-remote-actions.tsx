import type {
  PendingRemoteBranchAction,
  RemoteBranchActionCommand,
} from "./types";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "./branch-context-menu-parts";

type BranchContextMenuRemoteActionsProps = {
  branchName: string;
  disabledReason: string | null;
  itemClass: string;
  onRunRemoteAction: (
    command: RemoteBranchActionCommand,
    pendingAction: PendingRemoteBranchAction,
    successTitle: string,
    successDetails: string,
    failureTitle: string,
  ) => void;
};

export function BranchContextMenuRemoteActions({
  branchName,
  disabledReason,
  itemClass,
  onRunRemoteAction,
}: BranchContextMenuRemoteActionsProps) {
  return (
    <>
      <BranchContextMenuSectionTitle>Remote actions</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() =>
          onRunRemoteAction(
            "git_branch_pull_fast_forward",
            "pull",
            "git pull succeeded",
            `Fast-forwarded ${branchName} from its upstream.`,
            "git pull failed",
          )
        }
      >
        Pull (fast-forward if possible)
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() =>
          onRunRemoteAction(
            "git_branch_push",
            "push",
            "git push succeeded",
            `Pushed ${branchName} to origin/${branchName}.`,
            "git push failed",
          )
        }
      >
        Push
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() =>
          onRunRemoteAction(
            "git_branch_set_upstream",
            "push",
            "git push --set-upstream succeeded",
            `Set upstream for ${branchName} to origin/${branchName}.`,
            "git push --set-upstream failed",
          )
        }
      >
        Set Upstream
      </BranchContextMenuItem>
    </>
  );
}
