import { Box, Stack, Tooltip } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  HiCodeBracket,
  HiCog,
  HiDocumentText,
  HiHome,
  HiSquares2X2,
} from "react-icons/hi2";

export type TabType =
  | "launchpad"
  | "branches"
  | "commits"
  | "changes"
  | "graph"
  | "settings";

interface SidebarProps {
  tab: TabType;
  setTab: (tab: TabType) => void;
}

const icons = [
  { key: "launchpad", icon: <HiHome size={24} /> },
  { key: "branches", icon: <HiCodeBracket size={24} /> },
  { key: "commits", icon: <HiDocumentText size={24} /> },
  { key: "changes", icon: <HiSquares2X2 size={24} /> },
  { key: "settings", icon: <HiCog size={24} /> },
];

const Sidebar: React.FC<SidebarProps> = ({ tab, setTab }) => {
  const { t } = useTranslation();
  return (
    <Box
      w={80}
      h="100vh"
      bg="#18181b"
      style={{
        borderRight: "1px solid #27272a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 24,
      }}>
      <div className="mb-8 text-2xl font-bold tracking-tight text-blue-400 text-center">
        G
      </div>
      <Stack
        justify="center"
        align="center"
        gap="lg"
        style={{ flex: 1 }}>
        {icons.map(({ key, icon }) => (
          <Tooltip
            label={t(`tabs.${key}`)}
            position="right"
            withArrow
            key={key}>
            <button
              onClick={() => setTab(key as TabType)}
              style={{
                background: tab === key ? "#27272a" : "transparent",
                color: tab === key ? "#60a5fa" : "#a1a1aa",
                borderRadius: 8,
                padding: 8,
                border: "none",
                cursor: "pointer",
                outline: "none",
              }}>
              {icon}
            </button>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
};

export default Sidebar;
