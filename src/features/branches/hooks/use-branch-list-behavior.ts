import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APP_EVENTS } from "@/shared/config/events";
import { getRepositoryState } from "@/shared/api/repositories";
import type { GitBranchRef, RepositoryState } from "@/shared/types/git";
import { useGitActionsStore } from "@/features/repository-workspace";
import { useRepoStore } from "@/features/repository-workspace";
import {
  DEFAULT_REF_PRESENCE_FILTER,
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace";
import type { RefPresenceFilter } from "@/features/repository-workspace";
import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import { groupBranches } from "@/shared/lib/tree/branch-tree";
import {
  writeClipboardText,
  writeClipboardTextFromPromise,
} from "@/shared/platform/clipboard";
import {
  buildDefaultWorktreeFolder,
  generateRandomWorkbranchName,
} from "@/features/worktrees";
import {
  checkoutGitBranch,
  createGitBranch,
  createGitWorktree,
  deleteGitBranch,
  getBranches,
  getBranchRefs,
  getBranchTipSha,
  getCurrentBranch,
  getWorktrees,
  renameGitBranch,
  runGitBranchOperation,
  runRemoteBranchAction as runRemoteGitBranchAction,
} from "../api";
import type {
  BranchContextMenuState,
  BranchContextRequest,
  BranchComparisonSelection,
  BranchCreateFormState,
  BranchType,
  BranchOperationCommand,
  MenuPosition,
  PendingRemoteBranchAction,
  RemoteBranchActionCommand,
} from "../types";
import {
  buildBranchName,
  dispatchBranchRefreshEvents,
  getErrorDetails,
} from "../utils";

type BranchListState = {
  repoPath: string | null;
  branchRefs: GitBranchRef[];
  hasLoadedOnce: boolean;
};

type CachedBranchListState = Pick<BranchListState, "branchRefs">;

const branchListCacheByRepo = new Map<string, CachedBranchListState>();

function getInitialBranchListState(repoPath: string | undefined): BranchListState {
  if (!repoPath) {
    return {
      repoPath: null,
      branchRefs: [],
      hasLoadedOnce: false,
    };
  }

  const cached = branchListCacheByRepo.get(repoPath);

  return {
    repoPath,
    branchRefs: cached?.branchRefs ?? [],
    hasLoadedOnce: Boolean(cached),
  };
}

function cacheBranchList(repoPath: string, branchRefs: GitBranchRef[]) {
  branchListCacheByRepo.set(repoPath, {
    branchRefs,
  });
}

function hasPresence(branchRef: GitBranchRef, filter: RefPresenceFilter) {
  return Boolean(
    (filter.local && branchRef.localName) ||
      (filter.remote && branchRef.originName),
  );
}

function branchTypeToPresenceFilter(type: BranchType): RefPresenceFilter {
  return type === "remote"
    ? { local: false, remote: true }
    : { local: true, remote: false };
}

function branchPresenceFilterToType(filter: RefPresenceFilter): BranchType {
  return filter.remote && !filter.local ? "remote" : "local";
}

export function useBranchListBehavior() {
  const activeTabId = useRepoStore((state) => state.activeTabId);
  const tab = useRepoStore((state) =>
    state.tabs.find((currentTab) => currentTab.id === activeTabId),
  );
  const repoPath = tab?.repoPath;
  const selectedBranch = tab?.selectedBranch;
  const setTabBranch = useRepoStore((state) => state.setTabBranch);
  const updateTab = useRepoStore((state) => state.updateTab);
  const addRecentRepo = useRepoStore((state) => state.addRecentRepo);
  const pendingGitAction = useGitActionsStore((state) => state.pendingAction);
  const setPendingGitAction = useGitActionsStore(
    (state) => state.setPendingAction,
  );
  const setGitActionNotice = useGitActionsStore((state) => state.setNotice);
  const branchTreeExpanded = useWorkspaceUiStore((state) =>
    repoPath
      ? (state.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
          .branchTreeExpanded
      : DEFAULT_REPO_WORKSPACE_STATE.branchTreeExpanded,
  );
  const branchPresenceFilter = useWorkspaceUiStore((state) =>
    repoPath
      ? ((state.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
          .branchPresenceFilter ?? DEFAULT_REF_PRESENCE_FILTER)
      : DEFAULT_REF_PRESENCE_FILTER,
  );
  const setBranchTreeExpanded = useWorkspaceUiStore(
    (state) => state.setBranchTreeExpanded,
  );
  const setBranchPresenceFilterStore = useWorkspaceUiStore(
    (state) => state.setBranchPresenceFilter,
  );

  const [branchListState, setBranchListState] = useState<BranchListState>(() =>
    getInitialBranchListState(repoPath),
  );
  const [loading, setLoading] = useState(
    () => Boolean(repoPath) && !branchListState.hasLoadedOnce,
  );
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRowBranch, setSelectedRowBranch] = useState<string | null>(
    null,
  );
  const [branchActionLoading, setBranchActionLoading] = useState(false);
  const [renameRequest, setRenameRequest] =
    useState<BranchContextRequest | null>(null);
  const [renameBranchName, setRenameBranchName] = useState("");
  const [deleteRequest, setDeleteRequest] =
    useState<BranchContextRequest | null>(null);
  const [contextMenu, setContextMenu] =
    useState<BranchContextMenuState | null>(null);
  const [createForm, setCreateForm] = useState<BranchCreateFormState | null>(
    null,
  );
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [createBranchError, setCreateBranchError] = useState<string | null>(
    null,
  );
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [creatingWorktree, setCreatingWorktree] = useState(false);
  const [branchComparison, setBranchComparison] =
    useState<BranchComparisonSelection | null>(null);
  const [repositoryState, setRepositoryState] =
    useState<RepositoryState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const branchRefreshRequestRef = useRef(0);
  const requiresInitialCommit = repositoryState?.hasCommits === false;
  const activeBranchListState =
    branchListState.repoPath === (repoPath ?? null)
      ? branchListState
      : getInitialBranchListState(repoPath);
  const { branchRefs, hasLoadedOnce } = activeBranchListState;
  const branchType = useMemo(
    () => branchPresenceFilterToType(branchPresenceFilter),
    [branchPresenceFilter],
  );

  const refreshBranches = useCallback(async () => {
    if (!repoPath) return;
    const requestId = branchRefreshRequestRef.current + 1;
    branchRefreshRequestRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const nextBranchRefs = await getBranchRefs(repoPath);

      if (branchRefreshRequestRef.current !== requestId) return;
      cacheBranchList(repoPath, nextBranchRefs);
      setBranchListState({
        repoPath,
        branchRefs: nextBranchRefs,
        hasLoadedOnce: true,
      });
    } catch (branchError) {
      if (branchRefreshRequestRef.current !== requestId) return;
      setError(String(branchError));
    } finally {
      if (branchRefreshRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [repoPath]);

  const setType = useCallback(
    (nextType: BranchType) => {
      if (!repoPath) return;
      setBranchPresenceFilterStore(repoPath, branchTypeToPresenceFilter(nextType));
    },
    [repoPath, setBranchPresenceFilterStore],
  );

  useEffect(() => {
    const nextState = getInitialBranchListState(repoPath);
    setBranchListState(nextState);
    setLoading(Boolean(repoPath) && !nextState.hasLoadedOnce);
    setError(null);
  }, [repoPath]);

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
    void refreshBranches();
  }, [refreshBranches]);

  useEffect(() => {
    if (!repoPath) {
      setRepositoryState(null);
      return;
    }

    let cancelled = false;

    const refreshRepositoryState = async () => {
      try {
        const nextState = await getRepositoryState(repoPath);
        if (!cancelled) {
          setRepositoryState(nextState);
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
  }, [repoPath]);

  useEffect(() => {
    setSelectedRowBranch(selectedBranch ?? null);
  }, [repoPath, selectedBranch]);

  useEffect(() => {
    const handleRepoRefsRefresh = () => {
      void refreshBranches();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      window.removeEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    };
  }, [refreshBranches]);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current || !menuPos) return;
    const rect = menuRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    let nextY = menuPos.y;

    if (menuPos.y + rect.height > windowHeight - 8) {
      nextY = Math.max(8, menuPos.y - rect.height);
    }

    if (nextY !== menuPos.y) {
      setMenuPos({ x: menuPos.x, y: nextY });
    }
  }, [contextMenu, menuPos]);

  const branchRefByName = useMemo(
    () => new Map(branchRefs.map((branchRef) => [branchRef.name, branchRef])),
    [branchRefs],
  );

  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase();
    const activePresenceFilter = branchTypeToPresenceFilter(branchType);
    const visibleBranchNames = branchRefs
      .filter((branchRef) => hasPresence(branchRef, activePresenceFilter))
      .filter((branchRef) =>
        query ? branchRef.name.toLowerCase().includes(query) : true,
      )
      .map((branchRef) => branchRef.name);

    return groupBranches(visibleBranchNames);
  }, [branchRefs, branchType, search]);

  const isRowActionsVisible = useCallback(
    (rowKey: string) =>
      hoveredRowKey === rowKey || contextMenu?.node?.full === rowKey,
    [hoveredRowKey, contextMenu],
  );

  const openContextMenu = useCallback((node: BranchTreeNode, x: number, y: number) => {
    setContextMenu({ x, y, node });
    setMenuPos({ x, y });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const toggleGroup = useCallback(
    (nodeFull: string, isOpen: boolean) => {
      if (!repoPath) return;
      setBranchTreeExpanded(repoPath, {
        ...branchTreeExpanded,
        [nodeFull]: !isOpen,
      });
    },
    [branchTreeExpanded, repoPath, setBranchTreeExpanded],
  );

  const beginCreateBranch = useCallback(
    (baseRef: string, prefix = "") => {
      if (requiresInitialCommit) {
        setCreateBranchError(
          "Create the initial commit before creating branches.",
        );
        return;
      }

      setCreateBranchError(null);
      setCreateForm({
        baseRef,
        prefix,
        name: "",
      });
    },
    [requiresInitialCommit],
  );

  const cancelCreateBranch = useCallback(() => {
    setCreateForm(null);
    setCreateBranchError(null);
  }, []);

  const createBranch = useCallback(async () => {
    if (!repoPath || !createForm || creatingBranch) return;

    const branchName = buildBranchName(createForm.prefix, createForm.name);
    if (!branchName) {
      setCreateBranchError("Branch name is required.");
      return;
    }

    setCreatingBranch(true);
    setCreateBranchError(null);

    try {
      await createGitBranch(repoPath, branchName, createForm.baseRef);

      setCreateForm(null);
      if (branchType !== "local") {
        setBranchPresenceFilterStore(repoPath, branchTypeToPresenceFilter("local"));
      }
      setSelectedRowBranch(branchName);
      await refreshBranches();
      setGitActionNotice({
        kind: "success",
        title: "Created branch",
        details: `Created ${branchName} from ${createForm.baseRef}.`,
        expanded: false,
      });
      window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
      window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
    } catch (branchError) {
      const details = getErrorDetails(branchError);
      setCreateBranchError(details);
      setGitActionNotice({
        kind: "error",
        title: "Create branch failed",
        details,
        expanded: false,
      });
    } finally {
      setCreatingBranch(false);
    }
  }, [
    branchType,
    createForm,
    creatingBranch,
    refreshBranches,
    repoPath,
    setBranchPresenceFilterStore,
    setGitActionNotice,
  ]);

  const notifyError = useCallback(
    (title: string, noticeError: unknown) => {
      setGitActionNotice({
        kind: "error",
        title,
        details: getErrorDetails(noticeError),
        expanded: false,
      });
    },
    [setGitActionNotice],
  );

  const refreshBranchState = useCallback(
    async (selectedRowAfter?: string | null) => {
      dispatchBranchRefreshEvents();

      if (!repoPath || !activeTabId) return;

      try {
        const currentBranch = await getCurrentBranch(repoPath);
        const nextBranch = currentBranch === "Detached HEAD" ? null : currentBranch;
        setTabBranch(activeTabId, nextBranch);

        if (selectedRowAfter !== undefined) {
          setSelectedRowBranch(selectedRowAfter);
        } else {
          setSelectedRowBranch(nextBranch);
        }
      } catch {
        if (selectedRowAfter !== undefined) {
          setSelectedRowBranch(selectedRowAfter);
        }
      }
    },
    [activeTabId, repoPath, setTabBranch],
  );

  const checkoutBranch = useCallback(
    async (branchName: string) => {
      if (!repoPath || !activeTabId || pendingGitAction || branchActionLoading) {
        return;
      }

      setBranchActionLoading(true);
      try {
        await checkoutGitBranch(repoPath, branchName);

        setTabBranch(activeTabId, branchName);
        setSelectedRowBranch(branchName);
        setGitActionNotice({
          kind: "success",
          title: "Checked out branch",
          details: `Checked out ${branchName}.`,
          expanded: false,
        });
        await refreshBranchState(branchName);
      } catch (checkoutError) {
        notifyError("Checkout failed", checkoutError);
        await refreshBranchState();
      } finally {
        setBranchActionLoading(false);
      }
    },
    [
      activeTabId,
      branchActionLoading,
      notifyError,
      pendingGitAction,
      refreshBranchState,
      repoPath,
      setGitActionNotice,
      setTabBranch,
    ],
  );

  const runBranchOperation = useCallback(
    async (
      command: BranchOperationCommand,
      targetBranch: string,
      successTitle: string,
      successDetails: string,
      failureTitle: string,
      selectedRowAfter: string | null,
    ) => {
      if (!repoPath || !selectedBranch || pendingGitAction || branchActionLoading) {
        return;
      }

      setBranchActionLoading(true);
      try {
        await runGitBranchOperation(
          repoPath,
          command,
          targetBranch,
          selectedBranch,
        );
        setGitActionNotice({
          kind: "success",
          title: successTitle,
          details: successDetails,
          expanded: false,
        });
        await refreshBranchState(selectedRowAfter);
      } catch (operationError) {
        notifyError(failureTitle, operationError);
        await refreshBranchState();
      } finally {
        setBranchActionLoading(false);
      }
    },
    [
      branchActionLoading,
      notifyError,
      pendingGitAction,
      refreshBranchState,
      repoPath,
      selectedBranch,
      setGitActionNotice,
    ],
  );

  const copyText = useCallback(
    async (text: string, successTitle: string, successDetails: string) => {
      try {
        await writeClipboardText(text);
        setGitActionNotice({
          kind: "success",
          title: successTitle,
          details: successDetails,
          expanded: false,
        });
      } catch (copyError) {
        notifyError("Copy failed", copyError);
      }
    },
    [notifyError, setGitActionNotice],
  );

  const copyBranchTipSha = useCallback(
    async (branchName: string) => {
      if (!repoPath) return;

      try {
        const shaPromise = getBranchTipSha(repoPath, branchName);
        await writeClipboardTextFromPromise(shaPromise);
        const sha = await shaPromise;
        setGitActionNotice({
          kind: "success",
          title: "Copied commit SHA",
          details: `Copied ${branchName} tip ${sha.slice(0, 12)}.`,
          expanded: false,
        });
      } catch (copyError) {
        notifyError("Copy commit SHA failed", copyError);
      }
    },
    [notifyError, repoPath, setGitActionNotice],
  );

  const renameBranch = useCallback(async () => {
    if (!repoPath || !renameRequest || branchActionLoading) return;

    const nextName = renameBranchName.trim();
    if (!nextName || nextName === renameRequest.branchName) return;

    setBranchActionLoading(true);
    try {
      await renameGitBranch(repoPath, renameRequest.branchName, nextName);
      setGitActionNotice({
        kind: "success",
        title: "Renamed branch",
        details: `Renamed ${renameRequest.branchName} to ${nextName}.`,
        expanded: false,
      });
      setRenameRequest(null);
      await refreshBranchState(nextName);
    } catch (renameError) {
      notifyError("Rename branch failed", renameError);
      await refreshBranchState();
    } finally {
      setBranchActionLoading(false);
    }
  }, [
    branchActionLoading,
    notifyError,
    refreshBranchState,
    renameBranchName,
    renameRequest,
    repoPath,
    setGitActionNotice,
  ]);

  const deleteBranch = useCallback(async () => {
    if (!repoPath || !deleteRequest || branchActionLoading) return;

    setBranchActionLoading(true);
    try {
      await deleteGitBranch(repoPath, deleteRequest.branchName);
      setGitActionNotice({
        kind: "success",
        title: "Deleted branch",
        details: `Deleted ${deleteRequest.branchName}.`,
        expanded: false,
      });
      await refreshBranchState(undefined);
      setDeleteRequest(null);
    } catch (deleteError) {
      notifyError("Delete branch failed", deleteError);
      await refreshBranchState();
    } finally {
      setBranchActionLoading(false);
    }
  }, [
    branchActionLoading,
    deleteRequest,
    notifyError,
    refreshBranchState,
    repoPath,
    setGitActionNotice,
  ]);

  const runRemoteBranchAction = useCallback(
    async (
      command: RemoteBranchActionCommand,
      branchName: string,
      pendingAction: PendingRemoteBranchAction,
      successTitle: string,
      successDetails: string,
      failureTitle: string,
    ) => {
      if (!repoPath || pendingGitAction) return;

      setPendingGitAction(pendingAction);
      try {
        await runRemoteGitBranchAction(repoPath, command, branchName);
        setGitActionNotice({
          kind: "success",
          title: successTitle,
          details: successDetails,
          expanded: false,
        });
        dispatchBranchRefreshEvents();
      } catch (actionError) {
        setGitActionNotice({
          kind: "error",
          title: failureTitle,
          details: getErrorDetails(actionError),
          expanded: false,
        });
      } finally {
        setPendingGitAction(null);
      }
    },
    [pendingGitAction, repoPath, setGitActionNotice, setPendingGitAction],
  );

  const createRandomWorktreeFromBranch = useCallback(
    async (baseRef: string) => {
      if (!repoPath || !activeTabId || creatingWorktree) return;
      if (requiresInitialCommit) {
        setGitActionNotice({
          kind: "error",
          title: "Create worktree failed",
          details: "Create the initial commit before creating worktrees.",
          expanded: false,
        });
        return;
      }

      setCreatingWorktree(true);
      try {
        const [allBranches, worktrees] = await Promise.all([
          getBranches(repoPath, "local"),
          getWorktrees(repoPath),
        ]);
        const mainWorktreePath =
          worktrees.find((worktree) => worktree.isMain)?.path ??
          worktrees[0]?.path ??
          repoPath;
        const existingNames = [
          ...allBranches,
          ...worktrees.map((worktree) => worktree.branch ?? ""),
          ...worktrees.map((worktree) => worktree.name),
        ];
        const branch = generateRandomWorkbranchName(existingNames);
        const worktreePath = buildDefaultWorktreeFolder(mainWorktreePath, branch);
        const created = await createGitWorktree(
          repoPath,
          worktreePath,
          branch,
          baseRef,
        );

        updateTab(activeTabId, {
          repoPath: created.path,
          selectedBranch: created.branch ?? branch,
          selectedCommit: null,
        });
        addRecentRepo(created.path);
        setSelectedRowBranch(created.branch ?? branch);
        setGitActionNotice({
          kind: "success",
          title: "Created worktree",
          details: `Created ${created.branch ?? branch} from ${baseRef} at ${created.path}.`,
          expanded: false,
        });
        dispatchBranchRefreshEvents();
      } catch (worktreeError) {
        setGitActionNotice({
          kind: "error",
          title: "Create worktree failed",
          details: getErrorDetails(worktreeError),
          expanded: false,
        });
      } finally {
        setCreatingWorktree(false);
      }
    },
    [
      activeTabId,
      addRecentRepo,
      creatingWorktree,
      repoPath,
      requiresInitialCommit,
      setGitActionNotice,
      updateTab,
    ],
  );

  const requestRenameBranch = useCallback((branchName: string) => {
    setRenameBranchName(branchName);
    setRenameRequest({ branchName });
  }, []);

  const requestDeleteBranch = useCallback((branchName: string) => {
    setDeleteRequest({ branchName });
  }, []);

  const openBranchCompare = useCallback(
    (comparison: BranchComparisonSelection) => {
      if (requiresInitialCommit) {
        setGitActionNotice({
          kind: "error",
          title: "Compare branches failed",
          details: "Create the initial commit before comparing branches.",
          expanded: false,
        });
        return;
      }

      setBranchComparison(comparison);
    },
    [requiresInitialCommit, setGitActionNotice],
  );

  const closeBranchCompare = useCallback(() => {
    setBranchComparison(null);
  }, []);

  const cancelRenameBranch = useCallback(() => {
    if (branchActionLoading) return;
    setRenameRequest(null);
  }, [branchActionLoading]);

  const cancelDeleteBranch = useCallback(() => {
    if (branchActionLoading) return;
    setDeleteRequest(null);
  }, [branchActionLoading]);

  return {
    repoPath,
    selectedBranch,
    branchTreeExpanded,
    type: branchType,
    branchRefByName,
    grouped,
    loading,
    hasLoadedOnce,
    error,
    search,
    setSearch,
    selectedRowBranch,
    setSelectedRowBranch,
    branchActionLoading,
    renameRequest,
    renameBranchName,
    setRenameBranchName,
    deleteRequest,
    setType,
    contextMenu,
    createForm,
    setCreateForm,
    creatingBranch,
    createBranchError,
    menuPos,
    menuRef,
    creatingWorktree,
    branchComparison,
    requiresInitialCommit,
    isRowActionsVisible,
    setHoveredRowKey,
    openContextMenu,
    closeContextMenu,
    toggleGroup,
    beginCreateBranch,
    cancelCreateBranch,
    createBranch,
    checkoutBranch,
    runBranchOperation,
    copyText,
    copyBranchTipSha,
    openBranchCompare,
    closeBranchCompare,
    renameBranch,
    deleteBranch,
    runRemoteBranchAction,
    createRandomWorktreeFromBranch,
    requestRenameBranch,
    requestDeleteBranch,
    cancelRenameBranch,
    cancelDeleteBranch,
  };
}
