import { BranchName } from "./branch-name";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "./branch-context-menu-parts";

export function BranchContextMenuCompareItems({
  branchName,
  currentBranch,
  disabledReason,
  itemClass,
  onCompareBranch,
  onCloseMenus,
}: {
  branchName: string;
  currentBranch: string | null;
  disabledReason: string | null;
  itemClass: string;
  onCompareBranch: (comparison: {
    sourceBranch: string | null;
    targetBranch: string | null;
  }) => void;
  onCloseMenus: () => void;
}) {
  const currentBranchLabel = currentBranch ?? "current branch";

  const handleCompare = (sourceBranch: string | null, targetBranch: string | null) => {
    if (disabledReason) return;
    onCloseMenus();
    onCompareBranch({ sourceBranch, targetBranch });
  };

  return (
    <>
      <BranchContextMenuSectionTitle>Compare</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => handleCompare(branchName, currentBranch)}
      >
        Show changes in <BranchName>{branchName}</BranchName> against{" "}
        <BranchName>{currentBranchLabel}</BranchName>...
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => handleCompare(currentBranch, branchName)}
      >
        Show changes in <BranchName>{currentBranchLabel}</BranchName> against{" "}
        <BranchName>{branchName}</BranchName>...
      </BranchContextMenuItem>
    </>
  );
}
