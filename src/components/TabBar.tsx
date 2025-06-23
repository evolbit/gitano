import { ActionIcon, Tabs } from "@mantine/core";
import { ReactNode } from "react";
import { classNames } from "../utils/ui";
import { IconGitBranch, IconPlus, IconX } from "./icons";

type TabType = {
  id: string;
  label?: string;
  icon?: ReactNode;
};

type RepoTabType = TabType & { repoPath?: string };

const branchIcon = (
  <IconGitBranch
    size={16}
    style={{ marginRight: 6, verticalAlign: "middle" }}
  />
);

interface TabBarProps {
  tabs: RepoTabType[];
  activeTab: string;
  onTabClose: (id: string, e: React.MouseEvent) => void;
  onAddTab: () => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabClose,
  onAddTab,
}) => {
  return (
    <Tabs.List className="bg-background-emphasis flex w-full sticky top-0 z-30 h-14 border-b !border-border">
      {tabs.map((tab, idx) => (
        <Tabs.Tab
          key={tab.id}
          value={tab.id}
          className={classNames("px-5 py-2 font-medium")}
          classNames={{
            tabLabel: classNames(
              "flex items-center gap-1",
              activeTab === tab.id
                ? "text-white"
                : "!text-muted-foreground hover:!bg-background-emphasis"
            ),
            tab: "border-r !border-border",
          }}
          style={{ borderRadius: 0 }}>
          {/* Git branch icon on the left for all tabs except home */}
          {tab.id !== "home" && branchIcon}
          {/* Home icon for home tab */}
          {tab.id === "home" && tab.icon}
          {tab.label && (
            <span style={{ marginLeft: tab.icon ? 0 : 0 }}>{tab.label}</span>
          )}
          {/* Close icon on the right for all tabs except home */}
          {tab.id !== "home" && (
            <ActionIcon
              size={18}
              variant="subtle"
              component="span"
              className="text-foreground"
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
