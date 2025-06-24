import { ActionIcon, Box, Button, Group, Menu, Text } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useEffect, useMemo, useState } from "react";
import { useRepoStore } from "../store/repo";
import { openLocalRepoDialog } from "../utils/openRepo";
import InputText from "./form/InputText";
import {
  IconDotsVertical,
  IconFolder,
  IconFolderPlus,
  IconPlug,
  IconSearch,
  IconStar,
} from "./icons";

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
  onToggleFavorite,
  onRemove,
  onOpenFolder,
  isFavorite,
}: {
  repoInfo: RepoInfo;
  onClick: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
  onOpenFolder: () => void;
  isFavorite: boolean;
}) => {
  return (
    <Group
      className="py-1 px-2 hover:bg-accent rounded cursor-pointer text-sm"
      justify="space-between"
      wrap="nowrap"
      onClick={onClick}>
      <Group
        gap={8}
        wrap="nowrap"
        align="center"
        style={{ flex: 1, overflow: "hidden" }}>
        <IconFolder
          size={16}
          className="text-blue-500"
        />
        <Text
          className="text-foreground font-medium"
          truncate>
          {repoInfo.name}
          dsd
        </Text>
        {repoInfo.loading ? (
          <Text className="text-muted-foreground text-xs">Cargando...</Text>
        ) : repoInfo.error ? (
          <Text className="text-red-500 text-xs">Error</Text>
        ) : repoInfo.branch ? (
          <Text className="text-muted-foreground text-xs bg-secondary px-2 py-1 rounded">
            {repoInfo.branch}
          </Text>
        ) : (
          <Text className="text-muted-foreground text-xs">Sin rama</Text>
        )}
      </Group>
      <Group
        gap={0}
        wrap="nowrap"
        onClick={(e) => e.stopPropagation()}>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onToggleFavorite}>
          <IconStar
            size={16}
            className={isFavorite ? "text-yellow-400" : "text-muted-foreground"}
            fill={isFavorite ? "currentColor" : "none"}
          />
        </ActionIcon>
        <Menu
          shadow="md"
          width={200}
          withinPortal
          position="bottom-end">
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray">
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item onClick={onClick}>Abrir</Menu.Item>
            <Menu.Item onClick={onToggleFavorite}>
              {isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            </Menu.Item>
            <Menu.Item onClick={onOpenFolder}>Abrir en el explorador</Menu.Item>
            <Menu.Divider />
            <Menu.Item
              color="red"
              onClick={onRemove}>
              Quitar de la lista
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
};

export const HomePage = ({
  onRepoOpened,
}: {
  onRepoOpened?: (path: string) => void;
}) => {
  const { recentRepos, favoriteRepos, toggleFavoriteRepo, removeRepo } =
    useRepoStore();
  const [repoInfos, setRepoInfos] = useState<RepoInfo[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const fetchBranches = async () => {
      const infos = await Promise.all(
        recentRepos.map(async (path) => {
          try {
            const branch = await invoke<string>("get_current_branch", {
              path,
            });
            const name = path.split("/").pop() || path;
            return {
              path,
              name,
              branch,
              loading: false,
              error: null,
            };
          } catch (error) {
            const name = path.split("/").pop() || path;
            console.error(`Failed to get branch for ${path}:`, error);
            return {
              path,
              name,
              branch: null,
              loading: false,
              error: "Failed to load branch",
            };
          }
        })
      );
      setRepoInfos(infos);
    };

    if (recentRepos.length > 0) {
      fetchBranches();
    } else {
      setRepoInfos([]);
    }
  }, [recentRepos]);

  const sortedRepoInfos = useMemo(() => {
    return [...repoInfos]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));
  }, [repoInfos, filter]);

  const favoriteRepoInfos = useMemo(
    () => sortedRepoInfos.filter((r) => favoriteRepos.includes(r.path)),
    [sortedRepoInfos, favoriteRepos]
  );

  const handleBrowse = async () => {
    const path = await openLocalRepoDialog();
    if (path) {
      onRepoOpened?.(path);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await revealItemInDir(path);
    } catch (error) {
      console.error(`Failed to open folder for ${path}:`, error);
    }
  };

  return (
    <Box className="p-4 h-full text-foreground">
      <Group
        justify="space-between"
        className="mb-6">
        <Text className="text-xl font-bold text-foreground">Lanzamiento</Text>
        <Group>
          <Button
            variant="default"
            size="xs">
            <IconPlug
              size={16}
              className="mr-2"
            />
            Connect
          </Button>
          <Button
            size="xs"
            onClick={handleBrowse}>
            <IconFolderPlus
              size={16}
              className="mr-2"
            />
            Browse
          </Button>
        </Group>
      </Group>

      <InputText
        placeholder="Filter repositories..."
        leftIcon={<IconSearch size={16} />}
        className="mb-6"
        value={filter}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setFilter(e.currentTarget.value)
        }
      />

      {favoriteRepoInfos.length > 0 && (
        <Section
          title="Favorites"
          actions={
            <Text className="text-xs text-muted-foreground">
              {favoriteRepoInfos.length}
            </Text>
          }>
          {favoriteRepoInfos.map((repoInfo) => (
            <RepoRow
              key={repoInfo.path}
              repoInfo={repoInfo}
              onClick={() => onRepoOpened?.(repoInfo.path)}
              onToggleFavorite={() => toggleFavoriteRepo(repoInfo.path)}
              onRemove={() => removeRepo(repoInfo.path)}
              onOpenFolder={() => handleOpenFolder(repoInfo.path)}
              isFavorite={true}
            />
          ))}
        </Section>
      )}

      {sortedRepoInfos.length > 0 && (
        <Section
          title="All Repositories"
          actions={
            <Text className="text-xs text-muted-foreground">
              {sortedRepoInfos.length}
            </Text>
          }>
          {sortedRepoInfos.map((repoInfo) => (
            <RepoRow
              key={repoInfo.path}
              repoInfo={repoInfo}
              onClick={() => onRepoOpened?.(repoInfo.path)}
              onToggleFavorite={() => toggleFavoriteRepo(repoInfo.path)}
              onRemove={() => removeRepo(repoInfo.path)}
              onOpenFolder={() => handleOpenFolder(repoInfo.path)}
              isFavorite={favoriteRepos.includes(repoInfo.path)}
            />
          ))}
        </Section>
      )}

      {repoInfos.length === 0 && (
        <Box className="text-center py-10">
          <Text>No repositories found.</Text>
          <Text className="text-muted-foreground text-sm">
            Use the "Browse" button to add your local repositories.
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default HomePage;
