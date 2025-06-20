import { Split } from "@gfazioli/mantine-split-pane";
import "@gfazioli/mantine-split-pane/styles.css";
import { Accordion, ActionIcon, Box, Tabs } from "@mantine/core";
import {
  IconFolder,
  IconGitBranch,
  IconHome,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BranchList } from "./components/BranchList";
import ChangesPanel from "./components/ChangesPanel";
import CommitList from "./components/CommitList";
import HomePage from "./components/HomePage";
import TopToolbar from "./components/TopToolbar";
import "./index.css";
import { useRepoStore } from "./store/repo";
import { CommitListItem } from "./types/git";
import { classNames } from "./utils/ui";

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
    <div className="h-screen w-screen bg-zinc-900 text-white flex flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value || "");
          const tab = tabs.find((t) => t.id === value);
          setCurrentRepo(tab?.repoPath || null);
        }}
        keepMounted={false}
        variant="none"
        className="flex flex-col h-full">
        <Tabs.List
          className="bg-zinc-800 flex w-full sticky top-0 z-30"
          style={{ borderBottom: "1px solid #27272a" }}>
          {tabs.map((tab, idx) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}
              classNames={{
                tab: classNames(
                  "flex items-center gap-1 px-5 py-2 font-medium border-b-0",
                  activeTab === tab.id
                    ? "!bg-zinc-700 !text-white"
                    : "!bg-zinc-800 !text-zinc-400 hover:!bg-zinc-700",
                  idx < tabs.length - 1 ? "border-r-1 border-r-zinc-900" : ""
                ),
              }}
              style={{ borderRadius: 0 }}>
              {/* Git branch icon on the left for all tabs except home */}
              {tab.id !== "home" && branchIcon}
              {/* Home icon for home tab */}
              {tab.id === "home" && tab.icon}
              {tab.label && (
                <span style={{ marginLeft: tab.icon ? 0 : 0 }}>
                  {tab.label}
                </span>
              )}
              {/* Close icon on the right for all tabs except home */}
              {tab.id !== "home" && (
                <ActionIcon
                  size={18}
                  variant="subtle"
                  component="span"
                  color="gray"
                  onClick={(e) => closeTab(tab.id, e)}
                  style={{ marginLeft: 6 }}>
                  <IconX size={12} />
                </ActionIcon>
              )}
            </Tabs.Tab>
          ))}
          <div className="flex-1" />
          <ActionIcon
            onClick={addTab}
            variant="subtle"
            color="gray"
            ml="xs"
            size="lg">
            <IconPlus size={18} />
          </ActionIcon>
        </Tabs.List>
        <div className="sticky top-[42px] z-20">
          <TopToolbar bg="!bg-zinc-700" />
        </div>
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            value={tab.id}
            p={0}
            className="flex-1 min-h-0 w-full p-0 m-0 bg-zinc-800 text-white flex flex-col">
            {tab.id === "home" ? (
              <div className="flex-1 min-h-0 overflow-auto">
                <HomePage onRepoOpened={handleRepoOpened} />
              </div>
            ) : (
              <Split className="h-full min-h-0 flex-1">
                {/* Sidebar izquierdo */}
                <Split.Pane
                  initialWidth={240}
                  minWidth={300}
                  maxWidth={350}
                  className="!h-full !min-h-0">
                  <Box className="!h-full border-r border-zinc-900 text-zinc-200">
                    <Accordion
                      defaultValue="branches"
                      variant="contained"
                      chevronPosition="left"
                      classNames={{
                        root: "bg-zinc-800 text-zinc-200",
                        item: "bg-zinc-800 text-zinc-200 p-2 border-b border-zinc-900",
                        control: "bg-zinc-800 text-zinc-200",
                        panel: "bg-zinc-800 text-zinc-200",
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
                            <span
                              className="ml-2 p-1 rounded hover:bg-lime-400 transition-colors hover:text-zinc-900"
                              title="Nueva rama"
                              onClick={(e) => {
                                e.stopPropagation(); /* lógica para crear rama */
                              }}>
                              <IconPlus size={16} />
                            </span>
                          </div>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <BranchList />
                        </Accordion.Panel>
                      </Accordion.Item>
                      <Accordion.Item value="section2">
                        <Accordion.Control icon={<IconFolder size={18} />}>
                          Sección 2
                        </Accordion.Control>
                        <Accordion.Panel>
                          Contenido de la sección 2
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  </Box>
                </Split.Pane>
                <Split.Resizer
                  size={2}
                  variant="transparent"
                  radius="xs"
                  className="border-r border-zinc-900 bg-transparent p-0 m-0 w-px cursor-col-resize"
                />
                {/* Contenido principal */}
                <Split.Pane className="!h-full !min-h-0 flex-1">
                  <CommitList onCommitSelected={setSelectedCommit} />
                </Split.Pane>
                <Split.Resizer
                  size={2}
                  variant="transparent"
                  radius="xs"
                  className="border-r border-zinc-900 bg-transparent p-0 m-0 w-px cursor-col-resize"
                />
                {/* Sidebar derecho */}
                <Split.Pane
                  initialWidth={450}
                  className="!h-full !min-h-0">
                  <ChangesPanel selectedCommit={selectedCommit} />
                </Split.Pane>
              </Split>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
