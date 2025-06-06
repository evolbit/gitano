import { Split } from "@gfazioli/mantine-split-pane";
import "@gfazioli/mantine-split-pane/styles.css";
import { Accordion, ActionIcon, Box, ScrollArea, Tabs } from "@mantine/core";
import {
  IconFolder,
  IconInfoCircle,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.css";

const TABS_INITIAL = [{ id: "tab-1", label: "Tab 1" }];

export default function App() {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState(TABS_INITIAL);
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const addTab = () => {
    const newId = `tab-${tabs.length + 1}`;
    setTabs([...tabs, { id: newId, label: `Tab ${tabs.length + 1}` }]);
    setActiveTab(newId);
  };

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || "")}
        keepMounted={false}>
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}>
              {tab.label}
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
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            value={tab.id}
            p={0}
            className="h-[calc(100vh-42px)] w-screen p-0 m-0 bg-zinc-900 text-white">
            <Split className="h-full w-full">
              {/* Sidebar izquierdo */}
              <Split.Pane
                initialWidth={240}
                minWidth={200}
                className="h-full !w-full">
                <Box className="h-full w-full !bg-zinc-800 border-r border-zinc-700 !text-zinc-200">
                  <Accordion
                    defaultValue="section1"
                    variant="contained"
                    classNames={{
                      root: "!bg-zinc-800 !text-zinc-200",
                      item: "!bg-zinc-800 !text-zinc-200",
                      control: "!bg-zinc-800 !text-zinc-200",
                      panel: "!bg-zinc-800 !text-zinc-200",
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
                className="h-full w-full">
                <ScrollArea className="h-full w-full p-4">
                  <Box className="!bg-zinc-900 h-full min-h-[400px] w-full !text-white">
                    <h2 className="!text-white text-2xl font-bold mb-2">
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
                className="h-full w-full">
                <Box className="h-full w-full !bg-zinc-800 border-l border-zinc-700 !text-zinc-200">
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
    </Box>
  );
}
