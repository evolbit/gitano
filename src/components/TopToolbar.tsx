import {
  ActionIcon,
  Box,
  Divider,
  Group,
  Menu,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowBarToUp,
  IconArrowForwardUp,
  IconCloudDownload,
  IconCloudUpload,
  IconGitBranch,
  IconStack2,
  IconTerminal2,
} from "@tabler/icons-react";
import React from "react";

const TopToolbar: React.FC = () => (
  <Group
    px={0}
    py={0}
    style={{
      background: "#23232a",
      borderBottom: "1px solid #23232a",
      minHeight: 44,
      width: "100%",
      margin: 0,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
    }}>
    {/* Left: repo/branch dropdowns */}
    <Group
      gap="md"
      px="md"
      style={{ minWidth: 320 }}>
      {/* Repository dropdown with label */}
      <Menu
        shadow="md"
        width={220}>
        <Menu.Target>
          <Stack
            gap={2}
            align="center"
            style={{ minWidth: 120, cursor: "pointer" }}>
            <Text
              size="xs"
              style={{ color: "#aaa", textAlign: "center" }}>
              Repository
            </Text>
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#23232a",
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
          </Stack>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>efectoled-backend</Menu.Item>
          <Menu.Item>microservices</Menu.Item>
          <Menu.Item>Launchpad</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {/* Vertical divider between repo and branch dropdowns */}
      <Divider
        orientation="vertical"
        style={{ height: 28, borderColor: "#333" }}
      />
      {/* Branch dropdown with label */}
      <Menu
        shadow="md"
        width={220}>
        <Menu.Target>
          <Stack
            gap={2}
            align="center"
            style={{ minWidth: 120, cursor: "pointer" }}>
            <Text
              size="xs"
              style={{ color: "#aaa", textAlign: "center" }}>
              Branch
            </Text>
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#23232a",
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
          </Stack>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>develop</Menu.Item>
          <Menu.Item>feature/OYS-24721_CC_BACKOFFICE...</Menu.Item>
          <Menu.Item>release/20250519.01</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
    {/* Center: main tool icons */}
    <Group
      gap="xl"
      style={{ justifyContent: "center", flex: 1 }}>
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
    </Group>
    {/* Right: Terminal and Search */}
    <Group
      gap="md"
      px="md"
      style={{ minWidth: 120, justifyContent: "flex-end" }}>
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
      <Stack
        gap={0}
        align="center">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none">
            <circle
              cx="9"
              cy="9"
              r="7"
              stroke="#aaa"
              strokeWidth="1.5"
            />
            <path
              d="M15 15L18 18"
              stroke="#aaa"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </ActionIcon>
        <Text
          size="xs"
          mt={2}
          style={{ color: "#aaa" }}>
          Search
        </Text>
      </Stack>
    </Group>
  </Group>
);

export default TopToolbar;
