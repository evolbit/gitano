import { Split } from "@gfazioli/mantine-split-pane";
import "@gfazioli/mantine-split-pane/styles.css";
import {
  Accordion,
  ActionIcon,
  Box,
  Divider,
  Group,
  ScrollArea,
  Tabs,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowBarToUp,
  IconArrowForwardUp,
  IconCloudDownload,
  IconCloudUpload,
  IconFolder,
  IconGitBranch,
  IconHome,
  IconInfoCircle,
  IconPlus,
  IconSettings,
  IconStack2,
  IconTerminal2,
} from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.css";

type TabType = {
  id: string;
  label?: string;
  icon?: ReactNode;
};

const branchIcon = (
  <IconGitBranch
    size={18}
    style={{ marginRight: 4 }}
  />
);

const TABS_INITIAL: TabType[] = [
  {
    id: "home",
    label: undefined,
    icon: (
      <>
        <IconHome
          size={18}
          style={{ marginRight: 4 }}
        />
        {branchIcon}
      </>
    ),
  },
];

export default function App() {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<TabType[]>(TABS_INITIAL);
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const addTab = () => {
    const newId = `tab-${tabs.length + 1}`;
    setTabs([
      ...tabs,
      { id: newId, label: `Tab ${tabs.length + 1}`, icon: branchIcon },
    ]);
    setActiveTab(newId);
  };

  const closeTab = () => {
    if (tabs.length > 1) {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      const newTabs = tabs.filter((tab) => tab.id !== activeTab);
      setTabs(newTabs);
      setActiveTab(newTabs[Math.max(0, currentIndex - 1)].id);
    }
  };

  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new_tab":
          addTab();
          break;
        case "close_tab":
          closeTab();
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
        keepMounted={false}>
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}>
              {tab.icon}
              {tab.label && (
                <span style={{ marginLeft: tab.icon ? 6 : 0 }}>
                  {tab.label}
                </span>
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
        {/* Bar below the tabs with icons */}
        <Divider my={0} />
        <Group
          gap="xs"
          px="md"
          py={6}
          style={{ background: "#23232a" }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconArrowBackUp size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconArrowForwardUp size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconCloudDownload size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconCloudUpload size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconGitBranch size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconStack2 size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconArrowBarToUp size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg">
            <IconTerminal2 size={18} />
          </ActionIcon>
        </Group>
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            value={tab.id}
            p={0}
            className="h-[calc(100vh-42px)] w-full p-0 m-0 bg-zinc-900 text-white">
            <Split className="h-full w-full">
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
                className="h-full min-h-0 grow">
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
