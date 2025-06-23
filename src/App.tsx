import { Split } from "@gfazioli/mantine-split-pane";
import "@gfazioli/mantine-split-pane/styles.css";
import { Accordion, Box, Tabs } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BranchList } from "./components/BranchList";
import ChangesPanel from "./components/ChangesPanel";
import CommitList from "./components/CommitList";
import HomePage from "./components/HomePage";
import { IconFolder, IconGitBranch, IconHome } from "./components/icons";
import TabBar from "./components/TabBar";
import TopToolbar from "./components/TopToolbar";
import "./index.css";
import { useRepoStore } from "./store/repo";
import { CommitListItem } from "./types/git";

type TabType = {
  id: string;
  label?: string;
  icon?: ReactNode;
};

type RepoTabType = TabType & { repoPath?: string };

const TABS_INITIAL: RepoTabType[] = [
  {
    id: "home",
    label: undefined,
    icon: (
      <IconHome
        size={18}
        style={{ marginRight: 4 }}
      />
    ),
  },
];

export default function App() {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<RepoTabType[]>(TABS_INITIAL);
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [selectedCommit, setSelectedCommit] = useState<CommitListItem | null>(
    null
  );
  const setCurrentRepo = useRepoStore((s) => s.setCurrentRepo);

  const addTab = () => {
    const newId = `tab-${tabs.length + 1}`;
    setTabs([...tabs, { id: newId, label: `Tab ${tabs.length + 1}` }]);
    setActiveTab(newId);
  };

  const handleRepoOpened = useCallback(
    (repoPath: string) => {
      const repoName = repoPath.split("/").filter(Boolean).pop() || repoPath;
      const newId = `repo-${repoName}-${Date.now()}`;
      setTabs((prev) => [...prev, { id: newId, label: repoName, repoPath }]);
      setActiveTab(newId);
      setCurrentRepo(repoPath);
    },
    [setCurrentRepo]
  );

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    setTabs(tabs.filter((t) => t.id !== id));
    if (activeTab === id && tabs.length > 1) {
      setActiveTab(tabs[0].id);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const tab = tabs.find((t) => t.id === value);
    setCurrentRepo(tab?.repoPath || null);
  };

  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new_tab":
          addTab();
          break;
        case "close_tab":
          // Just close the active tab (simulate close button click)
          if (tabs.length > 1) {
            const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
            const newTabs = tabs.filter((tab) => tab.id !== activeTab);
            setTabs(newTabs);
            setActiveTab(newTabs[Math.max(0, currentIndex - 1)].id);
          }
          break;
        case "reopen_tab":
          // TODO: Implement reopen closed tab logic
          break;
        case "clone_repo":
          // TODO: Implement clone repo logic
          break;
        case "init_repo":
          // TODO: Implement init repo logic
          break;
        case "open_repo":
          // TODO: Implement open repo logic
          break;
        case "open_repo_external":
          // TODO: Implement open repo in external editor logic
          break;
        case "open_terminal":
          // TODO: Implement open external terminal logic
          break;
        case "open_file_manager":
          // TODO: Implement open in file manager logic
          break;
        case "sign_in":
          // TODO: Implement sign into a different account logic
          break;
        default:
          break;
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [tabs]);

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
          activeTab={activeTab}
          onTabClose={closeTab}
          onAddTab={addTab}
        />
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            value={tab.id}
            className="flex-1 overflow-y-auto">
            {tab.id === "home" ? (
              <HomePage onRepoOpened={handleRepoOpened} />
            ) : (
              <div className="flex h-full w-full flex-col">
                <TopToolbar />
                <div className="flex-1 min-h-0">
                  <Split className="h-full w-full min-h-0 flex-1">
                    {/* Sidebar izquierdo */}
                    <Split.Pane
                      initialWidth={240}
                      minWidth={300}
                      maxWidth={350}
                      className="!h-full !min-h-0 flex flex-col">
                      <Box className="flex-1 text-foreground flex flex-col min-h-0">
                        <Accordion
                          defaultValue="branches"
                          variant="contained"
                          chevronPosition="left"
                          classNames={{
                            root: "bg-background-emphasis text-foreground flex-1 flex flex-col min-h-0",
                            item: "group bg-background text-foreground flex flex-col data-[active]:flex-1 data-[active]:min-h-0",
                            control:
                              "bg-background-emphasis text-foreground p-2 transition-colors hover:bg-background-emphasis",
                            panel:
                              "text-foreground flex-1 flex flex-col min-h-0 bg-background-emphasis",
                            content: "flex-1 min-h-0",
                            icon: "mr-2",
                          }}>
                          <Accordion.Item value="branches">
                            <Accordion.Control>
                              <div className="flex flex-row items-center w-full justify-between">
                                <span className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-5 h-5">
                                    <IconGitBranch size={18} />
                                  </span>
                                  Ramas
                                </span>
                              </div>
                            </Accordion.Control>
                            <Accordion.Panel className="min-w-0">
                              <BranchList />
                            </Accordion.Panel>
                          </Accordion.Item>
                          <Accordion.Item value="folders">
                            <Accordion.Control>
                              <div className="flex flex-row items-center w-full justify-between">
                                <span className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-5 h-5">
                                    <IconFolder size={18} />
                                  </span>
                                  Carpetas
                                </span>
                              </div>
                            </Accordion.Control>
                            <Accordion.Panel>
                              {/* Aquí va la lista de carpetas */}
                            </Accordion.Panel>
                          </Accordion.Item>
                        </Accordion>
                      </Box>
                    </Split.Pane>
                    <Split.Resizer className="!bg-background-emphasis hover:!bg-foreground [--split-resizer-size:1px] m-0 border-r border-border rounded-none" />
                    <Split.Pane
                      grow
                      className="!h-full !min-h-0">
                      <Split
                        orientation="vertical"
                        className="h-full w-full">
                        <Split.Pane initialWidth="60%">
                          <CommitList onCommitSelected={setSelectedCommit} />
                        </Split.Pane>
                        <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
                        <Split.Pane grow>
                          <ChangesPanel selectedCommit={selectedCommit} />
                        </Split.Pane>
                      </Split>
                    </Split.Pane>
                  </Split>
                </div>
              </div>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
