import { Split } from "@gfazioli/mantine-split-pane";
import "@gfazioli/mantine-split-pane/styles.css";
import {
  Accordion,
  ActionIcon,
  Box,
  Divider,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Tabs,
  Text,
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
  IconX,
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
        keepMounted={false}>
        <Tabs.List>
          {tabs.map((tab, idx) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                paddingRight: 0,
              }}>
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
        {/* Bar below the tabs with icons */}
        <Divider my={0} />
        <Group
          gap="md"
          px="md"
          py={6}
          style={{ background: "#23232a", alignItems: "end" }}>
          {/* Repository dropdown with label */}
          <Stack
            gap={2}
            align="center"
            style={{ minWidth: 120 }}>
            <Text
              size="xs"
              style={{ color: "#aaa", textAlign: "center" }}>
              Repository
            </Text>
            <Menu
              shadow="md"
              width={220}>
              <Menu.Target>
                <Box
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#23232a",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "2px 12px",
                    minWidth: 120,
                    cursor: "pointer",
                  }}>
                  <IconGitBranch
                    size={16}
                    style={{ color: "#60a5fa" }}
                  />
                  <Text
                    size="sm"
                    style={{ color: "#fff", fontWeight: 500 }}>
                    efectoled-backend
                  </Text>
                  <svg
                    width="14"
                    height="14"
                    style={{ marginLeft: 4 }}
                    viewBox="0 0 20 20"
                    fill="none">
                    <path
                      d="M6 8L10 12L14 8"
                      stroke="#aaa"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </Box>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item>efectoled-backend</Menu.Item>
                <Menu.Item>microservices</Menu.Item>
                <Menu.Item>Launchpad</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Stack>
          {/* Vertical divider between repo and branch dropdowns */}
          <Divider
            orientation="vertical"
            style={{ height: 28, borderColor: "#333" }}
          />
          {/* Branch dropdown with label */}
          <Stack
            gap={2}
            align="center"
            style={{ minWidth: 120 }}>
            <Text
              size="xs"
              style={{ color: "#aaa", textAlign: "center" }}>
              Branch
            </Text>
            <Menu
              shadow="md"
              width={220}>
              <Menu.Target>
                <Box
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#23232a",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "2px 12px",
                    minWidth: 120,
                    cursor: "pointer",
                  }}>
                  <IconGitBranch
                    size={16}
                    style={{ color: "#a3e635" }}
                  />
                  <Text
                    size="sm"
                    style={{ color: "#fff", fontWeight: 500 }}>
                    feature/OYS-24721_CC_BACKOFFICE...
                  </Text>
                  <svg
                    width="14"
                    height="14"
                    style={{ marginLeft: 4 }}
                    viewBox="0 0 20 20"
                    fill="none">
                    <path
                      d="M6 8L10 12L14 8"
                      stroke="#aaa"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </Box>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item>develop</Menu.Item>
                <Menu.Item>feature/OYS-24721_CC_BACKOFFICE...</Menu.Item>
                <Menu.Item>release/20250519.01</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Stack>
          {/* Bar icons with labels */}
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconArrowBackUp size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Undo
            </Text>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconArrowForwardUp size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Redo
            </Text>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconCloudDownload size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Pull
            </Text>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconCloudUpload size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Push
            </Text>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconGitBranch size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Branch
            </Text>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconStack2 size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Stash
            </Text>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconArrowBarToUp size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Pop
            </Text>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg">
              <IconTerminal2 size={18} />
            </ActionIcon>
            <Text
              size="xs"
              mt={2}
              style={{ color: "#aaa" }}>
              Terminal
            </Text>
          </Stack>
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
