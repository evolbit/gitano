import { BranchName } from "../branch-name/branch-name";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "../branch-context-menu-parts/branch-context-menu-parts";

type BranchContextMenuDangerZoneProps = {
  branchName: string;
  localBranchActionDisabledReason: string | null;
  localBranchActionClass: string;
  onRequestRenameBranch: (branchName: string) => void;
  onRequestDeleteBranch: (branchName: string, force: boolean) => void;
};

export function BranchContextMenuDangerZone({
  branchName,
  localBranchActionDisabledReason,
  localBranchActionClass,
  onRequestRenameBranch,
  onRequestDeleteBranch,
}: BranchContextMenuDangerZoneProps) {
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
