import { ActionIcon, Tabs } from "@mantine/core";
import { classNames } from "@/shared/ui";
import { IconGitBranch, IconHome, IconPlus, IconX } from "@/components/icons";
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
}: TabBarProps) => {
  return (
    <Tabs.List className="bg-background-emphasis flex w-full sticky top-0 z-30 h-11 border-b border-border">
      {tabs.map((tab) => (
        <Tabs.Tab
          key={tab.id}
          value={tab.id}
          className={classNames("px-4 py-1 font-medium")}
          classNames={{
            tabLabel: classNames(
              "flex items-center gap-1 text-sm",
              activeTab === tab.id ? "text-white" : "text-zinc-400"
            ),
            tab: "border-r !border-r-border",
          }}
          style={{ borderRadius: 0 }}>
          {/* Git branch icon on the left for all tabs except home */}
          {tab.id !== "home" && branchIcon}
          {/* Home icon for home tab */}
          {tab.id === "home" && (
            <IconHome
              size={18}
              style={{ marginRight: 0 }}
            />
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
              className={
                activeTab === tab.id ? "text-white" : "text-zinc-400"
              }
              onClick={(e) => onTabClose(tab.id, e)}
              style={{ marginLeft: 6 }}>
              <IconX size={12} />
            </ActionIcon>
          )}
        </Tabs.Tab>
      ))}
      <div className="flex-1" />
      <ActionIcon
        onClick={onAddTab}
        variant="subtle"
        color="gray"
        ml="xs"
        size="lg">
        <IconPlus size={18} />
      </ActionIcon>
    </Tabs.List>
  );
};

export default TabBar;
