import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "./branch-context-menu-parts";

export function BranchContextMenuCompareItems({
  onCloseMenus,
}: {
  onCloseMenus: () => void;
}) {
  return (
    <>
      <BranchContextMenuSectionTitle>Compare</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className="cursor-pointer px-4 py-2 hover:bg-zinc-700"
        onClick={onCloseMenus}
      >
        Compare commit against working directory
      </BranchContextMenuItem>
    </>
  );
}
