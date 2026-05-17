import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import { isPriorityBranchName } from "@/shared/lib/tree/branch-tree";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconFolder,
} from "@/components/icons";
import {
  DEFAULT_BRANCH_ICON_COLOR,
  PRIORITY_BRANCH_COLOR,
} from "./constants";
import { BranchIcon } from "./branch-icon";
import type { BranchType } from "./types";

type BranchTreeProps = {
  nodes: BranchTreeNode[];
  branchTreeExpanded: Record<string, boolean>;
  selectedBranch?: string | null;
  selectedRowBranch: string | null;
  type: BranchType;
  isRowActionsVisible: (rowKey: string) => boolean;
  onHoverRow: (rowKey: string | null) => void;
  onToggleGroup: (nodeFull: string, isOpen: boolean) => void;
  onSelectBranch: (branchName: string) => void;
  onCheckoutBranch: (branchName: string) => void;
  onOpenContextMenu: (node: BranchTreeNode, x: number, y: number) => void;
  level?: number;
};

export function BranchTree({
  nodes,
  branchTreeExpanded,
  selectedBranch,
  selectedRowBranch,
  type,
  isRowActionsVisible,
  onHoverRow,
  onToggleGroup,
  onSelectBranch,
  onCheckoutBranch,
  onOpenContextMenu,
  level = 0,
}: BranchTreeProps) {
  return (
    <ul className="m-0 w-full min-w-0 list-none p-0 select-none">
      {nodes.map((node) => {
        if (node.type === "group") {
          const isOpen = branchTreeExpanded[node.full] ?? true;
          const isPriorityGroup = isPriorityBranchName(node.name);

          return (
            <li key={node.full} className="mb-0.5 w-full">
              <div
                className="flex w-full min-w-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background-emphasis"
                style={{
                  fontSize: "var(--ui-font-size-sm)",
                  fontWeight: 500,
                  paddingLeft: `${12 + level * 22}px`,
                }}
                onMouseEnter={() => onHoverRow(node.full)}
                onMouseLeave={() => onHoverRow(null)}
                onClick={() => onToggleGroup(node.full, isOpen)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onOpenContextMenu(node, event.clientX, event.clientY);
                }}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  {isOpen ? (
                    <IconChevronDown size={18} className="align-middle" />
                  ) : (
                    <IconChevronRight size={18} className="align-middle" />
                  )}
                </span>
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <IconFolder
                    size={18}
                    className={
                      isPriorityGroup
                        ? PRIORITY_BRANCH_COLOR
                        : DEFAULT_BRANCH_ICON_COLOR
                    }
                  />
                </span>
                <span className="w-0 min-w-0 flex-1 truncate">{node.name}</span>
                <button
                  className={`ml-auto rounded p-1 transition-colors hover:bg-zinc-700 ${
                    isRowActionsVisible(node.full) ? "visible" : "invisible"
                  }`}
                  title="More actions"
                  type="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    onOpenContextMenu(node, rect.right, rect.bottom);
                  }}
                >
                  <IconDotsVertical size={16} />
                </button>
              </div>
              {isOpen ? (
                <BranchTree
                  nodes={node.children}
                  branchTreeExpanded={branchTreeExpanded}
                  selectedBranch={selectedBranch}
                  selectedRowBranch={selectedRowBranch}
                  type={type}
                  isRowActionsVisible={isRowActionsVisible}
                  onHoverRow={onHoverRow}
                  onToggleGroup={onToggleGroup}
                  onSelectBranch={onSelectBranch}
                  onCheckoutBranch={onCheckoutBranch}
                  onOpenContextMenu={onOpenContextMenu}
                  level={level + 1}
                />
              ) : null}
            </li>
          );
        }

        const selected = (selectedRowBranch ?? selectedBranch) === node.full;

        return (
          <li
            key={node.full}
            className={`group flex w-full min-w-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-sm transition-colors ${
              selected
                ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
                : "text-foreground hover:bg-background-emphasis"
            }`}
            style={{
              fontSize: "var(--ui-font-size-sm)",
              paddingLeft: `${28 + level * 22}px`,
            }}
            tabIndex={0}
            onMouseEnter={() => onHoverRow(node.full)}
            onMouseLeave={() => onHoverRow(null)}
            onClick={() => onSelectBranch(node.full)}
            onDoubleClick={() => {
              if (type !== "local") return;
              onCheckoutBranch(node.full);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenContextMenu(node, event.clientX, event.clientY);
            }}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <BranchIcon name={node.name} />
            </span>
            <span className="w-0 min-w-0 flex-1 truncate">{node.name}</span>
            <button
              className={`ml-auto rounded p-1 transition-colors hover:bg-zinc-700 ${
                isRowActionsVisible(node.full) ? "visible" : "invisible"
              }`}
              title="More actions"
              type="button"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenContextMenu(node, rect.right, rect.bottom);
              }}
            >
              <IconDotsVertical size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
