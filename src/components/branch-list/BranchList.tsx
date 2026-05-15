import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { APP_EVENTS } from "../../constants/events";
import { useGitActionsStore } from "../../store/gitActions";
import { useRepoStore } from "../../store/repo";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "../../store/workspaceUi";
import {
  IconChevronDown,
  IconChevronRight,
  IconCloud,
  IconDeviceFloppy,
  IconDotsVertical,
  IconFolder,
  IconGitBranch,
  IconPlus,
  IconSearch,
} from "../icons";
import {
  BranchTreeNode,
  groupBranches,
  isPriorityBranchName,
} from "../../utils/branchTree";
import type { GitWorktree } from "../../types/git";
import {
  buildDefaultWorktreeFolder,
  generateRandomWorkbranchName,
} from "../../utils/worktreeDefaults";
import { ConfirmModal } from "../confirm-modal/ConfirmModal";

const PRIORITY_BRANCH_COLOR = "text-lime-400";
const DEFAULT_BRANCH_ICON_COLOR = "text-slate-300";

type BranchCreateFormState = {
  baseRef: string;
  prefix: string;
  name: string;
};

function stripEdgeSlashes(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function buildBranchName(prefix: string, name: string) {
  const cleanPrefix = prefix.replace(/^\/+/, "").replace(/\/+$/, "");
  const cleanName = stripEdgeSlashes(name);

  if (!cleanName) return "";
  if (!cleanPrefix) return cleanName;

  return `${cleanPrefix}/${cleanName}`;
}

function stripRemotePrefix(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(1).join("/");
}

function getBranchCreatePrefix(
  node: BranchTreeNode,
  branchType: "local" | "remote",
) {
  const localPath = branchType === "remote" ? stripRemotePrefix(node.full) : node.full;

  if (!localPath) return "";

  if (node.type === "group") {
    return `${stripEdgeSlashes(localPath)}/`;
  }

  const lastSlash = localPath.lastIndexOf("/");
  return lastSlash >= 0 ? `${localPath.slice(0, lastSlash)}/` : "";
}

function BranchName({ children }: { children: string }) {
  return <span className="font-semibold">{children}</span>;
}

function BranchIcon({ name }: { name: string }) {
  const priority = isPriorityBranchName(name);
  return (
    <span className="inline-flex items-center justify-center w-5 h-5">
      <IconGitBranch
        size={18}
        className={priority ? PRIORITY_BRANCH_COLOR : DEFAULT_BRANCH_ICON_COLOR}
      />
    </span>
  );
}

type BranchContextRequest = {
  branchName: string;
};

type BranchOperationCommand =
  | "git_branch_fast_forward_to_branch"
  | "git_branch_merge_into"
  | "git_branch_rebase_onto";

export function BranchList() {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;
  const selectedBranch = tab?.selectedBranch;
  const setTabBranch = useRepoStore((s) => s.setTabBranch);
  const updateTab = useRepoStore((s) => s.updateTab);
  const addRecentRepo = useRepoStore((s) => s.addRecentRepo);
  const pendingGitAction = useGitActionsStore((s) => s.pendingAction);
  const setPendingGitAction = useGitActionsStore((s) => s.setPendingAction);
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);
  const branchTreeExpanded = useWorkspaceUiStore((s) =>
    repoPath
      ? (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
          .branchTreeExpanded
      : DEFAULT_REPO_WORKSPACE_STATE.branchTreeExpanded
  );
  const setBranchTreeExpanded = useWorkspaceUiStore(
    (s) => s.setBranchTreeExpanded
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
  const [type, setType] = useState<"local" | "remote">("local");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: BranchTreeNode;
  } | null>(null);
  const [createForm, setCreateForm] = useState<BranchCreateFormState | null>(
    null,
  );
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [createBranchError, setCreateBranchError] = useState<string | null>(
    null,
  );
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showOther, setShowOther] = useState(false);
  const [creatingWorktree, setCreatingWorktree] = useState(false);
  const [submenuLeft, setSubmenuLeft] = useState(true);
  const [submenuDirection, setSubmenuDirection] = useState<"down" | "up">(
    "down"
  );
  const otherRef = useRef<HTMLDivElement>(null);
  const submenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshBranches = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const command = type === "local" ? "get_branches" : "get_remote_branches";
      const allBranches = await core.invoke<string[]>(command, { path: repoPath });

      if (type === "local") {
        // Only hide branches that start with <remote>/ (for example, origin/feature/foo), but NOT local ones with /
        setBranches(
          allBranches.filter(
            (b) =>
              !/^\w+\//.test(b) ||
              b.startsWith("feature/") ||
              b.startsWith("hotfix/") ||
              b.startsWith("release/") ||
              b.startsWith("bugfix/") ||
              b.startsWith("chore/") ||
              b.startsWith("test/") ||
              b.startsWith("fix/") ||
              b.startsWith("refactor/") ||
              b.startsWith("task/")
          )
        );
      } else {
        // Only include branches that start with <remote>/
        setBranches(allBranches.filter((b) => /^\w+\//.test(b)));
      }
    } catch (branchError) {
      setError(String(branchError));
    } finally {
      setLoading(false);
    }
  }, [repoPath, type]);

  // Clear the timeout on unmount (must live in the main body, not in renderContextMenu)
  useEffect(() => {
    return () => {
      if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
    };
  }, []);

  // Close the context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  const grouped = groupBranches(
    branches.filter((branch) =>
      search.trim()
        ? branch.toLowerCase().includes(search.trim().toLowerCase())
        : true,
    ),
  );

  // Adjust the context menu position if it overflows below the viewport
  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current || !menuPos) return;
    const rect = menuRef.current.getBoundingClientRect();
    const winH = window.innerHeight;
    let newY = menuPos.y;
    if (menuPos.y + rect.height > winH - 8) {
      newY = Math.max(8, menuPos.y - rect.height);
    }
    if (newY !== menuPos.y) setMenuPos({ x: menuPos.x, y: newY });
  }, [contextMenu, menuPos]);

  // Detect whether the submenu overflows the right or bottom edge of the viewport
  useLayoutEffect(() => {
    if (!showOther || !otherRef.current) return;
    const rect = otherRef.current.getBoundingClientRect();
    const submenuWidth = 200; // Estimated submenu width
    const submenuHeight = 220; // Estimated submenu height (adjust if you have more or fewer options)
    // Left/right
    if (rect.right + submenuWidth > window.innerWidth - 8) {
      setSubmenuLeft(false); // Open to the left
    } else {
      setSubmenuLeft(true); // Open to the right
    }
    // Up/down
    if (rect.bottom + submenuHeight > window.innerHeight - 8) {
      setSubmenuDirection("up");
    } else {
      setSubmenuDirection("down");
    }
  }, [showOther]);

  const isRowActionsVisible = useCallback(
    (rowKey: string) =>
      hoveredRowKey === rowKey || contextMenu?.node?.full === rowKey,
    [hoveredRowKey, contextMenu],
  );

  const beginCreateBranch = useCallback(
    (baseRef: string, prefix = "") => {
      setCreateBranchError(null);
      setCreateForm({
        baseRef,
        prefix,
        name: "",
      });
    },
    [],
  );

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
      await core.invoke("git_create_branch", {
        path: repoPath,
        branchName,
        baseRef: createForm.baseRef,
      });

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
      const details =
        branchError instanceof Error
          ? branchError.message
          : String(branchError || "Unknown error");
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
    createForm,
    creatingBranch,
    refreshBranches,
    repoPath,
    setGitActionNotice,
  ]);

  const notifyError = useCallback(
    (title: string, error: unknown) => {
      const details =
        error instanceof Error ? error.message : String(error || "Unknown error");
      setGitActionNotice({
        kind: "error",
        title,
        details,
        expanded: false,
      });
    },
    [setGitActionNotice],
  );

  const refreshBranchState = useCallback(
    async (selectedRowAfter?: string | null) => {
      window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
      window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
      window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));

      if (!repoPath || !activeTabId) {
        return;
      }

      try {
        const currentBranch = await core.invoke<string>("get_current_branch", {
          path: repoPath,
        });
        const nextBranch =
          currentBranch === "Detached HEAD" ? null : currentBranch;
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
      if (!repoPath || !activeTabId || pendingGitAction || branchActionLoading)
        return;

      setBranchActionLoading(true);
      try {
        await core.invoke("git_checkout_branch", {
          path: repoPath,
          branchName,
        });

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
      if (!repoPath || !selectedBranch || pendingGitAction || branchActionLoading)
        return;

      setBranchActionLoading(true);
      try {
        await core.invoke(command, {
          path: repoPath,
          targetBranch,
          sourceBranch: selectedBranch,
        });
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
        const sha = await core.invoke<string>("git_branch_tip_sha", {
          path: repoPath,
          branchName,
        });
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
      await core.invoke("git_rename_branch", {
        path: repoPath,
        oldBranchName: renameRequest.branchName,
        newBranchName: nextName,
      });
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
      await core.invoke("git_delete_branch", {
        path: repoPath,
        branchName: deleteRequest.branchName,
      });
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
      command: "git_branch_pull_fast_forward" | "git_branch_push" | "git_branch_set_upstream",
      branchName: string,
      pendingAction: "pull" | "push",
      successTitle: string,
      successDetails: string,
      failureTitle: string,
    ) => {
      if (!repoPath || pendingGitAction) return;

      setPendingGitAction(pendingAction);
      try {
        await core.invoke(command, {
          path: repoPath,
          branchName,
        });
        setGitActionNotice({
          kind: "success",
          title: successTitle,
          details: successDetails,
          expanded: false,
        });
        window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
        window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
        window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
      } catch (actionError) {
        const details =
          actionError instanceof Error
            ? actionError.message
            : String(actionError || "Unknown error");
        setGitActionNotice({
          kind: "error",
          title: failureTitle,
          details,
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
          core.invoke<string[]>("get_branches", { path: repoPath }),
          core.invoke<GitWorktree[]>("get_worktrees", { path: repoPath }),
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
        const created = await core.invoke<GitWorktree>("git_create_worktree", {
          path: repoPath,
          worktreePath,
          branch,
          baseRef,
        });

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
        window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
        window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
        window.dispatchEvent(new CustomEvent(APP_EVENTS.workingChangesRefresh));
      } catch (worktreeError) {
        const details =
          worktreeError instanceof Error
            ? worktreeError.message
            : String(worktreeError || "Unknown error");
        setGitActionNotice({
          kind: "error",
          title: "Create worktree failed",
          details,
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

  function renderTree(nodes: BranchTreeNode[], level = 0) {
    return (
      <ul className="m-0 w-full min-w-0 list-none p-0 select-none">
        {nodes.map((node) => {
          if (node.type === "group") {
            const isOpen = branchTreeExpanded[node.full] ?? true;
            const isPriorityGroup = isPriorityBranchName(node.name);
            return (
              <li
                key={node.full}
                className="mb-0.5 w-full">
                <div
                  className="flex w-full min-w-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background-emphasis"
                  style={{
                    fontSize: "var(--ui-font-size-sm)",
                    fontWeight: 500,
                    paddingLeft: `${12 + level * 22}px`,
                  }}
                  onMouseEnter={() => setHoveredRowKey(node.full)}
                  onMouseLeave={() => setHoveredRowKey(null)}
                  onClick={() => {
                    if (!repoPath) return;
                    setBranchTreeExpanded(repoPath, {
                      ...branchTreeExpanded,
                      [node.full]: !isOpen,
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, node });
                    setMenuPos({ x: e.clientX, y: e.clientY });
                  }}>
                  <span className="inline-flex items-center justify-center w-5 h-5">
                    {isOpen ? (
                      <IconChevronDown
                        size={18}
                        className="align-middle"
                      />
                    ) : (
                      <IconChevronRight
                        size={18}
                        className="align-middle"
                      />
                    )}
                  </span>
                  <span className="inline-flex items-center justify-center w-5 h-5">
                    <IconFolder
                      size={18}
                      className={
                        isPriorityGroup
                          ? PRIORITY_BRANCH_COLOR
                          : DEFAULT_BRANCH_ICON_COLOR
                      }
                    />
                  </span>
                  <span className="truncate min-w-0 flex-1 w-0">
                    {node.name}
                  </span>
                  <button
                    className={`ml-auto p-1 rounded hover:bg-zinc-700 transition-colors ${
                      isRowActionsVisible(node.full) ? "visible" : "invisible"
                    }`}
                    title="More actions"
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setContextMenu({ x: rect.right, y: rect.bottom, node });
                      setMenuPos({ x: rect.right, y: rect.bottom });
                    }}>
                    <IconDotsVertical size={16} />
                  </button>
                </div>
                {isOpen ? renderTree(node.children, level + 1) : null}
              </li>
            );
          } else {
            const selected =
              (selectedRowBranch ?? selectedBranch) === node.full;
            return (
              <li
                key={node.full}
                className={`group flex w-full min-w-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
                    : "hover:bg-background-emphasis text-foreground"
                }`}
                style={{
                  fontSize: "var(--ui-font-size-sm)",
                  paddingLeft: `${28 + level * 22}px`,
                }}
                tabIndex={0}
                onMouseEnter={() => setHoveredRowKey(node.full)}
                onMouseLeave={() => setHoveredRowKey(null)}
                onClick={() => {
                  setSelectedRowBranch(node.full);
                }}
                onDoubleClick={() => {
                  if (type !== "local") return;
                  void checkoutBranch(node.full);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, node });
                  setMenuPos({ x: e.clientX, y: e.clientY });
                }}>
                <span className="inline-flex items-center justify-center w-5 h-5">
                  <BranchIcon name={node.name} />
                </span>
                <span className="truncate min-w-0 flex-1 w-0">{node.name}</span>
                <button
                  className={`ml-auto p-1 rounded hover:bg-zinc-700 transition-colors ${
                    isRowActionsVisible(node.full) ? "visible" : "invisible"
                  }`}
                  title="More actions"
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    setContextMenu({ x: rect.right, y: rect.bottom, node });
                    setMenuPos({ x: rect.right, y: rect.bottom });
                  }}>
                  <IconDotsVertical size={16} />
                </button>
              </li>
            );
          }
        })}
      </ul>
    );
  }

  // Render the context menu
  function renderContextMenu() {
    if (!contextMenu || !menuPos) return null;
    const { node } = contextMenu;
    const branchName = node.full || node.name;
    const currentBranchLabel = selectedBranch || "current branch";
    const isBranchNode = node.type !== "group";
    const remoteActionDisabledReason = !isBranchNode
      ? "Remote actions are only available for branches"
      : type === "remote"
        ? "Remote actions are only available for local branches"
        : null;
    const remoteActionClass = remoteActionDisabledReason
      ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
      : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
    const branchOperationDisabledReason = !isBranchNode
      ? "Branch operations are only available for branches"
      : type === "remote"
        ? "Branch operations are only available for local branches"
        : !selectedBranch
          ? "Branch operations require a current local branch"
          : selectedBranch === branchName
            ? "Source and target branch are the same"
          : null;
    const branchOperationClass = branchOperationDisabledReason
      ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
      : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
    const localBranchActionDisabledReason = !isBranchNode
      ? "This action is only available for branches"
      : type === "remote"
        ? "Checkout is only available for local branches"
        : null;
    const localBranchActionClass = localBranchActionDisabledReason
      ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
      : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";
    const createWorktreeDisabledReason = !isBranchNode
      ? "This action is only available for branches"
      : creatingWorktree
        ? "A worktree is already being created"
        : null;
    const createWorktreeActionClass = createWorktreeDisabledReason
      ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
      : "px-4 py-2 hover:bg-zinc-700 cursor-pointer";

    // Helper to close both menus
    function closeMenus() {
      setContextMenu(null);
      setShowOther(false);
    }

    function runRemoteAction(
      command:
        | "git_branch_pull_fast_forward"
        | "git_branch_push"
        | "git_branch_set_upstream",
      pendingAction: "pull" | "push",
      successTitle: string,
      successDetails: string,
      failureTitle: string,
    ) {
      if (remoteActionDisabledReason) return;
      closeMenus();
      void runRemoteBranchAction(
        command,
        branchName,
        pendingAction,
        successTitle,
        successDetails,
        failureTitle,
      );
    }

    // Delayed mouseleave handler (grace period)
    function handleMenuMouseLeave(e: React.MouseEvent) {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest(".submenu")) return;
      submenuTimeout.current = setTimeout(() => {
        closeMenus();
      }, 500);
    }
    function handleSubmenuMouseEnter() {
      if (submenuTimeout.current) {
        clearTimeout(submenuTimeout.current);
        submenuTimeout.current = null;
      }
      setShowOther(true);
    }
    function handleSubmenuMouseLeave() {
      submenuTimeout.current = setTimeout(() => {
        setShowOther(false);
      }, 500);
    }

    return ReactDOM.createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          top: menuPos.y,
          left: menuPos.x,
          zIndex: 99999,
        }}
        className="flex"
        onMouseLeave={handleMenuMouseLeave}>
        {/* Main menu */}
        <div className="bg-background-emphasis border border-border rounded shadow-lg py-1 text-xs text-zinc-200 select-none z-[99999] min-w-[320px]">
          {/* Remote actions, Branch operations, Worktree, Branching, Danger zone */}
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Remote actions
          </div>
          <div
            className={remoteActionClass}
            title={remoteActionDisabledReason ?? undefined}
            onClick={() => {
              runRemoteAction(
                "git_branch_pull_fast_forward",
                "pull",
                "git pull succeeded",
                `Fast-forwarded ${branchName} from its upstream.`,
                "git pull failed",
              );
            }}>
            Pull (fast-forward if possible)
          </div>
          <div
            className={remoteActionClass}
            title={remoteActionDisabledReason ?? undefined}
            onClick={() => {
              runRemoteAction(
                "git_branch_push",
                "push",
                "git push succeeded",
                `Pushed ${branchName} to origin/${branchName}.`,
                "git push failed",
              );
            }}>
            Push
          </div>
          <div
            className={remoteActionClass}
            title={remoteActionDisabledReason ?? undefined}
            onClick={() => {
              runRemoteAction(
                "git_branch_set_upstream",
                "push",
                "git push --set-upstream succeeded",
                `Set upstream for ${branchName} to origin/${branchName}.`,
                "git push --set-upstream failed",
              );
            }}>
            Set Upstream
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Branch operations
          </div>
          <div
            className={branchOperationClass}
            title={branchOperationDisabledReason ?? undefined}
            onClick={() => {
              if (branchOperationDisabledReason || !selectedBranch) return;
              closeMenus();
              void runBranchOperation(
                "git_branch_fast_forward_to_branch",
                branchName,
                "Fast-forward succeeded",
                `Fast-forwarded ${branchName} to ${selectedBranch}.`,
                "Fast-forward failed",
                branchName,
              );
            }}>
            Fast-forward <BranchName>{branchName}</BranchName> to{" "}
            <BranchName>{currentBranchLabel}</BranchName>
          </div>
          <div
            className={branchOperationClass}
            title={branchOperationDisabledReason ?? undefined}
            onClick={() => {
              if (branchOperationDisabledReason || !selectedBranch) return;
              closeMenus();
              void runBranchOperation(
                "git_branch_merge_into",
                branchName,
                "Merge succeeded",
                `Merged ${selectedBranch} into ${branchName}.`,
                "Merge failed",
                branchName,
              );
            }}>
            Merge <BranchName>{currentBranchLabel}</BranchName> into{" "}
            <BranchName>{branchName}</BranchName>
          </div>
          <div
            className={branchOperationClass}
            title={branchOperationDisabledReason ?? undefined}
            onClick={() => {
              if (branchOperationDisabledReason || !selectedBranch) return;
              closeMenus();
              void runBranchOperation(
                "git_branch_rebase_onto",
                branchName,
                "Rebase succeeded",
                `Rebased ${branchName} onto ${selectedBranch}.`,
                "Rebase failed",
                branchName,
              );
            }}>
            Rebase <BranchName>{branchName}</BranchName> onto{" "}
            <BranchName>{currentBranchLabel}</BranchName>
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Worktree
          </div>
          <div
            className={localBranchActionClass}
            title={localBranchActionDisabledReason ?? undefined}
            onClick={() => {
              if (localBranchActionDisabledReason) return;
              closeMenus();
              void checkoutBranch(branchName);
            }}>
            Checkout <BranchName>{branchName}</BranchName>
          </div>
          <div
            className={createWorktreeActionClass}
            title={createWorktreeDisabledReason ?? undefined}
            onClick={() => {
              if (createWorktreeDisabledReason) return;
              closeMenus();
              void createRandomWorktreeFromBranch(branchName);
            }}>
            {creatingWorktree ? "Creating worktree..." : "Create worktree from"}{" "}
            <BranchName>{branchName}</BranchName>
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Branching
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              const prefix = getBranchCreatePrefix(node, type);
              const baseRef = isBranchNode ? branchName : selectedBranch || "HEAD";
              closeMenus();
              beginCreateBranch(baseRef, prefix);
            }}>
            Create branch here
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Cherry pick commit
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Reset ... to this commit
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Revert commit
          </div>

          <div className="my-1 border-t border-zinc-700" />
          {/* Compare outside the submenu */}
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Compare
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Compare commit against working directory
          </div>
          <div className="my-1 border-t border-zinc-700" />
          {/* Other actions (dropdown) */}
          <div
            className="relative"
            ref={otherRef}>
            <div
              className="px-4 py-2 hover:bg-zinc-700 cursor-pointer flex items-center gap-2"
              onMouseEnter={() => setShowOther(true)}
              onClick={() => setShowOther((v) => !v)}
              tabIndex={0}>
              Otras acciones
              <IconChevronRight size={14} />
            </div>
            {/* Other actions submenu */}
            {showOther && (
              <div
                className={`submenu bg-zinc-900/95 border border-zinc-600 rounded shadow-lg py-1 text-xs text-zinc-200 select-none min-w-[180px] z-[100000] absolute ${
                  submenuDirection === "down" ? "top-0" : "bottom-0"
                } ${submenuLeft ? "left-full ml-1" : "right-full mr-1"}`}
                onMouseEnter={handleSubmenuMouseEnter}
                onMouseLeave={handleSubmenuMouseLeave}>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                    void copyText(
                      branchName,
                      "Copied branch name",
                      `Copied ${branchName}.`,
                    );
                  }}>
                  Copy branch name
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                    void copyBranchTipSha(branchName);
                  }}>
                  Copy commit sha
                </div>
              </div>
            )}
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Danger zone
          </div>
          <div
            className={localBranchActionClass}
            title={localBranchActionDisabledReason ?? undefined}
            onClick={() => {
              if (localBranchActionDisabledReason) return;
              closeMenus();
              setRenameBranchName(branchName);
              setRenameRequest({ branchName });
            }}>
            Rename <BranchName>{branchName}</BranchName>
          </div>
          <div
            className={
              localBranchActionDisabledReason
                ? "px-4 py-2 text-zinc-500 cursor-not-allowed"
                : "px-4 py-2 hover:bg-zinc-700 cursor-pointer text-red-400"
            }
            title={localBranchActionDisabledReason ?? undefined}
            onClick={() => {
              if (localBranchActionDisabledReason) return;
              closeMenus();
              setDeleteRequest({ branchName });
            }}>
            Delete <BranchName>{branchName}</BranchName>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!repoPath) return null;

  return (
    <>
      <div className="h-full flex flex-col relative min-w-0 overflow-hidden bg-background">
        <div className="border-b border-border bg-background-emphasis p-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder="Search branches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center overflow-hidden rounded border border-border bg-background">
              <button
                type="button"
                className={`flex h-8 w-8 items-center justify-center transition-colors ${
                  type === "local"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
                onClick={() => setType("local")}
                title="Local branches"
                aria-label="Local branches">
                <IconDeviceFloppy size={15} />
              </button>
              <button
                type="button"
                className={`flex h-8 w-8 items-center justify-center transition-colors ${
                  type === "remote"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
                onClick={() => setType("remote")}
                title="Remote branches"
                aria-label="Remote branches">
                <IconCloud size={15} />
              </button>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => beginCreateBranch(selectedBranch || "HEAD")}
              title="Add branch"
              aria-label="Add branch">
              <IconPlus size={16} />
            </button>
          </div>
        </div>
        {loading && <div className="text-sm text-zinc-400">Loading...</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!loading && !error && grouped.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No branches found</div>
          ) : null}
          {renderTree(grouped)}
          {renderContextMenu()}
        </div>
        {createForm
          ? (() => {
              const branchName = buildBranchName(
                createForm.prefix,
                createForm.name,
              );

              return (
                <div className="border-t border-border bg-background-emphasis p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
                    <IconGitBranch size={15} className="text-blue-300" />
                    <span className="min-w-0 truncate">
                      New branch based on{" "}
                      <span className="font-mono text-blue-200">
                        {createForm.baseRef}
                      </span>
                    </span>
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Branch name
                    <div className="flex min-w-0">
                      {createForm.prefix ? (
                        <span className="flex h-8 max-w-[45%] items-center rounded-l border border-r-0 border-border bg-background px-2 font-mono text-sm text-zinc-400">
                          <span className="truncate">{createForm.prefix}</span>
                        </span>
                      ) : null}
                      <input
                        type="text"
                        autoFocus
                        className={`h-8 min-w-0 flex-1 border border-border bg-background px-2 text-sm text-foreground focus:outline-none ${
                          createForm.prefix ? "rounded-r" : "rounded"
                        }`}
                        value={createForm.name}
                        onChange={(event) =>
                          setCreateForm((current) =>
                            current
                              ? { ...current, name: event.target.value }
                              : current,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void createBranch();
                          }
                          if (event.key === "Escape") {
                            setCreateForm(null);
                            setCreateBranchError(null);
                          }
                        }}
                      />
                    </div>
                  </label>
                  {branchName ? (
                    <div className="mt-2 truncate text-xs text-muted-foreground">
                      Full branch:{" "}
                      <span className="font-mono text-zinc-200">{branchName}</span>
                    </div>
                  ) : null}
                  {createBranchError ? (
                    <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                      {createBranchError}
                    </div>
                  ) : null}
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="h-8 rounded border border-border bg-background px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                      onClick={() => {
                        setCreateForm(null);
                        setCreateBranchError(null);
                      }}
                      disabled={creatingBranch}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="h-8 rounded border border-blue-500/50 bg-blue-500/20 px-3 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        void createBranch();
                      }}
                      disabled={creatingBranch || !branchName}>
                      {creatingBranch ? "Creating..." : "Create Branch"}
                    </button>
                  </div>
                </div>
              );
            })()
          : null}
      </div>

      <ConfirmModal
        open={renameRequest !== null}
        title="Rename Branch"
        description={
          renameRequest ? (
            <span>
              Rename <BranchName>{renameRequest.branchName}</BranchName>
            </span>
          ) : null
        }
        details={
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-400">
              New branch name
            </span>
            <input
              value={renameBranchName}
              onChange={(event) => setRenameBranchName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void renameBranch();
                }
              }}
              className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
              autoFocus
            />
          </label>
        }
        confirmLabel="Rename Branch"
        loading={branchActionLoading}
        confirmDisabled={
          !renameBranchName.trim() ||
          renameBranchName.trim() === renameRequest?.branchName
        }
        onCancel={() => {
          if (branchActionLoading) return;
          setRenameRequest(null);
        }}
        onConfirm={() => {
          void renameBranch();
        }}
      />

      <ConfirmModal
        open={deleteRequest !== null}
        title="Delete Branch"
        description={
          deleteRequest ? (
            <span>
              Delete <BranchName>{deleteRequest.branchName}</BranchName>?
            </span>
          ) : null
        }
        details={
          deleteRequest ? (
            <span>
              This runs <span className="font-mono">git branch -d</span>. Git
              will refuse if the branch is checked out or not fully merged.
            </span>
          ) : null
        }
        confirmLabel="Delete Branch"
        variant="danger"
        loading={branchActionLoading}
        onCancel={() => {
          if (branchActionLoading) return;
          setDeleteRequest(null);
        }}
        onConfirm={() => {
          void deleteBranch();
        }}
      />
    </>
  );
}
