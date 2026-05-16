import type { BranchTreeNode } from "../../utils/branchTree";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "./BranchContextMenuParts";
import type { BranchType } from "./types";
import { getBranchCreatePrefix } from "./utils";

type BranchContextMenuBranchingItemsProps = {
  node: BranchTreeNode;
  branchName: string;
  type: BranchType;
  isBranchNode: boolean;
  selectedBranch?: string | null;
  onBeginCreateBranch: (baseRef: string, prefix?: string) => void;
  onCloseMenus: () => void;
};

export function BranchContextMenuBranchingItems({
  node,
  branchName,
  type,
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
          const prefix = getBranchCreatePrefix(node, type);
          const baseRef = isBranchNode ? branchName : selectedBranch || "HEAD";
          onCloseMenus();
          onBeginCreateBranch(baseRef, prefix);
        }}
      >
        Create branch here
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className="cursor-pointer px-4 py-2 hover:bg-zinc-700"
        onClick={onCloseMenus}
      >
        Cherry pick commit
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className="cursor-pointer px-4 py-2 hover:bg-zinc-700"
        onClick={onCloseMenus}
      >
        Reset ... to this commit
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className="cursor-pointer px-4 py-2 hover:bg-zinc-700"
        onClick={onCloseMenus}
      >
        Revert commit
      </BranchContextMenuItem>
    </>
  );
}
