import {
  IconDotsVertical,
  IconGitBranch,
  IconHome,
  IconPlus,
  IconX,
} from "@/shared/components/icons/icons";
import { classNames } from "@/shared/ui";
import { ActionIcon, Menu, Tabs } from "@mantine/core";
import { useState } from "react";
import type { TabBarProps } from "./types";

const branchIcon = (
  <IconGitBranch
    size={16}
    style={{ marginRight: 6, verticalAlign: "middle" }}
  />
);

const TabBar = ({
  tabs,
  activeTab,
  onTabClose,
  onAddTab,
  onOpenSettings,
  rightAccessory,
}: TabBarProps) => {
  const [menuOpened, setMenuOpened] = useState(false);

  const handleAddTab = () => {
    setMenuOpened(false);
    onAddTab();
  };

  const handleOpenSettings = () => {
    setMenuOpened(false);
    onOpenSettings();
  };

  return (
    <Tabs.List className="bg-background-emphasis flex w-full sticky top-0 z-30 h-9 border-b border-border">
      {tabs.map((tab) => (
        <Tabs.Tab
          key={tab.id}
          value={tab.id}
          className={classNames(
            "px-4 py-1 font-medium",
            activeTab === tab.id ? "bg-background" : "bg-transparent",
          )}
          classNames={{
            tabLabel: classNames(
              "flex items-center gap-1 text-sm",
              activeTab === tab.id ? "text-white" : "text-zinc-400",
            ),
            tab: "border-r !border-r-border",
          }}
          style={{ borderRadius: 0 }}
        >
          {/* Git branch icon on the left for all tabs except home */}
          {tab.id !== "home" && branchIcon}
          {/* Home icon for home tab */}
          {tab.id === "home" && (
            <IconHome size={18} style={{ marginRight: 0 }} />
          )}
          {tab.id !== "home" && (
            <span style={{ marginLeft: 0 }}>
              {tab.repoPath
                ? tab.repoPath.split("/").filter(Boolean).pop()
                : ""}
            </span>
          )}
          {/* Close icon on the right for all tabs except home */}
          {tab.id !== "home" && (
            <ActionIcon
              size={18}
              variant="subtle"
              component="span"
              className={activeTab === tab.id ? "text-white" : "text-zinc-400"}
              onClick={(e) => onTabClose(tab.id, e)}
              style={{ marginLeft: 6 }}
            >
              <IconX size={12} />
            </ActionIcon>
          )}
        </Tabs.Tab>
      ))}
      <div className="flex-1" />
      {rightAccessory}
      <Menu
        shadow="md"
        width={220}
        position="bottom-end"
        offset={4}
        opened={menuOpened}
        onOpen={() => setMenuOpened(true)}
        onClose={() => setMenuOpened(false)}
        withinPortal
      >
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            ml="xs"
            size="lg"
            aria-label="Open application menu"
          >
            <IconDotsVertical size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown className="min-w-[220px] select-none rounded border border-border bg-background-emphasis py-1 text-xs text-zinc-200 shadow-lg">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-zinc-200 transition-colors hover:bg-zinc-700"
            onClick={handleAddTab}
          >
            <IconPlus size={15} className="shrink-0" />
            New tab
          </button>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center px-4 py-2 text-left text-zinc-200 transition-colors hover:bg-zinc-700"
            onClick={handleOpenSettings}
          >
            Settings
          </button>
        </Menu.Dropdown>
      </Menu>
    </Tabs.List>
  );
};

export default TabBar;
