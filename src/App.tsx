import { Split } from "@gfazioli/mantine-split-pane";
import "@gfazioli/mantine-split-pane/styles.css";
import { Accordion, ActionIcon, Box, ScrollArea, Tabs } from "@mantine/core";
import {
  IconFolder,
  IconGitBranch,
  IconHome,
  IconInfoCircle,
  IconPlus,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import TopToolbar from "./components/TopToolbar";
import "./index.css";

type TabType = {
  id: string;
  label?: string;
  icon?: ReactNode;
};

const branchIcon = (
  <IconGitBranch
    size={16}
    style={{ marginRight: 6, verticalAlign: "middle" }}
  />
);

const TABS_INITIAL: TabType[] = [
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
  const [tabs, setTabs] = useState<TabType[]>(TABS_INITIAL);
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const addTab = () => {
    const newId = `tab-${tabs.length + 1}`;
    setTabs([...tabs, { id: newId, label: `Tab ${tabs.length + 1}` }]);
    setActiveTab(newId);
  };

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
    <div className="h-full w-full bg-zinc-900 text-white">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || "")}
        keepMounted={false}
        variant="none">
        <Tabs.List>
          {tabs.map((tab, idx) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}
              classNames={{
                tab:
                  `flex items-center gap-1 px-5 py-2 font-medium ` +
                  (activeTab === tab.id
                    ? "!bg-zinc-700 !text-white"
                    : "!bg-zinc-900 !text-zinc-400 hover:!bg-zinc-800") +
                  (idx < tabs.length - 1 ? " border-r border-zinc-900" : ""),
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
                  color="gray"
                  onClick={(e) => closeTab(tab.id, e)}
                  style={{ marginLeft: 6 }}>
                  <IconX size={12} />
                </ActionIcon>
              )}
            </Tabs.Tab>
          ))}
          <ActionIcon
            onClick={addTab}
            variant="subtle"
            color="gray"
            ml="xs"
            size="lg">
            <IconPlus size={18} />
          </ActionIcon>
        </Tabs.List>
        <TopToolbar bg="!bg-zinc-700" />
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            value={tab.id}
            p={0}
            className="h-[calc(100vh-42px)] w-full p-0 m-0 bg-zinc-900 text-white">
            <Split className="h-full">
              {/* Sidebar izquierdo */}
              <Split.Pane
                initialWidth={240}
                minWidth={200}
                maxWidth={350}
                className="!h-full !min-h-0">
                <Box className="!h-full bg-zinc-800 border-r border-zinc-700 text-zinc-200">
                  <Accordion
                    defaultValue="section1"
                    variant="contained"
                    classNames={{
                      root: "bg-zinc-800 text-zinc-200",
                      item: "bg-zinc-800 text-zinc-200",
                      control: "bg-zinc-800 text-zinc-200",
                      panel: "bg-zinc-800 text-zinc-200",
                    }}>
                    <Accordion.Item value="section1">
                      <Accordion.Control icon={<IconFolder size={18} />}>
                        Sección 1
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Box className="p-2">Contenido del acordeón 1</Box>
                      </Accordion.Panel>
                    </Accordion.Item>
                    <Accordion.Item value="section2">
                      <Accordion.Control icon={<IconSettings size={18} />}>
                        Sección 2
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Box className="p-2">Contenido del acordeón 2</Box>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>
                </Box>
              </Split.Pane>
              <Split.Resizer
                size={1}
                variant="transparent"
                radius="xs"
                className="border-r border-gray-700 bg-transparent p-0 m-0 w-px cursor-col-resize"
              />
              {/* Centro de contenido */}
              <Split.Pane
                minWidth={300}
                className="h-full min-h-0 !grow">
                <ScrollArea className="!h-full p-4">
                  <Box className="bg-zinc-900 h-full min-h-[400px] w-full text-white">
                    <h2 className="text-white text-2xl font-bold mb-2">
                      Contenido principal
                    </h2>
                    <p className="text-zinc-400">
                      Aquí va el contenido de la pestaña {tab.label}.
                    </p>
                  </Box>
                </ScrollArea>
              </Split.Pane>
              <Split.Resizer
                size={1}
                variant="transparent"
                radius="xs"
                className="border-r border-gray-700 bg-transparent p-0 m-0 w-px cursor-col-resize"
              />
              {/* Sidebar derecho */}
              <Split.Pane
                initialWidth={240}
                minWidth={200}
                maxWidth={350}
                className="!h-full !min-h-0">
                <Box className="!h-full bg-zinc-800 border-l border-zinc-700 text-zinc-200">
                  <Box className="p-4">
                    <IconInfoCircle
                      size={24}
                      className="mb-2"
                    />
                    <div>Sidebar derecho (placeholder)</div>
                  </Box>
                </Box>
              </Split.Pane>
            </Split>
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
