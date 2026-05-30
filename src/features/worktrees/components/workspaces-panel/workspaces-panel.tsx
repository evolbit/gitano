import { Menu } from "@mantine/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  createGitWorktree,
  getWorktrees,
  removeGitWorktree,
} from "@/shared/api/git/worktrees";
import { getRepositoryState } from "@/shared/api/repositories";
import { APP_EVENTS } from "@/shared/config/events";
import { openDirectoryDialog } from "@/shared/platform/tauri/dialog";
import { ConfirmModal } from "@/shared/components/confirm-modal/confirm-modal";
import {
  IconArrowFork,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconFolder,
  IconPlus,
  IconSearch,
} from "@/shared/components/icons/icons";
import { useGitActionsStore } from "@/features/repository-workspace";
import { useRepoStore } from "@/features/repository-workspace";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace";
import type { GitWorktree } from "@/shared/types/git";
import type { RepositoryState } from "@/shared/types/git";
import { groupNames, type BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import { getParentPath } from "@/shared/lib/path";
import {
  buildDefaultWorktreeFolder,
  getDefaultBranchFromName,
  getDefaultNameFromRef,
} from "../../utils/worktree-defaults";
import {
  getCreateBaseOptions,
  getWorktreeDisplayName,
  getWorktreeTreeKey,
  normalizeWorktreeSearch,
  pinMainWorktreeFirst,
} from "../../utils/worktree-tree";

type WorkspacesPanelProps = {
  repoPath: string;
};

type CreateFormState = {
  baseRef: string | null;
  branch: string;
  name: string;
  folder: string;
  branchTouched: boolean;
  folderTouched: boolean;
};

type WorktreeContextMenu = {
  x: number;
  y: number;
  worktree: GitWorktree;
};

type WorktreeDeleteRequest = {
  worktree: GitWorktree;
  force: boolean;
};

const EMPTY_CREATE_FORM: CreateFormState = {
  baseRef: null,
  branch: "",
  name: "",
  folder: "",
  branchTouched: false,
  folderTouched: false,
};

const WORKTREE_CREATE_MENU_ITEM_CLASS =
  "px-4 py-3 transition-colors hover:!bg-zinc-800 focus:!bg-zinc-800 data-[hovered=true]:!bg-zinc-800";
const WORKTREE_TREE_INDENT_STEP = 18;
const WORKTREE_GROUP_BASE_INDENT = 10;
const WORKTREE_ROW_BASE_INDENT = 28;
const DETACHED_HEAD_LABEL = "Detached HEAD";
const SHORT_COMMIT_SHA_LENGTH = 7;

function getWorktreeBranchLabel(worktree: GitWorktree) {
  if (worktree.branch) return worktree.branch;
  if (worktree.head) {
    return `${DETACHED_HEAD_LABEL} @ ${worktree.head.slice(0, SHORT_COMMIT_SHA_LENGTH)}`;
  }

  return DETACHED_HEAD_LABEL;
}

export function WorkspacesPanel({ repoPath }: WorkspacesPanelProps) {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const activeTab = useRepoStore((s) => s.tabs.find((tab) => tab.id === activeTabId));
  const updateTab = useRepoStore((s) => s.updateTab);
  const addRecentRepo = useRepoStore((s) => s.addRecentRepo);
  const removeRepo = useRepoStore((s) => s.removeRepo);
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);
  const worktreeTreeExpanded = useWorkspaceUiStore(
    (s) =>
      (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
        .worktreeTreeExpanded ?? DEFAULT_REPO_WORKSPACE_STATE.worktreeTreeExpanded,
  );
  const worktreeCreateBaseRef = useWorkspaceUiStore(
    (s) =>
      (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
        .worktreeCreateBaseRef ?? null,
  );
  const setWorktreeTreeExpanded = useWorkspaceUiStore(
    (s) => s.setWorktreeTreeExpanded,
  );
  const setWorktreeCreateBaseRef = useWorkspaceUiStore(
    (s) => s.setWorktreeCreateBaseRef,
  );

  const [worktrees, setWorktrees] = useState<GitWorktree[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [selectedWorktreePath, setSelectedWorktreePath] = useState<string | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<WorktreeContextMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [deleteRequest, setDeleteRequest] =
    useState<WorktreeDeleteRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [repositoryState, setRepositoryState] =
    useState<RepositoryState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeTabBranch =
    activeTab?.repoPath === repoPath ? activeTab.selectedBranch : null;
  const activeRepositoryState =
    repositoryState?.path === repoPath ? repositoryState : null;
  const currentWorktree =
    worktrees.find((worktree) => worktree.isCurrent) ?? null;
  const requiresInitialCommit = activeRepositoryState?.hasCommits === false;

  const currentBranch =
    activeRepositoryState?.isDetached || currentWorktree?.isDetached
      ? null
      : (activeRepositoryState?.branch ??
        currentWorktree?.branch ??
        activeTabBranch ??
        null);
  const currentWorktreePath = currentWorktree?.path ?? null;

  const createBaseOptions = useMemo(
    () => getCreateBaseOptions(currentBranch),
    [currentBranch],
  );

  const mainWorktreePath =
    worktrees.find((worktree) => worktree.isMain)?.path ??
    worktrees[0]?.path ??
    repoPath;

  const refreshWorktrees = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextWorktrees = await getWorktrees(repoPath);
      setWorktrees(nextWorktrees);
    } catch (worktreeError) {
      setError(String(worktreeError));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    void refreshWorktrees();
  }, [refreshWorktrees]);

  useEffect(() => {
    if (worktrees.length === 0) {
      setSelectedWorktreePath(null);
      return;
    }

    setSelectedWorktreePath((current) => {
      if (current && worktrees.some((worktree) => worktree.path === current)) {
        return current;
      }

      return currentWorktreePath ?? worktrees[0]?.path ?? null;
    });
  }, [currentWorktreePath, worktrees]);

  useEffect(() => {
    let cancelled = false;

    const refreshRepositoryState = async () => {
      try {
        const nextState = await getRepositoryState(repoPath);
        if (!cancelled) {
          setRepositoryState(nextState);
          if (nextState.hasCommits === false) {
            setWorktreeCreateBaseRef(repoPath, null);
          }
        }
      } catch {
        if (!cancelled) {
          setRepositoryState(null);
        }
      }
    };

    void refreshRepositoryState();

    const handleRepoRefsRefresh = () => {
      void refreshRepositoryState();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    };
  }, [repoPath, setWorktreeCreateBaseRef]);

  useEffect(() => {
    const handleRepoRefsRefresh = () => {
      void refreshWorktrees();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      window.removeEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    };
  }, [refreshWorktrees]);

  useEffect(() => {
    if (!contextMenu) return;

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (
      !activeTabId ||
      activeTab?.repoPath !== repoPath ||
      activeTab.selectedBranch === currentBranch
    ) {
      return;
    }

    updateTab(activeTabId, { selectedBranch: currentBranch });
  }, [
    activeTab?.repoPath,
    activeTab?.selectedBranch,
    activeTabId,
    currentBranch,
    repoPath,
    updateTab,
  ]);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current || !menuPos) return;

    const rect = menuRef.current.getBoundingClientRect();
    const nextPos = { ...menuPos };

    if (menuPos.y + rect.height > window.innerHeight - 8) {
      nextPos.y = Math.max(8, menuPos.y - rect.height);
    }

    if (menuPos.x + rect.width > window.innerWidth - 8) {
      nextPos.x = Math.max(8, window.innerWidth - rect.width - 8);
    }

    if (nextPos.x !== menuPos.x || nextPos.y !== menuPos.y) {
      setMenuPos(nextPos);
    }
  }, [contextMenu, menuPos]);

  const beginCreateFromBase = useCallback(
    (baseRef: string) => {
      if (requiresInitialCommit) {
        setCreateError("Create the initial commit before creating worktrees.");
        return;
      }

      const defaultName = getDefaultNameFromRef(baseRef);
      const defaultBranch = getDefaultBranchFromName(
        baseRef === defaultName ? `${defaultName}-worktree` : defaultName,
      );

      setCreateError(null);
      setWorktreeCreateBaseRef(repoPath, baseRef);
      setForm({
        baseRef,
        branch: defaultBranch,
        name: defaultName,
        folder: buildDefaultWorktreeFolder(mainWorktreePath, defaultName),
        branchTouched: false,
        folderTouched: false,
      });
    },
    [mainWorktreePath, repoPath, requiresInitialCommit, setWorktreeCreateBaseRef],
  );

  useEffect(() => {
    if (!worktreeCreateBaseRef) {
      setForm(EMPTY_CREATE_FORM);
      return;
    }

    setForm((current) => {
      if (current.baseRef === worktreeCreateBaseRef) return current;

      const defaultName = getDefaultNameFromRef(worktreeCreateBaseRef);
      const defaultBranch = getDefaultBranchFromName(
        worktreeCreateBaseRef === defaultName
          ? `${defaultName}-worktree`
          : defaultName,
      );

      return {
        baseRef: worktreeCreateBaseRef,
        branch: defaultBranch,
        name: defaultName,
        folder: buildDefaultWorktreeFolder(mainWorktreePath, defaultName),
        branchTouched: false,
        folderTouched: false,
      };
    });
  }, [mainWorktreePath, worktreeCreateBaseRef]);

  const filteredWorktrees = useMemo(() => {
    const term = normalizeWorktreeSearch(search);
    if (!term) return worktrees;

    return worktrees.filter((worktree) =>
      [
        getWorktreeDisplayName(worktree),
        worktree.branch ?? "",
        worktree.path,
        worktree.head ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [search, worktrees]);

  const worktreeByTreeKey = useMemo(() => {
    const entries = filteredWorktrees.map(
      (worktree) => [getWorktreeTreeKey(worktree), worktree] as const,
    );
    return new Map(entries);
  }, [filteredWorktrees]);

  const groupedWorktrees = useMemo(() => {
    const mainWorktreeKey =
      filteredWorktrees.find((worktree) => worktree.isMain) ?? null;
    const grouped = groupNames(filteredWorktrees.map(getWorktreeTreeKey));

    return pinMainWorktreeFirst(
      grouped,
      mainWorktreeKey ? getWorktreeTreeKey(mainWorktreeKey) : null,
    );
  }, [filteredWorktrees]);

  const selectWorktree = useCallback(
    (worktree: GitWorktree) => {
      if (!activeTabId) return;

      setCreateError(null);
      setForm(EMPTY_CREATE_FORM);
      setWorktreeCreateBaseRef(repoPath, null);
      updateTab(activeTabId, {
        repoPath: worktree.path,
        selectedBranch: worktree.branch,
        selectedCommit: null,
      });
      addRecentRepo(worktree.path);
    },
    [activeTabId, addRecentRepo, repoPath, setWorktreeCreateBaseRef, updateTab],
  );

  const openContextMenu = useCallback(
    (worktree: GitWorktree, x: number, y: number) => {
      setSelectedWorktreePath(worktree.path);
      setContextMenu({ x, y, worktree });
      setMenuPos({ x, y });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const isRowActionsVisible = useCallback(
    (rowKey: string) =>
      hoveredRowKey === rowKey || contextMenu?.worktree.path === rowKey,
    [hoveredRowKey, contextMenu],
  );

  const removeWorktree = useCallback(
    async (worktree: GitWorktree, force: boolean) => {
      if (worktree.isMain || worktree.isCurrent || deleting) return;

      setDeleting(true);
      setError(null);
      try {
        await removeGitWorktree(repoPath, worktree.path, force);
        removeRepo(worktree.path);
        await refreshWorktrees();
        window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
        setGitActionNotice({
          kind: "success",
          title: force
            ? "git worktree remove --force succeeded"
            : "git worktree remove succeeded",
          details: `Deleted worktree ${getWorktreeDisplayName(worktree)} at ${worktree.path}.`,
          expanded: false,
        });
      } catch (worktreeError) {
        const details =
          worktreeError instanceof Error
            ? worktreeError.message
            : String(worktreeError || "Unknown error");
        setGitActionNotice({
          kind: "error",
          title: force
            ? "git worktree remove --force failed"
            : "git worktree remove failed",
          details,
          expanded: false,
        });
      } finally {
        setDeleting(false);
        setDeleteRequest(null);
      }
    },
    [deleting, refreshWorktrees, removeRepo, repoPath, setGitActionNotice],
  );

  const updateName = (nextName: string) => {
    setForm((current) => {
      const nextBranch = current.branchTouched
        ? current.branch
        : getDefaultBranchFromName(nextName);
      const nextFolder = current.folderTouched
        ? current.folder
        : buildDefaultWorktreeFolder(mainWorktreePath, nextName);

      return {
        ...current,
        name: nextName,
        branch: nextBranch,
        folder: nextFolder,
      };
    });
  };

  const browseFolder = async () => {
    const defaultPath = form.folder ? getParentPath(form.folder) : mainWorktreePath;
    const selected = await openDirectoryDialog(defaultPath);

    if (selected && typeof selected === "string") {
      setForm((current) => ({
        ...current,
        folder: selected,
        folderTouched: true,
      }));
    }
  };

  const createWorktree = async () => {
    if (!activeTabId || !form.baseRef || creating || requiresInitialCommit) return;

    setCreating(true);
    setCreateError(null);

    try {
      const created = await createGitWorktree(
        repoPath,
        form.folder,
        form.branch,
        form.baseRef,
      );

      setWorktreeCreateBaseRef(repoPath, null);
      setForm(EMPTY_CREATE_FORM);
      updateTab(activeTabId, {
        repoPath: created.path,
        selectedBranch: created.branch ?? form.branch,
        selectedCommit: null,
      });
      addRecentRepo(created.path);
      window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
      window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
    } catch (worktreeError) {
      setCreateError(String(worktreeError));
    } finally {
      setCreating(false);
    }
  };

  function renderTree(nodes: BranchTreeNode[], level = 0) {
    return (
      <ul className="m-0 w-full min-w-0 list-none p-0 select-none">
        {nodes.map((node) => {
          if (node.type === "group") {
            const isOpen = worktreeTreeExpanded[node.full] ?? true;

            return (
              <li key={node.full} className="w-full">
                <div
                  className="flex h-7 w-full min-w-0 cursor-pointer items-center gap-1 px-2 text-sm text-muted-foreground transition-colors hover:bg-background-emphasis"
                  style={{
                    fontSize: "var(--ui-font-size-sm)",
                    fontWeight: 500,
                    paddingLeft: `${WORKTREE_GROUP_BASE_INDENT + level * WORKTREE_TREE_INDENT_STEP}px`,
                  }}
                  onClick={() => {
                    setWorktreeTreeExpanded(repoPath, {
                      ...worktreeTreeExpanded,
                      [node.full]: !isOpen,
                    });
                  }}>
                  <span className="inline-flex h-4 w-4 items-center justify-center text-zinc-500">
                    {isOpen ? (
                      <IconChevronDown size={13} />
                    ) : (
                      <IconChevronRight size={13} />
                    )}
                  </span>
                  <span className="inline-flex h-4 w-4 items-center justify-center">
                    <IconFolder size={15} className="text-slate-300" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{node.name}</span>
                </div>
                {isOpen ? renderTree(node.children, level + 1) : null}
              </li>
            );
          }

          const worktree = worktreeByTreeKey.get(node.full);
          if (!worktree) return null;

          const isSelected = selectedWorktreePath === worktree.path;
          const rowStateClass = isSelected
            ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
            : "text-foreground hover:bg-background-emphasis";

          return (
            <li
              key={worktree.path}
              className={`group flex min-h-8 w-full min-w-0 cursor-pointer items-center gap-1 px-2 py-0.5 text-sm transition-colors ${rowStateClass}`}
              style={{
                fontSize: "var(--ui-font-size-sm)",
                paddingLeft: `${WORKTREE_ROW_BASE_INDENT + level * WORKTREE_TREE_INDENT_STEP}px`,
              }}
              tabIndex={0}
              onMouseEnter={() => setHoveredRowKey(worktree.path)}
              onMouseLeave={() => setHoveredRowKey(null)}
              onClick={() => setSelectedWorktreePath(worktree.path)}
              onDoubleClick={() => {
                setSelectedWorktreePath(worktree.path);
                selectWorktree(worktree);
              }}>
              <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
                {worktree.isMain ? null : (
                  <IconArrowFork
                    size={15}
                    className={worktree.isCurrent ? "text-blue-300" : "text-slate-300"}
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="min-w-0 truncate font-medium leading-5">
                  {getWorktreeDisplayName(worktree)}
                </span>
                <span className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground">
                  {getWorktreeBranchLabel(worktree)} - {worktree.path}
                </span>
              </span>
              <button
                className={`ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-zinc-700 ${
                  isRowActionsVisible(worktree.path) ? "visible" : "invisible"
                }`}
                title="More actions"
                type="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  openContextMenu(worktree, rect.right, rect.bottom);
                }}>
                <IconDotsVertical size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderContextMenu() {
    if (!contextMenu || !menuPos) return null;

    const { worktree } = contextMenu;
    const canUseWorktree = !worktree.isCurrent;
    const canDelete = !worktree.isMain && !worktree.isCurrent;
    const actionClass = "px-4 py-2 hover:bg-zinc-700 cursor-pointer whitespace-nowrap";
    const disabledActionClass =
      "px-4 py-2 text-zinc-500 cursor-not-allowed whitespace-nowrap";
    const disabledReason = worktree.isMain
      ? "The main worktree cannot be deleted"
      : "Switch to another worktree before deleting this one";
    const useWorktreeDisabledReason = "This worktree is already active";

    return ReactDOM.createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          top: menuPos.y,
          left: menuPos.x,
          zIndex: 99999,
        }}
        className="bg-background-emphasis border border-border rounded shadow-lg py-1 text-xs text-zinc-200 select-none z-[99999] min-w-[260px]">
        <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
          Worktree actions
        </div>
        <div
          className={canUseWorktree ? actionClass : disabledActionClass}
          title={canUseWorktree ? undefined : useWorktreeDisabledReason}
          onClick={
            canUseWorktree
              ? () => {
                  setSelectedWorktreePath(worktree.path);
                  closeContextMenu();
                  selectWorktree(worktree);
                }
              : undefined
          }>
          Use Worktree
        </div>
        <div
          className={canDelete ? `${actionClass} text-red-400` : disabledActionClass}
          title={canDelete ? undefined : disabledReason}
          onClick={
            canDelete
              ? () => {
                  closeContextMenu();
                  setDeleteRequest({ worktree, force: false });
                }
              : undefined
          }>
          Delete {getWorktreeDisplayName(worktree)}
        </div>
        <div
          className={
            canDelete
              ? `${actionClass} text-red-400`
              : disabledActionClass
          }
          title={canDelete ? undefined : disabledReason}
          onClick={
            canDelete
              ? () => {
                  closeContextMenu();
                  setDeleteRequest({ worktree, force: true });
                }
              : undefined
          }>
          Delete {getWorktreeDisplayName(worktree)} (forced)
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="h-full flex flex-col relative min-w-0 overflow-hidden bg-background">
      <div className="border-b border-border bg-background-emphasis p-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search workspaces..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          <Menu shadow="md" width={420} position="bottom-end" withinPortal>
            <Menu.Target>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={requiresInitialCommit}
                title={
                  requiresInitialCommit
                    ? "Create the initial commit before creating worktrees"
                    : "Create worktree"
                }
                aria-label="Create worktree">
                <IconPlus size={16} />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="bg-background border border-zinc-700 p-0">
              {requiresInitialCommit ? (
                <div className="px-4 py-3 text-sm text-zinc-400">
                  Create the initial commit before creating worktrees.
                </div>
              ) : null}
              {createBaseOptions.map((option) => (
                <Menu.Item
                  key={option.refName}
                  className={WORKTREE_CREATE_MENU_ITEM_CLASS}
                  onClick={() => beginCreateFromBase(option.refName)}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-zinc-300">
                      <IconArrowFork size={16} />
                    </span>
                    <span className="min-w-0 truncate text-sm text-zinc-100">
                      {option.label}
                    </span>
                  </div>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {loading ? <div className="px-3 py-2 text-sm text-zinc-400">Loading...</div> : null}
      {error ? <div className="px-3 py-2 text-sm text-red-400">{error}</div> : null}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!loading && !error && groupedWorktrees.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No workspaces found
          </div>
        ) : null}
        {!error ? renderTree(groupedWorktrees) : null}
        {renderContextMenu()}
      </div>

      {form.baseRef ? (
        <div className="border-t border-border bg-background-emphasis p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
            <IconArrowFork size={15} className="text-blue-300" />
            <span className="min-w-0 truncate">
              New worktree based on{" "}
              <span className="font-mono text-blue-200">{form.baseRef}</span>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Branch
              <input
                type="text"
                className="h-8 rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none"
                value={form.branch}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branch: event.target.value,
                    branchTouched: true,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Name
              <input
                type="text"
                className="h-8 rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none"
                value={form.name}
                onChange={(event) => updateName(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Working tree folder
              <div className="flex min-w-0 gap-2">
                <input
                  type="text"
                  className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none"
                  value={form.folder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      folder: event.target.value,
                      folderTouched: true,
                    }))
                  }
                />
                <button
                  type="button"
                  className="h-8 rounded border border-border bg-background px-2 text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                  onClick={() => {
                    void browseFolder();
                  }}>
                  Select
                </button>
              </div>
            </label>
          </div>
          {createError ? (
            <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
              {createError}
            </div>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="h-8 rounded border border-border bg-background px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
              onClick={() => setWorktreeCreateBaseRef(repoPath, null)}
              disabled={creating}>
              Cancel
            </button>
            <button
              type="button"
              className="h-8 rounded border border-blue-500/50 bg-blue-500/20 px-3 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                void createWorktree();
              }}
              disabled={
                creating ||
                !form.branch.trim() ||
                !form.name.trim() ||
                !form.folder.trim()
              }>
              {creating ? "Creating..." : "Create Worktree"}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={deleteRequest !== null}
        title="Delete Worktree"
        description={
          <>
            Delete worktree{" "}
            <span className="font-semibold text-zinc-100">
              {deleteRequest ? getWorktreeDisplayName(deleteRequest.worktree) : ""}
            </span>
            {deleteRequest?.force ? " (forced)" : ""}
            ?
          </>
        }
        details={
          deleteRequest ? (
            <>
              This runs{" "}
              <span className="font-mono text-zinc-300">
                git worktree remove{deleteRequest.force ? " --force" : ""}
              </span>{" "}
              for{" "}
              <span className="font-mono text-zinc-300">
                {deleteRequest.worktree.path}
              </span>
              .{" "}
              {deleteRequest.force
                ? "Uncommitted changes in that folder can be lost."
                : "Git will refuse if it has uncommitted changes."}
            </>
          ) : null
        }
        variant="danger"
        confirmLabel={
          deleteRequest?.force ? "Delete Worktree (forced)" : "Delete Worktree"
        }
        cancelLabel="Cancel"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setDeleteRequest(null);
        }}
        onConfirm={() => {
          if (!deleteRequest) return;
          void removeWorktree(deleteRequest.worktree, deleteRequest.force);
        }}
      />
    </div>
  );
}
