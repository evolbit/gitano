import { Menu, Text, TextInput } from "@mantine/core";
import {
  IconArrowFork,
  IconPlus,
  IconSearch,
} from "@/shared/components/icons/icons";
import type { GitWorktree } from "@/shared/types/git";
import {
  TOOLBAR_DROPDOWN_ITEM_CLASS,
  TOOLBAR_DROPDOWN_RESULTS_MAX_HEIGHT,
} from "../../config";
import type { ToolbarDropdownProps } from "../../types";
import { getWorktreeDisplayName } from "../../utils";

export const ToolbarDropdownBody: React.FC<ToolbarDropdownProps> = ({
  searchValue,
  onSearchChange,
  placeholder = "Search",
  children,
}) => (
  <Menu.Dropdown className="p-0 bg-background border border-zinc-700 rounded-b transition-colors overflow-hidden">
    <div className="px-4 pt-2 pb-1 sticky top-0 border-b border-zinc-700 z-10 rounded-t bg-background">
      <TextInput
        value={searchValue}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        placeholder={placeholder}
        leftSection={
          <IconSearch
            size={16}
            className="text-zinc-400"
          />
        }
        leftSectionPointerEvents="none"
        leftSectionWidth={28}
        size="xs"
        classNames={{
          input:
            "bg-background pl-8 text-[11px] text-zinc-200 placeholder:text-[11px] placeholder:text-zinc-500",
        }}
        radius="md"
        autoFocus
      />
    </div>
    <div
      className="overflow-y-auto overflow-x-hidden overscroll-contain"
      style={{ maxHeight: TOOLBAR_DROPDOWN_RESULTS_MAX_HEIGHT }}
    >
      {children}
    </div>
  </Menu.Dropdown>
);

export const ToolbarDropdownItem: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <Menu.Item
    className={TOOLBAR_DROPDOWN_ITEM_CLASS}
    styles={{
      item: {
        overflow: "hidden",
      },
      itemLabel: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
    }}
    onClick={onClick}
  >
    <Text
      size="sm"
      className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
    >
      {label}
    </Text>
  </Menu.Item>
);

export const ToolbarDropdownActionItem: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <Menu.Item
    className={TOOLBAR_DROPDOWN_ITEM_CLASS}
    leftSection={<IconPlus size={16} />}
    onClick={onClick}
  >
    <Text
      size="sm"
      className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
    >
      {label}
    </Text>
  </Menu.Item>
);

export const WorktreeDropdownItem: React.FC<{
  worktree: GitWorktree;
  onClick: () => void;
}> = ({ worktree, onClick }) => (
  <Menu.Item
    className={TOOLBAR_DROPDOWN_ITEM_CLASS}
    styles={{
      item: {
        overflow: "hidden",
      },
      itemLabel: {
        minWidth: 0,
        overflow: "hidden",
      },
    }}
    onClick={onClick}
  >
    <div className="flex w-full min-w-0 items-start gap-3 overflow-hidden">
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center text-blue-300">
        <IconArrowFork size={15} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-zinc-100">
          {getWorktreeDisplayName(worktree)}
        </span>
        <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-400">
          {worktree.branch ?? "Detached HEAD"} - {worktree.path}
        </span>
      </span>
    </div>
  </Menu.Item>
);
