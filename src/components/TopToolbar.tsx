import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import React, { useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import {
  IconArrowBackUp,
  IconArrowBarToUp,
  IconArrowForwardUp,
  IconBrandGit,
  IconCloudDownload,
  IconCloudUpload,
  IconGitBranch,
  IconSearch,
  IconStack2,
  IconTerminal2,
} from "./icons";

const REPOS = ["efectoled-backend", "microservices", "Launchpad"];
const BRANCHES = [
  "develop",
  "feature/OYS-24721_CC_BACKOFFICE...",
  "release/20250519.01",
];

interface TopToolbarProps {
  bg?: string;
}

const TopToolbar: React.FC<TopToolbarProps> = ({ bg = "bg-background" }) => {
  // Search state for dropdowns
  const [repoSearch, setRepoSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  // Menu open state for hover/active styling
  const [repoMenuOpened, setRepoMenuOpened] = useState(false);
  const [branchMenuOpened, setBranchMenuOpened] = useState(false);

  const filteredRepos = REPOS.filter((r) =>
    r.toLowerCase().includes(repoSearch.toLowerCase())
  );
  const filteredBranches = BRANCHES.filter((b) =>
    b.toLowerCase().includes(branchSearch.toLowerCase())
  );

  return (
    <Group
      px={0}
      py={0}
      className={`bg-background h-[65px] sticky top-0 z-30 w-full m-0 flex items-center justify-between border-b !border-border`}>
      {/* Left: repo/branch dropdowns */}
      <Group
        px="sm"
        gap={0}
        className="!w-[620px] h-full">
        {/* Repository dropdown with label */}
        <Menu
          shadow="md"
          offset={0}
          position="bottom-start"
          width="target"
          opened={repoMenuOpened}
          onOpen={() => setRepoMenuOpened(true)}
          onClose={() => setRepoMenuOpened(false)}>
          <Menu.Target>
            <Stack
              gap={0}
              align="center"
              className="cursor-pointer group rounded overflow-hidden w-1/2">
              <Text
                size="xs"
                className="text-xs text-zinc-400 px-3 pt-1 group-hover:bg-background w-full transition-colors">
                Repository
              </Text>
              <Box className="flex items-center gap-1.5 bg-background text-zinc-400 px-3 py-0.5 cursor-pointer transition-colors w-full group-hover:bg-background">
                <IconBrandGit
                  size={16}
                  className="text-blue-400"
                />
                <Text
                  size="sm"
                  className="text-sm text-zinc-400 font-medium">
                  efectoled-backend
                </Text>
                <span className="flex-1" />
                <HiChevronDown
                  className="text-zinc-400 h-6 w-6 flex items-center justify-center"
                  size={18}
                />
              </Box>
            </Stack>
          </Menu.Target>
          <Menu.Dropdown className="p-0 bg-background border border-zinc-700 rounded-b transition-colors">
            <div className="px-4 pt-2 pb-1 sticky top-0 border-b border-zinc-700 z-10 rounded-t">
              <TextInput
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.currentTarget.value)}
                placeholder="Search"
                leftSection={
                  <IconSearch
                    size={16}
                    className="text-zinc-400"
                  />
                }
                leftSectionPointerEvents="none"
                leftSectionWidth={28}
                size="xs"
                classNames={{
                  input:
                    "bg-background text-zinc-200 placeholder-zinc-400 pl-8",
                }}
                radius="md"
                autoFocus
              />
            </div>
            {filteredRepos.length === 0 && (
              <div className="px-4 py-2 text-zinc-400 text-sm">No results</div>
            )}
            {filteredRepos.map((repo) => (
              <Menu.Item
                key={repo}
                className="px-4 py-2">
                <span className="text-sm">{repo}</span>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        {/* Branch dropdown with label */}
        <Menu
          shadow="md"
          offset={0}
          position="bottom-start"
          width="target"
          opened={branchMenuOpened}
          onOpen={() => setBranchMenuOpened(true)}
          onClose={() => setBranchMenuOpened(false)}>
          <Menu.Target>
            <Stack
              gap={0}
              align="center"
              className="cursor-pointer group rounded overflow-hidden !w-1/2">
              <Text
                size="xs"
                className="text-xs text-zinc-400 group-hover:bg-background w-full px-3 pt-1 transition-colors">
                Branch
              </Text>
              <Box className="flex items-center gap-1.5 bg-background text-zinc-400 px-3 py-0.5 min-w-[120px] cursor-pointer transition-colors w-full group-hover:bg-background">
                <IconGitBranch
                  size={16}
                  className="text-lime-400"
                />
                <Text
                  size="sm"
                  className="text-sm text-zinc-400 font-medium truncate">
                  feature/OYS-24721_CC_BACKOFFICE...
                </Text>
                <span className="flex-1" />
                <HiChevronDown
                  className="text-zinc-400 h-6 w-6 flex items-center justify-center"
                  size={18}
                />
              </Box>
            </Stack>
          </Menu.Target>
          <Menu.Dropdown className="p-0 bg-background border border-zinc-700 rounded-b transition-colors">
            <div className="px-4 pt-2 pb-1 sticky top-0 border-b border-zinc-700 z-10 rounded-t">
              <TextInput
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.currentTarget.value)}
                placeholder="Search"
                leftSection={
                  <IconSearch
                    size={16}
                    className="text-zinc-400"
                  />
                }
                leftSectionPointerEvents="none"
                leftSectionWidth={28}
                size="xs"
                classNames={{
                  input:
                    "bg-background text-zinc-200 placeholder-zinc-400 pl-8",
                }}
                radius="md"
                autoFocus
              />
            </div>
            {filteredBranches.length === 0 && (
              <div className="px-4 py-2 text-zinc-400 text-sm">No results</div>
            )}
            {filteredBranches.map((branch) => (
              <Menu.Item
                key={branch}
                className="px-4 py-2">
                <span className="text-sm">{branch}</span>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
      {/* Center: main tool icons */}
      <Group
        gap="xl"
        className="justify-center flex-1 items-center">
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
            className="text-xs text-zinc-400">
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
            className="text-xs text-zinc-400">
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
            className="text-xs text-zinc-400">
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
            className="text-xs text-zinc-400">
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
            className="text-xs text-zinc-400">
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
            className="text-xs text-zinc-400">
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
            className="text-xs text-zinc-400">
            Pop
          </Text>
        </Stack>
      </Group>
      {/* Right: Terminal and Search */}
      <Group
        gap="md"
        px="sm"
        className="min-w-[120px] justify-end">
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
            className="text-xs text-zinc-400">
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
            className="text-xs text-zinc-400">
            Search
          </Text>
        </Stack>
      </Group>
    </Group>
  );
};

export default TopToolbar;
