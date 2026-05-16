import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APP_EVENTS } from "@/shared/config/events";
import { useGitActionsStore } from "@/features/repository-workspace/stores/gitActionsStore";
import { useRepoStore } from "@/features/repository-workspace/stores/repoStore";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace/stores/workspaceUiStore";
import type { BranchTreeNode } from "@/shared/lib/tree/branchTree";
import { groupBranches } from "@/shared/lib/tree/branchTree";
import {
  buildDefaultWorktreeFolder,
  generateRandomWorkbranchName,
} from "@/features/worktrees/utils/worktreeDefaults";
import {
  checkoutGitBranch,
  createGitBranch,
  createGitWorktree,
  deleteGitBranch,
  getBranches,
  getBranchTipSha,
  getCurrentBranch,
  getWorktrees,
  renameGitBranch,
  runGitBranchOperation,
  runRemoteBranchAction as runRemoteGitBranchAction,
} from "./api";
import type {
  BranchContextMenuState,
  BranchContextRequest,
  BranchCreateFormState,
  BranchOperationCommand,
  BranchType,
  MenuPosition,
  PendingRemoteBranchAction,
  RemoteBranchActionCommand,
} from "./types";
import {
  buildBranchName,
  dispatchBranchRefreshEvents,
  filterBranchesByType,
  getErrorDetails,
} from "./utils";

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
  const setBranchTreeExpanded = useWorkspaceUiStore(
    (state) => state.setBranchTreeExpanded,
  );

  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [type, setType] = useState<BranchType>("local");
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
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshBranches = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);

    try {
      const allBranches = await getBranches(repoPath, type);
      setBranches(filterBranchesByType(allBranches, type));
    } catch (branchError) {
      setError(String(branchError));
    } finally {
      setLoading(false);
    }
  }, [repoPath, type]);

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

  const grouped = useMemo(
    () =>
      groupBranches(
        branches.filter((branch) =>
          search.trim()
            ? branch.toLowerCase().includes(search.trim().toLowerCase())
            : true,
        ),
      ),
    [branches, search],
  );

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

  const beginCreateBranch = useCallback((baseRef: string, prefix = "") => {
    setCreateBranchError(null);
    setCreateForm({
      baseRef,
      prefix,
      name: "",
    });
  }, []);

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
      setType("local");
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
  }, [createForm, creatingBranch, refreshBranches, repoPath, setGitActionNotice]);

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
        await navigator.clipboard.writeText(text);
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
        const sha = await getBranchTipSha(repoPath, branchName);
        await copyText(
          sha,
          "Copied commit SHA",
          `Copied ${branchName} tip ${sha.slice(0, 12)}.`,
        );
      } catch (copyError) {
        notifyError("Copy commit SHA failed", copyError);
      }
    },
    [copyText, notifyError, repoPath],
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
      setDeleteRequest(null);
      await refreshBranchState(undefined);
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
    grouped,
    loading,
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
    type,
    setType,
    contextMenu,
    createForm,
    setCreateForm,
    creatingBranch,
    createBranchError,
    menuPos,
    menuRef,
    creatingWorktree,
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
