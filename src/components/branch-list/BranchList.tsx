import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { APP_EVENTS } from "../../constants/events";
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
  IconSearch,
} from "../icons";
import {
  BranchTreeNode,
  groupBranches,
  isPriorityBranchName,
} from "../../utils/branchTree";

const PRIORITY_BRANCH_COLOR = "text-lime-400";
const DEFAULT_BRANCH_ICON_COLOR = "text-slate-300";

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

export function BranchList() {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const repoPath = tab?.repoPath;
  const selectedBranch = tab?.selectedBranch;
  const setTabBranch = useRepoStore((s) => s.setTabBranch);
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
  const [type, setType] = useState<"local" | "remote">("local");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: any | null;
  } | null>(null);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showOther, setShowOther] = useState(false);
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
            const selected = selectedBranch === node.full;
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
                  if (activeTabId) setTabBranch(activeTabId, node.full);
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

    // Helper to close both menus
    function closeMenus() {
      setContextMenu(null);
      setShowOther(false);
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
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Pull (fast-forward if possible)
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Push
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Set Upstream
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Branch operations
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Fast-forward {branchName} to ...
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Merge ... into {branchName}
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Rebase ... onto {branchName}
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Worktree
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Checkout {branchName}
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Create worktree from {branchName}
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Branching
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
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
                  }}>
                  Copy branch name
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Copy commit sha
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Hide
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Solo
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Create tag here
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Create annotated tag here
                </div>
              </div>
            )}
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Danger zone
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Rename {branchName}
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer text-red-400"
            onClick={() => {
              closeMenus();
            }}>
            Delete {branchName}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!repoPath) return null;

  return (
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
              aria-label="Local branches"
            >
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
              aria-label="Remote branches"
            >
              <IconCloud size={15} />
            </button>
          </div>
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
    </div>
  );
}
