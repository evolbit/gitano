import "@gfazioli/mantine-split-pane/styles.css";
import { Tabs } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import HomePage from "./components/home-page/HomePage";
import RepoTabLayout from "./components/repo-tab-layout/RepoTabLayout";
import TabBar from "./components/tab-bar/TabBar";
import "./index.css";
import { useRepoStore } from "./store/repo";

export default function App() {
  const tabs = useRepoStore((s) => s.tabs);
  const activeTab = useRepoStore((s) => s.activeTabId);
  const addTab = useRepoStore((s) => s.addTab);
  const closeTab = useRepoStore((s) => s.closeTab);
  const setActiveTab = useRepoStore((s) => s.setActiveTab);
  const addRecentRepo = useRepoStore((s) => s.addRecentRepo);

  // Home tab definition
  const HOME_TAB = {
    id: "home",
    label: "",
  };

  // Ensure at least the home tab exists
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
  }, [tabs, addTab, setActiveTab, HOME_TAB]);

  // Ensure the first tab is always selected by default
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs, setActiveTab]);

  // Menu event handling
  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new_tab":
          // You may want to prompt for repoPath or use a default
          break;
        case "close_tab":
          if (tabs.length > 1 && activeTab) {
            closeTab(activeTab);
          }
          break;
        // ...other cases as needed
        default:
          break;
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [tabs, activeTab, closeTab]);

  // Tab change handler
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Add tab handler (for demo, just adds a dummy tab)
  const handleAddTab = () => {
    const newId = `repo-${Date.now()}`;
    addTab({
      id: newId,
      repoPath: "", // You may want to prompt for repoPath
      selectedBranch: null,
      selectedCommit: null,
    });
    setActiveTab(newId);
  };

  // Close tab handler
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(id);
  };

  // Handler to open repo in a new tab
  const handleRepoOpened = (repoPath: string) => {
    // Add the repository to the recent list
    addRecentRepo(repoPath);

    // Check if a tab for this repo already exists
    const existingTab = tabs.find((t) => t.repoPath === repoPath);
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
    </div>
  );
}
