import { Tabs } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState, type MouseEvent } from "react";
import HomePage from "@/components/home-page/home-page";
import { useRepoRealtimeEvents } from "@/app/hooks/use-repo-realtime-events";
import { SettingsWindow } from "@/features/settings";
import { RepoTabLayout, TabBar } from "@/features/repository-workspace";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";

const HOME_TAB = {
  id: "home",
  label: "",
};

export function AppShell() {
  useRepoRealtimeEvents();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const tabs = useRepoStore((s) => s.tabs);
  const activeTab = useRepoStore((s) => s.activeTabId);
  const addTab = useRepoStore((s) => s.addTab);
  const closeTab = useRepoStore((s) => s.closeTab);
  const setActiveTab = useRepoStore((s) => s.setActiveTab);
  const addRecentRepo = useRepoStore((s) => s.addRecentRepo);
  const activeRepoPath =
    tabs.find((tab) => tab.id === activeTab)?.repoPath || null;

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === HOME_TAB.id)) {
      addTab({
        ...HOME_TAB,
        repoPath: "",
        selectedBranch: null,
        selectedCommit: null,
      });
      setActiveTab(HOME_TAB.id);
    }
  }, [tabs, addTab, setActiveTab]);

  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs, setActiveTab]);

  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new_tab":
          break;
        case "close_tab":
          if (tabs.length > 1 && activeTab) {
            closeTab(activeTab);
          }
          break;
        default:
          break;
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [tabs, activeTab, closeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleAddTab = () => {
    const newId = `repo-${Date.now()}`;
    addTab({
      id: newId,
      repoPath: "",
      selectedBranch: null,
      selectedCommit: null,
    });
    setActiveTab(newId);
  };

  const handleCloseTab = (id: string, event: MouseEvent) => {
    event.stopPropagation();
    closeTab(id);
  };

  const handleRepoOpened = (repoPath: string) => {
    addRecentRepo(repoPath);

    const existingTab = tabs.find((tab) => tab.repoPath === repoPath);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }

    const repoName = repoPath.split("/").filter(Boolean).pop() || repoPath;
    const newId = `repo-${repoName}-${Date.now()}`;
    addTab({
      id: newId,
      repoPath,
      selectedBranch: null,
      selectedCommit: null,
    });
    setActiveTab(newId);
  };

  return (
    <div className="h-screen w-screen bg-background-emphasis text-foreground flex flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onChange={(value) => handleTabChange(value || "")}
        keepMounted={false}
        variant="none"
        className="flex flex-col h-full w-full">
        <TabBar
          tabs={tabs}
          activeTab={activeTab || ""}
          onTabClose={handleCloseTab}
          onAddTab={handleAddTab}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            value={tab.id}
            className="flex-1 overflow-y-auto">
            {tab.id === "home" ? (
              <HomePage onRepoOpened={handleRepoOpened} />
            ) : (
              <RepoTabLayout />
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
      <SettingsWindow
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        repoPath={activeRepoPath}
      />
    </div>
  );
}
