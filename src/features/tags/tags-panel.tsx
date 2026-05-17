import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { getRemoteUrl } from "@/shared/api/git/commits";
import {
  createTag,
  getTags,
  searchTagCommits,
} from "@/shared/api/git/tags";
import { APP_EVENTS } from "@/shared/config/events";
import { classNames } from "@/shared/ui";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconFolder,
  IconPlus,
  IconSearch,
  IconTag,
  IconX,
} from "@/components/icons";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace/stores/workspace-ui-store";
import type { TagCommitOption } from "@/shared/types/git";
import { BranchTreeNode, groupNames } from "@/shared/lib/tree/branch-tree";
import { buildRemoteTagUrl } from "./utils/remote-tag-url";

type TagsPanelProps = {
  repoPath: string;
};

type TagContextMenu = {
  x: number;
  y: number;
  node: BranchTreeNode;
};

function TagsPanelState({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
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
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [tagAnnotated, setTagAnnotated] = useState(false);
  const [commitSearch, setCommitSearch] = useState("");
  const [debouncedCommitSearch, setDebouncedCommitSearch] = useState("");
  const [commitOptions, setCommitOptions] = useState<TagCommitOption[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<TagCommitOption | null>(null);
  const [commitDropdownOpen, setCommitDropdownOpen] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const commitSearchRequestRef = useRef(0);

  const refreshTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextTags = await getTags(repoPath);
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

  useEffect(() => {
    if (!addPanelOpen) return;

    const timeout = window.setTimeout(() => {
      setDebouncedCommitSearch(commitSearch);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [addPanelOpen, commitSearch]);

  useEffect(() => {
    if (!addPanelOpen) return;

    const requestId = commitSearchRequestRef.current + 1;
    commitSearchRequestRef.current = requestId;
    setCommitLoading(true);

    searchTagCommits(repoPath, debouncedCommitSearch)
      .then((commits) => {
        if (commitSearchRequestRef.current !== requestId) return;
        setCommitOptions(commits);
        setSelectedCommit((current) => current ?? commits[0] ?? null);
      })
      .catch((commitError) => {
        if (commitSearchRequestRef.current !== requestId) return;
        setCreateError(String(commitError));
        setCommitOptions([]);
      })
      .finally(() => {
        if (commitSearchRequestRef.current === requestId) {
          setCommitLoading(false);
        }
      });
  }, [addPanelOpen, debouncedCommitSearch, repoPath]);

  useEffect(() => {
    setAddPanelOpen(false);
    setTagName("");
    setTagDescription("");
    setTagAnnotated(false);
    setCommitSearch("");
    setDebouncedCommitSearch("");
    setSelectedCommit(null);
    setCommitDropdownOpen(false);
    setCommitOptions([]);
    setCreateError(null);
  }, [repoPath]);

  const filteredTags = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return tags;
    return tags.filter((tag) => tag.toLowerCase().includes(normalizedSearch));
  }, [search, tags]);

  const groupedTags = useMemo(() => groupNames(filteredTags), [filteredTags]);

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

  const openAddPanel = useCallback(() => {
    setAddPanelOpen(true);
    setCommitDropdownOpen(false);
    setCreateError(null);
  }, []);

  const closeAddPanel = useCallback(() => {
    setAddPanelOpen(false);
    setCommitDropdownOpen(false);
    setTagName("");
    setTagDescription("");
    setTagAnnotated(false);
    setCommitSearch("");
    setDebouncedCommitSearch("");
    setSelectedCommit(null);
    setCommitOptions([]);
    setCreateError(null);
  }, []);

  const handleCreateTag = useCallback(async () => {
    if (!tagName.trim() || !selectedCommit || createLoading) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      await createTag(
        repoPath,
        tagName.trim(),
        selectedCommit.sha,
        tagAnnotated,
        tagAnnotated ? tagDescription.trim() : null,
      );

      setTagName("");
      setTagDescription("");
      setTagAnnotated(false);
      setCommitSearch("");
      setDebouncedCommitSearch("");
      setSelectedCommit(null);
      setCommitDropdownOpen(false);
      setAddPanelOpen(false);
      await refreshTags();
    } catch (tagError) {
      setCreateError(String(tagError));
    } finally {
      setCreateLoading(false);
    }
  }, [
    createLoading,
    refreshTags,
    repoPath,
    selectedCommit,
    tagAnnotated,
    tagDescription,
    tagName,
  ]);

  const copyRemoteLink = useCallback(
    async (tagName: string) => {
      const remoteUrl = await getRemoteUrl(repoPath, "origin");

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

  function renderAddTagPanel() {
    if (!addPanelOpen) return null;

    const canCreateTag = Boolean(tagName.trim() && selectedCommit && !createLoading);

    return (
      <div className="flex-shrink-0 border-t border-border bg-background-emphasis p-3 shadow-[0_-12px_32px_rgba(0,0,0,0.24)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Add tag</div>
            <div className="text-xs text-muted-foreground">
              Create a local tag on a selected commit.
            </div>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close add tag panel"
            onClick={closeAddPanel}>
            <IconX size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-300">Tag name</span>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder="v1.0.0"
              value={tagName}
              disabled={createLoading}
              onChange={(e) => setTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreateTag) {
                  void handleCreateTag();
                }
              }}
            />
          </label>

          <div className="relative">
            <div className="mb-1 block text-xs font-medium text-zinc-300">Commit</div>
            <button
              type="button"
              className="flex w-full min-w-0 items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createLoading}
              onClick={() => setCommitDropdownOpen((open) => !open)}>
              <span className="min-w-0 flex-1 truncate">
                {selectedCommit ? (
                  <>
                    <span className="font-mono text-blue-300">{selectedCommit.shortSha}</span>
                    <span className="text-muted-foreground"> · </span>
                    {selectedCommit.message || "Untitled commit"}
                  </>
                ) : commitLoading ? (
                  "Loading commits..."
                ) : (
                  "Select a commit"
                )}
              </span>
              <IconChevronDown size={16} className="flex-shrink-0 text-muted-foreground" />
            </button>

            {commitDropdownOpen ? (
              <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded border border-border bg-background shadow-xl">
                <div className="relative border-b border-border p-2">
                  <input
                    type="text"
                    className="w-full rounded border border-border bg-background-emphasis px-3 py-1.5 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    placeholder="Search commits by SHA, message, or author..."
                    value={commitSearch}
                    onChange={(e) => setCommitSearch(e.target.value)}
                    autoFocus
                  />
                  <IconSearch className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {commitLoading ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                  ) : commitOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No commits found
                    </div>
                  ) : (
                    commitOptions.map((commit) => {
                      const selected = selectedCommit?.sha === commit.sha;

                      return (
                        <button
                          key={commit.sha}
                          type="button"
                          className={classNames(
                            "flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-background-emphasis",
                            selected ? "bg-blue-500/15 text-blue-100" : "text-foreground",
                          )}
                          onClick={() => {
                            setSelectedCommit(commit);
                            setCommitDropdownOpen(false);
                          }}>
                          <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-blue-300">
                            {selected ? <IconCheck size={14} /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">
                              <span className="font-mono text-blue-300">
                                {commit.shortSha}
                              </span>
                              <span className="text-muted-foreground"> · </span>
                              {commit.message || "Untitled commit"}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {commit.author}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border bg-background"
              checked={tagAnnotated}
              disabled={createLoading}
              onChange={(e) => setTagAnnotated(e.target.checked)}
            />
            Annotated tag
          </label>

          {tagAnnotated ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-300">
                Description <span className="text-muted-foreground">(optional)</span>
              </span>
              <textarea
                className="min-h-20 w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder="Release notes or tag details"
                value={tagDescription}
                disabled={createLoading}
                onChange={(e) => setTagDescription(e.target.value)}
              />
            </label>
          ) : null}

          {createError ? <div className="text-xs text-red-400">{createError}</div> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded border border-border px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createLoading}
              onClick={closeAddPanel}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded border border-blue-500/60 bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canCreateTag}
              onClick={() => void handleCreateTag()}>
              {createLoading ? "Creating..." : "Create tag"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative min-w-0 overflow-hidden bg-background">
      <div className="border-b border-border bg-background-emphasis p-2">
        <div className="flex min-w-0 items-center gap-2">
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
          <button
            type="button"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-border bg-background text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            title="Add tag"
            aria-label="Add tag"
            onClick={openAddPanel}>
            <IconPlus size={17} />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <TagsPanelState message="Loading" />
        ) : error ? (
          <div className="px-3 py-2 text-sm text-red-400">{error}</div>
        ) : groupedTags.length === 0 ? (
          <TagsPanelState message="No tags found" />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">{renderTree(groupedTags)}</div>
        )}
      </div>
      {renderAddTagPanel()}
      {renderContextMenu()}
    </div>
  );
}
