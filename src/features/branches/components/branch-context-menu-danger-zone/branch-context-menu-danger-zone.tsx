import { BranchName } from "../branch-name/branch-name";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "../branch-context-menu-parts/branch-context-menu-parts";

type BranchContextMenuDangerZoneProps = {
  branchName: string;
  remoteBranchName: string | null;
  localBranchActionDisabledReason: string | null;
  localBranchActionClass: string;
  onRequestRenameBranch: (branchName: string) => void;
  onRequestDeleteBranch: (branchName: string, force: boolean) => void;
  onRequestDeleteRemoteBranch: (branchName: string) => void;
};

export function BranchContextMenuDangerZone({
  branchName,
  remoteBranchName,
  localBranchActionDisabledReason,
  localBranchActionClass,
  onRequestRenameBranch,
  onRequestDeleteBranch,
  onRequestDeleteRemoteBranch,
}: BranchContextMenuDangerZoneProps) {
  if (remoteBranchName) {
    return (
      <>
        <BranchContextMenuSectionTitle>Danger zone</BranchContextMenuSectionTitle>
        <BranchContextMenuItem
          className="px-4 py-2 hover:bg-zinc-700 cursor-pointer text-red-400"
          onClick={() => onRequestDeleteRemoteBranch(remoteBranchName)}
        >
          Delete <BranchName>{remoteBranchName}</BranchName>...
        </BranchContextMenuItem>
      </>
    );
  }

  return (
    <>
      <BranchContextMenuSectionTitle>Danger zone</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className={localBranchActionClass}
        title={localBranchActionDisabledReason ?? undefined}
        onClick={() => {
          if (localBranchActionDisabledReason) return;
          onRequestRenameBranch(branchName);
        }}
      >
        Rename <BranchName>{branchName}</BranchName>
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={
          localBranchActionDisabledReason
            ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
            : "px-4 py-2 hover:bg-zinc-700 cursor-pointer text-red-400"
        }
        title={localBranchActionDisabledReason ?? undefined}
        onClick={() => {
          if (localBranchActionDisabledReason) return;
          onRequestDeleteBranch(branchName, false);
        }}
      >
        Delete <BranchName>{branchName}</BranchName>
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={
          localBranchActionDisabledReason
            ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
            : "px-4 py-2 hover:bg-zinc-700 cursor-pointer text-red-300"
        }
        title={localBranchActionDisabledReason ?? undefined}
        onClick={() => {
          if (localBranchActionDisabledReason) return;
          onRequestDeleteBranch(branchName, true);
        }}
      >
        Force delete <BranchName>{branchName}</BranchName>
      </BranchContextMenuItem>
    </>
  );
}
