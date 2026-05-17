import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "./branch-context-menu-parts";

export function BranchContextMenuCompareItems({
  branchName,
  disabledReason,
  itemClass,
  onCompareBranch,
  onCloseMenus,
}: {
  branchName: string;
  disabledReason: string | null;
  itemClass: string;
  onCompareBranch: (branchName: string) => void;
  onCloseMenus: () => void;
}) {
  return (
    <>
      <BranchContextMenuSectionTitle>Compare</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className={itemClass}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (disabledReason) return;
          onCloseMenus();
          onCompareBranch(branchName);
        }}
      >
        Compare to...
      </BranchContextMenuItem>
    </>
  );
}
