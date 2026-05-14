import {
  Box,
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { core } from "@tauri-apps/api";
import React, { useEffect, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { APP_EVENTS } from "../../constants/events";
import { useRepoStore } from "../../store/repo";
import { useGitActionsStore } from "../../store/gitActions";
import {
  PullStrategy,
  useWorkspaceUiStore,
} from "../../store/workspaceUi";
import {
  IconArrowBarToUp,
  IconBrandGit,
  IconCheck,
  IconCloudDownload,
  IconCloudUpload,
  IconGitBranch,
  IconSearch,
  IconStack2,
  IconX,
} from "../icons";
import {
  PullStrategyOption,
  RemoteActionButtonProps,
  TopToolbarProps,
  ToolbarDropdownProps,
} from "./types";

const TOOLBAR_DROPDOWN_RESULTS_MAX_HEIGHT = "80vh";
const TOOLBAR_SELECTOR_DROPDOWN_PANEL_WIDTH = 420;
const GIT_ACTION_SUCCESS_SNACKBAR_MS = 3200;
const GIT_ACTION_ERROR_SNACKBAR_MS = 8000;

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

const PULL_STRATEGIES: PullStrategyOption[] = [
  { value: "fetch-all", label: "Fetch All" },
  {
    value: "pull-ff-if-possible",
    label: "Pull (fast-forward if possible)",
  },
  { value: "pull-ff-only", label: "Pull (fast-forward only)" },
  { value: "pull-rebase", label: "Pull (rebase)" },
];

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

const ToolbarDropdownItem: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
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

const RemoteActionButton: React.FC<RemoteActionButtonProps> = ({
  label,
  icon,
  onClick,
  disabled = false,
  loading = false,
  tooltip,
  rightSlot,
}) => {
  const content = (
    <div
      className={`flex h-full overflow-hidden rounded border transition-colors ${
        loading
          ? "border-zinc-700/80 bg-zinc-800/70"
          : disabled
          ? "border-transparent opacity-45"
          : "border-transparent hover:border-zinc-700/80 hover:bg-zinc-800/70"
      }`}>
      <button
        type="button"
        className={`flex min-w-[60px] flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 text-left ${
          loading
            ? "cursor-progress text-zinc-400"
            : disabled
            ? "cursor-not-allowed text-zinc-500"
            : "cursor-pointer text-zinc-400"
        }`}
        onClick={onClick}
        disabled={disabled || loading}>
        <Text
          size="xs"
          className={`text-[10px] leading-none ${
            disabled ? "text-zinc-500" : "text-zinc-400"
          }`}>
          {label}
        </Text>
        <div className={disabled ? "text-zinc-500" : "text-zinc-100"}>
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500/40 border-t-zinc-100" />
          ) : (
            icon
          )}
        </div>
      </button>
      {rightSlot}
    </div>
  );

  if (!tooltip || disabled) {
    return content;
  }

  return (
    <Tooltip
      label={tooltip}
      openDelay={150}>
      {content}
    </Tooltip>
  );
};

function getPullStrategyLabel(strategy: PullStrategy) {
  return (
    PULL_STRATEGIES.find((option) => option.value === strategy)?.label ??
    PULL_STRATEGIES[1].label
  );
}

const TopToolbar: React.FC<TopToolbarProps> = () => {
  const [repoSearch, setRepoSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [repoMenuOpened, setRepoMenuOpened] = useState(false);
  const [branchMenuOpened, setBranchMenuOpened] = useState(false);
  const [pullMenuOpened, setPullMenuOpened] = useState(false);
  const [branchesRefreshNonce, setBranchesRefreshNonce] = useState(0);
  const gitActionNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const tabs = useRepoStore((s) => s.tabs);
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const setActiveTab = useRepoStore((s) => s.setActiveTab);
  const setTabBranch = useRepoStore((s) => s.setTabBranch);
  const pullStrategy = useWorkspaceUiStore((s) => s.pullStrategy);
  const setPullStrategy = useWorkspaceUiStore((s) => s.setPullStrategy);
  const pendingGitAction = useGitActionsStore((s) => s.pendingAction);
  const setPendingGitAction = useGitActionsStore((s) => s.setPendingAction);
  const gitActionNotice = useGitActionsStore((s) => s.notice);
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);
  const tab = tabs.find((t) => t.id === activeTabId);
  const repoPath = tab?.repoPath;
  const selectedBranch = tab?.selectedBranch;

  const openedRepos = tabs.filter((t) => t.id !== "home" && t.repoPath);
  const getRepoName = (path: string) =>
    path.split("/").filter(Boolean).pop() || path;

  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

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
      .catch((e) => setBranchesError(String(e)))
      .finally(() => setBranchesLoading(false));
  }, [repoPath, branchesRefreshNonce]);

  const filteredRepos = openedRepos.filter((t) =>
    getRepoName(t.repoPath).toLowerCase().includes(repoSearch.toLowerCase()),
  );
  const filteredBranches = branches.filter((b) =>
    b.toLowerCase().includes(branchSearch.toLowerCase()),
  );

  const resolvedBranch =
    selectedBranch || (branchesLoading ? null : branches[0] || null);

  const pushTooltip = resolvedBranch
    ? `Push to origin/${resolvedBranch}`
    : "Push current branch";
  const pullTooltip = getPullStrategyLabel(pullStrategy);

  const handleRepoSelect = (id: string) => {
    setActiveTab(id);
    setRepoMenuOpened(false);
  };

  const handleBranchSelect = (branch: string) => {
    if (activeTabId) setTabBranch(activeTabId, branch);
    setBranchMenuOpened(false);
  };

  useEffect(() => {
    if (gitActionNoticeTimeoutRef.current) {
      clearTimeout(gitActionNoticeTimeoutRef.current);
      gitActionNoticeTimeoutRef.current = null;
    }

    if (!gitActionNotice || gitActionNotice.expanded) {
      return;
    }

    gitActionNoticeTimeoutRef.current = setTimeout(
      () => {
        setGitActionNotice(null);
        gitActionNoticeTimeoutRef.current = null;
      },
      gitActionNotice.kind === "success"
        ? GIT_ACTION_SUCCESS_SNACKBAR_MS
        : GIT_ACTION_ERROR_SNACKBAR_MS,
    );

    return () => {
      if (gitActionNoticeTimeoutRef.current) {
        clearTimeout(gitActionNoticeTimeoutRef.current);
        gitActionNoticeTimeoutRef.current = null;
      }
    };
  }, [gitActionNotice]);

  const handleGitActionSuccess = (title: string, details: string) => {
    setGitActionNotice({
      kind: "success",
      title,
      details,
      expanded: false,
    });
  };

  const handleGitActionError = (title: string, error: unknown) => {
    const details =
      error instanceof Error ? error.message : String(error || "Unknown error");

    setGitActionNotice({
      kind: "error",
      title,
      details,
      expanded: false,
    });
  };

  const refreshToolbarData = () => {
    setBranchesRefreshNonce((value) => value + 1);
  };

  useEffect(() => {
    const handleRepoRefsRefresh = () => {
      setBranchesRefreshNonce((value) => value + 1);
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      window.removeEventListener(
        APP_EVENTS.repoRefsRefresh,
        handleRepoRefsRefresh,
      );
    };
  }, []);

  const executePull = async () => {
    if (!repoPath || pendingGitAction) return;

    setPendingGitAction("pull");
    await waitForNextFrame();

    try {
      if (pullStrategy === "fetch-all") {
        await core.invoke("git_fetch", { path: repoPath });
        handleGitActionSuccess(
          "git fetch succeeded",
          "Fetched all configured remotes successfully.",
        );
      } else {
        await core.invoke("git_pull", { path: repoPath, strategy: pullStrategy });
        handleGitActionSuccess(
          "git pull succeeded",
          `Completed ${getPullStrategyLabel(pullStrategy)} for the active repository.`,
        );
      }

      refreshToolbarData();
    } catch (error) {
      handleGitActionError(
        pullStrategy === "fetch-all" ? "git fetch failed" : "git pull failed",
        error,
      );
    } finally {
      setPendingGitAction(null);
    }
  };

  const executePush = async () => {
    if (!repoPath || pendingGitAction) return;

    setPendingGitAction("push");
    await waitForNextFrame();

    try {
      await core.invoke("git_push", { path: repoPath });
      handleGitActionSuccess(
        "git push succeeded",
        resolvedBranch
          ? `Pushed the current branch to origin/${resolvedBranch}.`
          : "Pushed the current branch successfully.",
      );
      refreshToolbarData();
      window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
    } catch (error) {
      handleGitActionError("git push failed", error);
    } finally {
      setPendingGitAction(null);
    }
  };

  const executeStash = async () => {
    if (!repoPath || pendingGitAction) return;

    setPendingGitAction("stash");
    await waitForNextFrame();

    try {
      const stashMessage = `WIP-${resolvedBranch ?? "HEAD"}`;
      await core.invoke("git_stash_all", {
        path: repoPath,
        message: stashMessage,
      });
      handleGitActionSuccess(
        "git stash succeeded",
        `Created stash with message ${stashMessage}.`,
      );
      refreshToolbarData();
      window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
      window.dispatchEvent(new CustomEvent(APP_EVENTS.stashesRefresh));
    } catch (error) {
      handleGitActionError("git stash failed", error);
    } finally {
      setPendingGitAction(null);
    }
  };

  const executePop = async () => {
    if (!repoPath || pendingGitAction) return;

    setPendingGitAction("pop");
    await waitForNextFrame();

    try {
      await core.invoke("git_stash_pop", { path: repoPath });
      handleGitActionSuccess(
        "git stash pop succeeded",
        "Popped the most recent stash entry.",
      );
      refreshToolbarData();
      window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
      window.dispatchEvent(new CustomEvent(APP_EVENTS.stashesRefresh));
    } catch (error) {
      handleGitActionError("git stash pop failed", error);
    } finally {
      setPendingGitAction(null);
    }
  };

  const isGitActionDisabled = !repoPath || pendingGitAction !== null;

  const pullRightSlot = (
    <Menu
      shadow="md"
      width={340}
      opened={pullMenuOpened}
      onOpen={() => setPullMenuOpened(true)}
      onClose={() => setPullMenuOpened(false)}
      position="bottom-end"
      offset={6}
      withinPortal>
      <Menu.Target>
        <button
          type="button"
          className={`flex w-7 items-center justify-center ${
            isGitActionDisabled
              ? "cursor-not-allowed text-zinc-500"
              : "cursor-pointer text-zinc-300 hover:bg-zinc-800/70"
          }`}
          disabled={isGitActionDisabled}
          aria-label="Select pull strategy">
          <HiChevronDown size={16} />
        </button>
      </Menu.Target>
      <Menu.Dropdown className="min-w-[340px] bg-background border border-zinc-700 p-0">
        <div className="px-4 py-3 text-sm text-zinc-200">
          Select a default pull/fetch operation to execute when clicking this
          button
        </div>
        <div className="pb-2">
          {PULL_STRATEGIES.map((strategy) => {
            const selected = pullStrategy === strategy.value;
            return (
              <button
                key={strategy.value}
                type="button"
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-base transition-colors ${
                  selected
                    ? "bg-lime-900/50 text-white"
                    : "text-zinc-200 hover:bg-zinc-800"
                }`}
                onClick={() => {
                  setPullStrategy(strategy.value);
                  setPullMenuOpened(false);
                }}>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    selected
                      ? "border-zinc-100 text-zinc-100"
                      : "border-zinc-400 text-transparent"
                  }`}>
                  {selected ? <IconCheck size={14} /> : null}
                </span>
                <span>{strategy.label}</span>
              </button>
            );
          })}
        </div>
      </Menu.Dropdown>
    </Menu>
  );

  return (
    <>
      <Group
        px={0}
        py={0}
        className="bg-background h-[52px] sticky top-0 z-30 w-full m-0 flex items-center justify-between border-b !border-border">
        <Group
          px="sm"
          gap="xs"
          wrap="nowrap"
          className="h-full flex-none items-center overflow-hidden">
          <Menu
            shadow="md"
            offset={0}
            position="bottom-start"
            width={TOOLBAR_SELECTOR_DROPDOWN_PANEL_WIDTH}
            opened={repoMenuOpened}
            onOpen={() => setRepoMenuOpened(true)}
            onClose={() => setRepoMenuOpened(false)}>
            <Menu.Target>
              <Box className="inline-flex max-w-[300px] items-center gap-1.5 rounded px-2 py-1 text-zinc-400 transition-colors hover:bg-zinc-800/50 cursor-pointer">
                <IconBrandGit
                  size={16}
                  className="text-blue-400"
                />
                <Text
                  size="sm"
                  className="max-w-[240px] truncate text-sm text-zinc-400 font-medium">
                  {repoPath ? getRepoName(repoPath) : "No repository"}
                </Text>
                <HiChevronDown
                  className="text-zinc-400 h-4 w-4"
                  size={14}
                />
              </Box>
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
          <Text
            size="sm"
            className="text-zinc-600 select-none">
            /
          </Text>
          <Menu
            shadow="md"
            offset={0}
            position="bottom-start"
            width={TOOLBAR_SELECTOR_DROPDOWN_PANEL_WIDTH}
            opened={branchMenuOpened}
            onOpen={() => setBranchMenuOpened(true)}
            onClose={() => setBranchMenuOpened(false)}>
            <Menu.Target>
              <Box className="inline-flex max-w-[300px] items-center gap-1.5 rounded px-2 py-1 text-zinc-400 transition-colors hover:bg-zinc-800/50 cursor-pointer">
                <IconGitBranch
                  size={16}
                  className="text-lime-400"
                />
                <Text
                  size="sm"
                  className="max-w-[240px] truncate text-sm text-zinc-400 font-medium">
                  {selectedBranch ||
                    (branchesLoading ? "Loading..." : branches[0] || "No branch")}
                </Text>
                <HiChevronDown
                  className="text-zinc-400 h-4 w-4"
                  size={14}
                />
              </Box>
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
              {!branchesLoading && filteredBranches.length === 0 && !branchesError && (
                <div className="px-4 py-2 text-zinc-400 text-sm">No results</div>
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
          gap="xs"
          px="sm"
          className="flex-1 items-center justify-end">
          <RemoteActionButton
            label="Pull"
            icon={<IconCloudDownload size={16} />}
            onClick={() => {
              void executePull();
            }}
            disabled={isGitActionDisabled}
            loading={pendingGitAction === "pull"}
            tooltip={pullTooltip}
            rightSlot={pullRightSlot}
          />
          <RemoteActionButton
            label="Push"
            icon={<IconCloudUpload size={16} />}
            onClick={() => {
              void executePush();
            }}
            disabled={isGitActionDisabled}
            loading={pendingGitAction === "push"}
            tooltip={pushTooltip}
          />
          <Stack
            gap={0}
            align="center">
            <div className="flex min-w-[60px] flex-col items-center justify-center gap-0.5 rounded border border-transparent px-2.5 py-1.5 text-zinc-400 transition-colors hover:border-zinc-700/80 hover:bg-zinc-800/70">
              <Text
                size="xs"
                className="text-[10px] leading-none text-zinc-400">
                Branch
              </Text>
              <IconGitBranch size={16} className="text-zinc-100" />
            </div>
          </Stack>
          <Stack
            gap={0}
            align="center">
            <RemoteActionButton
              label="Stash"
              icon={<IconStack2 size={16} />}
              onClick={() => {
                void executeStash();
              }}
              disabled={isGitActionDisabled}
              loading={pendingGitAction === "stash"}
              tooltip="Stash all current working-tree changes"
            />
          </Stack>
          <Stack
            gap={0}
            align="center">
            <RemoteActionButton
              label="Pop"
              icon={<IconArrowBarToUp size={16} />}
              onClick={() => {
                void executePop();
              }}
              disabled={isGitActionDisabled}
              loading={pendingGitAction === "pop"}
              tooltip="Pop the most recent stash entry"
            />
          </Stack>
        </Group>
      </Group>

      {gitActionNotice ? (
        <div className="fixed bottom-4 left-1/2 z-[100100] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-200">
            <span
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                gitActionNotice.kind === "success"
                  ? "bg-lime-500/20 text-lime-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}>
              {gitActionNotice.kind === "success" ? (
                <IconCheck size={12} />
              ) : (
                <IconX size={12} />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">{gitActionNotice.title}</span>
            <button
              type="button"
              className="text-zinc-400 transition-colors hover:text-zinc-100"
              onClick={() =>
                setGitActionNotice({
                  ...gitActionNotice,
                  expanded: !gitActionNotice.expanded,
                })
              }>
              {gitActionNotice.expanded ? "Hide Log" : "View Log"}
            </button>
            <button
              type="button"
              className="text-zinc-400 transition-colors hover:text-zinc-100"
              onClick={() => setGitActionNotice(null)}
              aria-label="Dismiss git action notice">
              <IconX size={16} />
            </button>
          </div>
          {gitActionNotice.expanded ? (
            <pre className="max-h-56 overflow-auto border-t border-zinc-700 px-4 py-3 text-xs text-zinc-300 whitespace-pre-wrap">
              {gitActionNotice.details}
            </pre>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

export default TopToolbar;
