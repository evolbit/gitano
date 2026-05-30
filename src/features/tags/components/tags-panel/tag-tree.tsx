import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import type { GitTagRef } from "@/shared/types/git";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconFolder,
  IconTag,
} from "@/shared/components/icons/icons";
import { classNames } from "@/shared/ui";
import { TagPresenceIcons } from "./tag-status-chip";

type TagTreeProps = {
  nodes: BranchTreeNode[];
  tagTreeExpanded: Record<string, boolean>;
  selectedTag: string | null;
  tagRefByName: Map<string, GitTagRef>;
  isRowActionsVisible: (rowKey: string) => boolean;
  onHoverRow: (rowKey: string | null) => void;
  onToggleGroup: (nodeFull: string, isOpen: boolean) => void;
  onSelectTag: (tagName: string) => void;
  onOpenContextMenu: (node: BranchTreeNode, x: number, y: number) => void;
  level?: number;
};

export function TagTree({
  nodes,
  tagTreeExpanded,
  selectedTag,
  tagRefByName,
  isRowActionsVisible,
  onHoverRow,
  onToggleGroup,
  onSelectTag,
  onOpenContextMenu,
  level = 0,
}: TagTreeProps) {
  return (
    <ul className="m-0 w-full min-w-0 list-none p-0 select-none">
      {nodes.map((node) => {
        if (node.type === "group") {
          const isOpen = tagTreeExpanded[node.full] ?? true;

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
                    <IconChevronDown size={18} />
                  ) : (
                    <IconChevronRight size={18} />
                  )}
                </span>
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <IconFolder size={18} className="text-slate-300" />
                </span>
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
                <button
                  className={classNames(
                    "ml-auto rounded p-1 transition-colors hover:bg-zinc-700",
                    isRowActionsVisible(node.full) ? "visible" : "invisible",
                  )}
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
                <TagTree
                  nodes={node.children}
                  tagTreeExpanded={tagTreeExpanded}
                  selectedTag={selectedTag}
                  tagRefByName={tagRefByName}
                  isRowActionsVisible={isRowActionsVisible}
                  onHoverRow={onHoverRow}
                  onToggleGroup={onToggleGroup}
                  onSelectTag={onSelectTag}
                  onOpenContextMenu={onOpenContextMenu}
                  level={level + 1}
                />
              ) : null}
            </li>
          );
        }

        const selected = selectedTag === node.full;
        const tagRef = tagRefByName.get(node.full);

        return (
          <li
            key={node.full}
            className={classNames(
              "group flex w-full min-w-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-sm transition-colors",
              selected
                ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
                : "text-foreground hover:bg-background-emphasis",
            )}
            style={{
              fontSize: "var(--ui-font-size-sm)",
              paddingLeft: `${28 + level * 22}px`,
            }}
            tabIndex={0}
            onMouseEnter={() => onHoverRow(node.full)}
            onMouseLeave={() => onHoverRow(null)}
            onClick={() => onSelectTag(node.full)}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenContextMenu(node, event.clientX, event.clientY);
            }}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <IconTag size={17} className="text-slate-300" />
            </span>
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <TagPresenceIcons tag={tagRef} />
            <button
              className={classNames(
                "ml-auto rounded p-1 transition-colors hover:bg-zinc-700",
                isRowActionsVisible(node.full) ? "visible" : "invisible",
              )}
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
