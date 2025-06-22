import { Box, Button, Group, Text, TextInput } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import { useRepoStore } from "../store/repo";
import { openLocalRepoDialog } from "../utils/openRepo";
import { IconFolder, IconPlug, IconSearch } from "./icons";

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

interface RepoInfo {
  path: string;
  name: string;
  branch: string | null;
  loading: boolean;
  error: string | null;
}

const RepoRow = ({
  repoInfo,
  onClick,
}: {
  repoInfo: RepoInfo;
  onClick: () => void;
}) => {
  return (
    <Group
      className="py-1 px-2 hover:bg-zinc-800 rounded cursor-pointer text-sm"
      justify="space-between"
      wrap="nowrap"
      onClick={onClick}>
      <Group
        gap={8}
        wrap="nowrap"
        align="center">
        <IconFolder
          size={16}
          className="text-blue-400"
        />
        <Text className="text-zinc-100 font-medium">{repoInfo.name}</Text>
        {repoInfo.loading ? (
          <Text className="text-zinc-400 text-xs">Cargando...</Text>
        ) : repoInfo.error ? (
          <Text className="text-red-400 text-xs">Error</Text>
        ) : repoInfo.branch ? (
          <Text className="text-zinc-400 text-xs bg-zinc-700 px-2 py-1 rounded">
            {repoInfo.branch}
          </Text>
        ) : (
          <Text className="text-zinc-500 text-xs">Sin rama</Text>
        )}
      </Group>
    </Group>
  );
};

interface HomePageProps {
  onRepoOpened?: (repoPath: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onRepoOpened }) => {
  const recentRepos = useRepoStore((s) => s.recentRepos);
  const setCurrentRepo = useRepoStore((s) => s.setCurrentRepo);
  const [repoInfos, setRepoInfos] = useState<RepoInfo[]>([]);

  // Función para cargar la rama de un repositorio
  const loadRepoBranch = async (repoPath: string): Promise<string | null> => {
    try {
      const branch = await invoke<string>("get_current_branch", {
        path: repoPath,
      });
      return branch;
    } catch (error) {
      console.error(`Error loading branch for ${repoPath}:`, error);
      return null;
    }
  };

  // Función para cargar todas las ramas de los repositorios recientes
  const loadAllRepoBranches = async () => {
    const newRepoInfos: RepoInfo[] = recentRepos.map((repoPath) => ({
      path: repoPath,
      name: repoPath.split("/").pop() || repoPath,
      branch: null,
      loading: true,
      error: null,
    }));

    setRepoInfos(newRepoInfos);

    // Cargar las ramas de forma individual y concurrente
    const branchPromises = newRepoInfos.map(async (repoInfo, index) => {
      try {
        const branch = await loadRepoBranch(repoInfo.path);
        setRepoInfos((prev) =>
          prev.map((info, i) =>
            i === index
              ? { ...info, branch, loading: false, error: null }
              : info
          )
        );
      } catch (error) {
        setRepoInfos((prev) =>
          prev.map((info, i) =>
            i === index
              ? {
                  ...info,
                  loading: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Error desconocido",
                }
              : info
          )
        );
      }
    });

    await Promise.all(branchPromises);
  };

  // Cargar las ramas cuando cambien los repositorios recientes
  useEffect(() => {
    if (recentRepos.length > 0) {
      loadAllRepoBranches();
    } else {
      setRepoInfos([]);
    }
  }, [recentRepos]);

  const handleOpenRepo = async () => {
    const repoPath = await openLocalRepoDialog();
    if (repoPath) {
      setCurrentRepo(repoPath);
      // The onRepoOpened prop might now be redundant since the logic is in the store
      onRepoOpened?.(repoPath);
    }
  };

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
            onClick={handleOpenRepo}>
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
        {repoInfos.length > 0 && (
          <Section
            title="Recent repositories"
            actions={
              <Text className="text-xs text-zinc-400">{repoInfos.length}</Text>
            }>
            {repoInfos.map((repoInfo) => (
              <RepoRow
                key={repoInfo.path}
                repoInfo={repoInfo}
                onClick={() => setCurrentRepo(repoInfo.path)}
              />
            ))}
          </Section>
        )}
        <Section
          title="Favorites"
          actions={null}>
          <Text className="text-zinc-500 text-xs px-2 py-1">No matches</Text>
        </Section>
        <Section
          title="All repositories"
          actions={<Text className="text-xs text-zinc-400">4</Text>}>
          {mockRepos.map((repo) => (
            <RepoRow
              key={repo.name + "-all"}
              repoInfo={{
                path: repo.name,
                name: repo.name,
                branch: repo.branch,
                loading: false,
                error: null,
              }}
              onClick={() => setCurrentRepo(repo.name)}
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
