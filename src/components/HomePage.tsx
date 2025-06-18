import { ActionIcon, Box, Button, Group, Text, TextInput } from "@mantine/core";
import {
  IconChevronDown,
  IconFolder,
  IconGitBranch,
  IconPlug,
  IconSearch,
  IconStar,
} from "@tabler/icons-react";
import React from "react";
import { useRepoStore } from "../store/repo";
import { openLocalRepoDialog } from "../utils/openRepo";

const mockRepos = [
  {
    name: "efectoled-backend",
    user: "dg-admin",
    branch: "feature/OYS-24721_CC_BACKOFFICE_...",
    stats: "+1 -55",
  },
  {
    name: "microservices",
    user: "dg-admin",
    branch: "feature/OYS-24721_CC_BACKOFFICE_...",
    stats: "+1",
  },
  {
    name: "Intro",
    user: "dg-admin",
    branch: "main",
    stats: "+221",
  },
];

const exampleCommits = [
  {
    hash: "a1b2c3d4",
    parents: [],
    branch: "main",
  },
  {
    hash: "e5f6g7h8",
    parents: ["a1b2c3d4"],
    branch: "main",
  },
  {
    hash: "i9j0k1l2",
    parents: ["e5f6g7h8"],
    branch: "feature",
  },
  {
    hash: "m3n4o5p6",
    parents: ["e5f6g7h8"],
    branch: "main",
  },
  {
    hash: "q7r8s9t0",
    parents: ["i9j0k1l2", "m3n4o5p6"],
    branch: "main",
  },
];

const Section = ({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <Box className="mb-6">
    <Group
      justify="space-between"
      className="mb-1">
      <Text className="text-zinc-200 font-semibold text-sm">{title}</Text>
      {actions}
    </Group>
    <Box>{children}</Box>
  </Box>
);

const RepoRow = ({ repo }: { repo: (typeof mockRepos)[0] }) => (
  <Group
    className="py-1 px-2 hover:bg-zinc-800 rounded cursor-pointer text-sm"
    justify="space-between"
    wrap="nowrap">
    <Group
      gap={8}
      wrap="nowrap">
      <IconFolder
        size={16}
        className="text-blue-400"
      />
      <Text className="text-zinc-100 font-medium">{repo.name}</Text>
      <Text className="text-zinc-400">{repo.user}</Text>
      <Box className="flex items-center gap-1 bg-zinc-900 px-2 py-0.5 rounded text-xs">
        <IconGitBranch
          size={14}
          className="text-lime-400"
        />
        <span className="text-zinc-200">{repo.branch}</span>
      </Box>
      <Box className="ml-2 bg-zinc-900 px-2 py-0.5 rounded text-xs text-green-400">
        {repo.stats}
      </Box>
    </Group>
    <Group
      gap={4}
      wrap="nowrap">
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm">
        <IconStar size={16} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm">
        <IconChevronDown size={16} />
      </ActionIcon>
    </Group>
  </Group>
);

interface HomePageProps {
  onRepoOpened?: (repoPath: string) => void;
}
const HomePage: React.FC<HomePageProps> = ({ onRepoOpened }) => {
  const setCurrentRepo = useRepoStore((s) => s.setCurrentRepo);

  return (
    <Box className="w-full h-full bg-zinc-900 text-zinc-100 p-8 overflow-auto">
      <Box className="flex items-center justify-between mb-6">
        <Text className="text-xl font-bold tracking-tight">
          Repository Management
        </Text>
        <Group gap={8}>
          <Button
            size="xs"
            variant="filled"
            color="blue"
            onClick={async () => {
              const repoPath = await openLocalRepoDialog();
              if (repoPath && onRepoOpened) onRepoOpened(repoPath);
            }}>
            Browse
          </Button>
          <Button
            size="xs"
            variant="outline"
            color="blue">
            Clone
          </Button>
          <Button
            size="xs"
            variant="outline"
            color="blue">
            Init
          </Button>
          <Button
            size="xs"
            variant="default"
            color="gray">
            New Workspace
          </Button>
          <Button
            size="xs"
            variant="default"
            color="gray">
            <IconPlug
              size={14}
              className="mr-1"
            />
            Integrations
          </Button>
        </Group>
      </Box>
      <Group
        className="mb-4"
        gap={8}>
        <Button
          size="xs"
          variant="subtle"
          color="gray">
          Collapse
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="gray">
          Expand
        </Button>
        <TextInput
          placeholder="Search repositories"
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
            input: "bg-zinc-800 text-zinc-200 placeholder-zinc-400 pl-8 w-72",
          }}
        />
        <Button
          size="xs"
          variant="subtle"
          color="gray">
          WIP summary
        </Button>
      </Group>
      <Box className="bg-zinc-800 rounded-lg p-6">
        <Section
          title="Open repositories"
          actions={<Text className="text-xs text-zinc-400">2</Text>}>
          {mockRepos.slice(0, 2).map((repo) => (
            <RepoRow
              key={repo.name}
              repo={repo}
            />
          ))}
        </Section>
        <Section
          title="Favorites"
          actions={null}>
          <Text className="text-zinc-500 text-xs px-2 py-1">No matches</Text>
        </Section>
        <Section
          title="Recent repositories"
          actions={<Text className="text-xs text-zinc-400">4</Text>}>
          {mockRepos.map((repo) => (
            <RepoRow
              key={repo.name + "-recent"}
              repo={repo}
            />
          ))}
        </Section>
        <Section
          title="All repositories"
          actions={<Text className="text-xs text-zinc-400">4</Text>}>
          {mockRepos.map((repo) => (
            <RepoRow
              key={repo.name + "-all"}
              repo={repo}
            />
          ))}
        </Section>
      </Box>
      <Text className="text-xs text-zinc-500 text-center mt-6">
        No Pull Requests
      </Text>
    </Box>
  );
};

export default HomePage;
