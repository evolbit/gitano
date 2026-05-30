import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "../branch-context-menu-parts/branch-context-menu-parts";
import { getBranchCreatePrefix } from "../../utils";

type BranchContextMenuBranchingItemsProps = {
  node: BranchTreeNode;
  baseRef: string;
  isBranchNode: boolean;
  selectedBranch?: string | null;
  onBeginCreateBranch: (baseRef: string, prefix?: string) => void;
  onCloseMenus: () => void;
};

export function BranchContextMenuBranchingItems({
  node,
  baseRef,
  isBranchNode,
  selectedBranch,
  onBeginCreateBranch,
  onCloseMenus,
}: BranchContextMenuBranchingItemsProps) {
  return (
    <>
      <BranchContextMenuSectionTitle>Branching</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className="cursor-pointer px-4 py-2 hover:bg-zinc-700"
        onClick={() => {
          const prefix = getBranchCreatePrefix(node);
          const targetBaseRef = isBranchNode ? baseRef : selectedBranch || "HEAD";
          onCloseMenus();
          onBeginCreateBranch(targetBaseRef, prefix);
        }}
      >
        Create branch here
      </BranchContextMenuItem>
    </>
  );
}
