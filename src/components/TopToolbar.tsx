import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { core } from "@tauri-apps/api";
import React, { useEffect, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { useRepoStore } from "../store/repo";
import {
  IconArrowBarToUp,
  IconBrandGit,
  IconCloudDownload,
  IconCloudUpload,
  IconGitBranch,
  IconSearch,
  IconStack2,
  IconTerminal2,
} from "./icons";

const TOOLBAR_DROPDOWN_RESULTS_MAX_HEIGHT = "80vh";

type ToolbarDropdownProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  children: React.ReactNode;
};

const ToolbarDropdownBody: React.FC<ToolbarDropdownProps> = ({
  searchValue,
  onSearchChange,
  children,
}) => (
  <Menu.Dropdown className="p-0 bg-background border border-zinc-700 rounded-b transition-colors overflow-hidden">
    <div className="px-4 pt-2 pb-1 sticky top-0 border-b border-zinc-700 z-10 rounded-t bg-background">
      <TextInput
        value={searchValue}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
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
          input: "bg-background text-zinc-200 placeholder-zinc-400 pl-8",
        }}
        radius="md"
        autoFocus
      />
    </div>
    <div
      className="overflow-y-auto overflow-x-hidden overscroll-contain"
      style={{ maxHeight: TOOLBAR_DROPDOWN_RESULTS_MAX_HEIGHT }}>
      {children}
    </div>
  </Menu.Dropdown>
);

type ToolbarDropdownItemProps = {
  label: string;
  onClick: () => void;
};

const ToolbarDropdownItem: React.FC<ToolbarDropdownItemProps> = ({
  label,
  onClick,
}) => (
  <Menu.Item
    className="px-4 py-2"
    styles={{
      item: {
        overflow: "hidden",
      },
      itemLabel: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
    }}
    onClick={onClick}>
    <Text
      size="sm"
      className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
      {label}
    </Text>
  </Menu.Item>
);

const TopToolbar: React.FC = () => {
  // Search state for dropdowns
  const [repoSearch, setRepoSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  // Menu open state for hover/active styling
  const [repoMenuOpened, setRepoMenuOpened] = useState(false);
  const [branchMenuOpened, setBranchMenuOpened] = useState(false);

  // Repo store hooks
  const tabs = useRepoStore((s) => s.tabs);
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const setActiveTab = useRepoStore((s) => s.setActiveTab);
  const setTabBranch = useRepoStore((s) => s.setTabBranch);
  const tab = tabs.find((t) => t.id === activeTabId);
  const repoPath = tab?.repoPath;
  const selectedBranch = tab?.selectedBranch;

  // Compute opened repos (filter out home tab)
  const openedRepos = tabs.filter((t) => t.id !== "home" && t.repoPath);
  // For display: get repo name from path
  const getRepoName = (path: string) =>
    path.split("/").filter(Boolean).pop() || path;

  // Branches state
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  // Fetch branches when repoPath changes
  useEffect(() => {
    if (!repoPath) {
      setBranches([]);
      return;
    }
    setBranchesLoading(true);
    setBranchesError(null);
    core
      .invoke<string[]>("get_branches", { path: repoPath })
      .then((allBranches) => {
        setBranches(allBranches);
      })
      .catch((e) => setBranchesError(e.toString()))
      .finally(() => setBranchesLoading(false));
  }, [repoPath]);

  // Filtered lists for dropdowns
  const filteredRepos = openedRepos.filter((t) =>
    getRepoName(t.repoPath).toLowerCase().includes(repoSearch.toLowerCase())
  );
  const filteredBranches = branches.filter((b) =>
    b.toLowerCase().includes(branchSearch.toLowerCase())
  );

  // Handlers
  const handleRepoSelect = (id: string) => {
    setActiveTab(id);
    setRepoMenuOpened(false);
  };
  const handleBranchSelect = (branch: string) => {
    if (activeTabId) setTabBranch(activeTabId, branch);
    setBranchMenuOpened(false);
  };

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
                  className="text-sm text-zinc-400 font-medium truncate min-w-0 flex-1">
                  {repoPath ? getRepoName(repoPath) : "No repository"}
                </Text>
                <HiChevronDown
                  className="text-zinc-400 h-6 w-6 flex items-center justify-center"
                  size={18}
                />
              </Box>
            </Stack>
          </Menu.Target>
          <ToolbarDropdownBody
            searchValue={repoSearch}
            onSearchChange={setRepoSearch}>
            {filteredRepos.length === 0 && (
              <div className="px-4 py-2 text-zinc-400 text-sm">No results</div>
            )}
            {filteredRepos.map((t) => (
              <ToolbarDropdownItem
                key={t.id}
                label={getRepoName(t.repoPath)}
                onClick={() => handleRepoSelect(t.id)}
              />
            ))}
          </ToolbarDropdownBody>
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
                  className="text-sm text-zinc-400 font-medium truncate min-w-0 flex-1">
                  {selectedBranch ||
                    (branchesLoading
                      ? "Loading..."
                      : branches[0] || "No branch")}
                </Text>
                <HiChevronDown
                  className="text-zinc-400 h-6 w-6 flex items-center justify-center"
                  size={18}
                />
              </Box>
            </Stack>
          </Menu.Target>
          <ToolbarDropdownBody
            searchValue={branchSearch}
            onSearchChange={setBranchSearch}>
            {branchesLoading && (
              <div className="px-4 py-2 text-zinc-400 text-sm">Loading...</div>
            )}
            {branchesError && (
              <div className="px-4 py-2 text-red-400 text-sm">
                {branchesError}
              </div>
            )}
            {!branchesLoading &&
              filteredBranches.length === 0 &&
              !branchesError && (
                <div className="px-4 py-2 text-zinc-400 text-sm">
                  No results
                </div>
              )}
            {filteredBranches.map((branch) => (
              <ToolbarDropdownItem
                key={branch}
                label={branch}
                onClick={() => handleBranchSelect(branch)}
              />
            ))}
          </ToolbarDropdownBody>
        </Menu>
      </Group>
      <Group
        gap="xl"
        px="sm"
        className="flex-1 items-center justify-end">
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
