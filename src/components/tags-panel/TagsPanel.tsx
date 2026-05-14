import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { APP_EVENTS } from "../../constants/events";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "../../store/workspaceUi";
import { BranchTreeNode, groupNames } from "../../utils/branchTree";
import { classNames } from "../../utils/ui";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconFolder,
  IconSearch,
  IconTag,
} from "../icons";

type TagsPanelProps = {
  repoPath: string;
};

type TagContextMenu = {
  x: number;
  y: number;
  node: BranchTreeNode;
};

function encodeRefPath(refName: string) {
  return refName.split("/").map(encodeURIComponent).join("/");
}

function normalizeRemoteUrl(remoteUrl: string) {
  const trimmed = remoteUrl.trim();
  const scpStyle = trimmed.match(/^git@([^:]+):(.+)$/);

  if (scpStyle) {
    return `https://${scpStyle[1]}/${scpStyle[2].replace(/\.git$/, "")}`;
  }

  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
    return `https://${url.hostname}/${path}`;
  } catch {
    return trimmed.replace(/\.git$/, "");
  }
}

function buildRemoteTagUrl(remoteUrl: string, tagName: string) {
  const baseUrl = normalizeRemoteUrl(remoteUrl).replace(/\/+$/, "");
  const host = (() => {
    try {
      return new URL(baseUrl).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const encodedTag = encodeRefPath(tagName);

  if (host.includes("gitlab")) {
    return `${baseUrl}/-/tags/${encodedTag}`;
  }

  if (host.includes("bitbucket")) {
    return `${baseUrl}/src/${encodedTag}`;
  }

  return `${baseUrl}/tree/${encodedTag}`;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function TagsPanel({ repoPath }: TagsPanelProps) {
  const tagTreeExpanded = useWorkspaceUiStore(
    (s) =>
      (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
        .tagTreeExpanded ?? DEFAULT_REPO_WORKSPACE_STATE.tagTreeExpanded,
  );
  const setTagTreeExpanded = useWorkspaceUiStore((s) => s.setTagTreeExpanded);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<TagContextMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextTags = await core.invoke<string[]>("get_tags", { path: repoPath });
      setTags(nextTags);
    } catch (tagError) {
      setError(String(tagError));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  useEffect(() => {
    const handleRepoRefsRefresh = () => {
      void refreshTags();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      window.removeEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    };
  }, [refreshTags]);

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

  const filteredTags = tags.filter((tag) =>
    search.trim()
      ? tag.toLowerCase().includes(search.trim().toLowerCase())
      : true,
  );
  const groupedTags = groupNames(filteredTags);

  const openContextMenu = useCallback((node: BranchTreeNode, x: number, y: number) => {
    setContextMenu({ x, y, node });
    setMenuPos({ x, y });
  }, []);

  const isRowActionsVisible = useCallback(
    (rowKey: string) => hoveredRowKey === rowKey || contextMenu?.node.full === rowKey,
    [hoveredRowKey, contextMenu],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const copyRemoteLink = useCallback(
    async (tagName: string) => {
      const remoteUrl = await core.invoke<string | null>("get_remote_url", {
        path: repoPath,
        remoteName: "origin",
      });

      if (!remoteUrl) {
        throw new Error("Remote origin is not configured");
      }

      await copyText(buildRemoteTagUrl(remoteUrl, tagName));
    },
    [repoPath],
  );

  function renderTree(nodes: BranchTreeNode[], level = 0) {
    return (
      <ul className="m-0 w-full min-w-0 list-none p-0 select-none">
        {nodes.map((node) => {
          if (node.type === "group") {
            const isOpen = tagTreeExpanded[node.full] ?? true;

            return (
              <li key={node.full} className="mb-0.5 w-full">
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
                    setTagTreeExpanded(repoPath, {
                      ...tagTreeExpanded,
                      [node.full]: !isOpen,
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu(node, e.clientX, e.clientY);
                  }}>
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                  </span>
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    <IconFolder size={18} className="text-slate-300" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{node.name}</span>
                  <button
                    className={classNames(
                      "ml-auto rounded p-1 transition-colors hover:bg-zinc-700",
                      isRowActionsVisible(node.full) ? "visible" : "invisible",
                    )}
                    title="More actions"
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      openContextMenu(node, rect.right, rect.bottom);
                    }}>
                    <IconDotsVertical size={16} />
                  </button>
                </div>
                {isOpen ? renderTree(node.children, level + 1) : null}
              </li>
            );
          }

          const selected = selectedTag === node.full;

          return (
            <li
              key={node.full}
              className={classNames(
                "group flex w-full min-w-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-sm transition-colors",
                selected
                  ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
                  : "text-foreground hover:bg-background-emphasis",
              )}
              style={{
                fontSize: "var(--ui-font-size-sm)",
                paddingLeft: `${28 + level * 22}px`,
              }}
              tabIndex={0}
              onMouseEnter={() => setHoveredRowKey(node.full)}
              onMouseLeave={() => setHoveredRowKey(null)}
              onClick={() => setSelectedTag(node.full)}
              onContextMenu={(e) => {
                e.preventDefault();
                openContextMenu(node, e.clientX, e.clientY);
              }}>
              <span className="inline-flex h-5 w-5 items-center justify-center">
                <IconTag size={17} className="text-slate-300" />
              </span>
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              <button
                className={classNames(
                  "ml-auto rounded p-1 transition-colors hover:bg-zinc-700",
                  isRowActionsVisible(node.full) ? "visible" : "invisible",
                )}
                title="More actions"
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openContextMenu(node, rect.right, rect.bottom);
                }}>
                <IconDotsVertical size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderContextMenu() {
    if (!contextMenu || !menuPos) return null;

    const tagName = contextMenu.node.full;
    const isGroup = contextMenu.node.type === "group";
    const actionClass = "px-4 py-2 hover:bg-zinc-700 cursor-pointer whitespace-nowrap";
    const disabledActionClass = "px-4 py-2 text-zinc-500 cursor-not-allowed whitespace-nowrap";

    const closeAfter = (action?: () => void | Promise<void>) => {
      closeContextMenu();
      if (action) {
        void Promise.resolve(action()).catch((actionError: unknown) => {
          console.error(actionError);
        });
      }
    };

    return ReactDOM.createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          top: menuPos.y,
          left: menuPos.x,
          zIndex: 99999,
        }}
        className="bg-background-emphasis border border-border rounded shadow-lg py-1 text-xs text-zinc-200 select-none z-[99999] min-w-[280px]">
        <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
          Tag actions
        </div>
        <div className={disabledActionClass} title="Tag checkout is not wired yet">
          Checkout the commit at {tagName}
        </div>
        <div className={disabledActionClass} title="Branch creation is not wired yet">
          Create branch here
        </div>
        <div className={disabledActionClass} title="Cherry-pick is not wired yet">
          Cherry pick commit
        </div>
        <div className="my-1 border-t border-zinc-700" />
        <div className={actionClass} onClick={() => closeAfter(() => copyText(tagName))}>
          Copy tag name
        </div>
        <div
          className={isGroup ? disabledActionClass : actionClass}
          title={isGroup ? "Remote links are only available for concrete tags" : undefined}
          onClick={isGroup ? undefined : () => closeAfter(() => copyRemoteLink(tagName))}>
          Copy link to this tag on remote: origin
        </div>
        <div className="my-1 border-t border-zinc-700" />
        <div className={disabledActionClass} title="Tag filtering is not wired yet">
          Hide
        </div>
        <div className={disabledActionClass} title="Tag filtering is not wired yet">
          Solo
        </div>
        <div className="my-1 border-t border-zinc-700" />
        <div className={disabledActionClass} title="Annotated tag editing is not wired yet">
          Annotate {tagName}
        </div>
        <div className="my-1 border-t border-zinc-700" />
        <div className={disabledActionClass} title="Local tag deletion is intentionally disabled until confirmation flow exists">
          Delete {tagName} locally
        </div>
        <div className={disabledActionClass} title="Remote tag deletion is intentionally disabled until confirmation flow exists">
          Delete {tagName} from origin
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="h-full flex flex-col relative min-w-0 overflow-hidden bg-background">
      <div className="border-b border-border bg-background-emphasis p-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      {loading ? <div className="px-3 py-2 text-sm text-zinc-400">Loading...</div> : null}
      {error ? <div className="px-3 py-2 text-sm text-red-400">{error}</div> : null}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!loading && !error && groupedTags.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No tags found</div>
        ) : null}
        {!error ? renderTree(groupedTags) : null}
        {renderContextMenu()}
      </div>
    </div>
  );
}
