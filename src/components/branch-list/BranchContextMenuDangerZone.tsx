import { BranchName } from "./BranchName";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "./BranchContextMenuParts";

type BranchContextMenuDangerZoneProps = {
  branchName: string;
  localBranchActionDisabledReason: string | null;
  localBranchActionClass: string;
  onRequestRenameBranch: (branchName: string) => void;
  onRequestDeleteBranch: (branchName: string) => void;
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
          onRequestDeleteBranch(branchName);
        }}
      >
        Delete <BranchName>{branchName}</BranchName>
      </BranchContextMenuItem>
    </>
  );
}
