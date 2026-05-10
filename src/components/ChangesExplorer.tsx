import { invoke } from "@tauri-apps/api/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useStagedLinesStore } from "../store/staging";
import { DiffLine, FileChange, FileChangeWithHunks } from "../types/git";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconDotsVertical,
  IconExchange,
  IconFolder,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPoint,
  IconQuestionMark,
  IconSearch,
} from "./icons";

export type ChangesExplorerViewMode = "flat" | "tree";

type ChangesExplorerFile = FileChange | FileChangeWithHunks;
type ChangesExplorerSurface = "main" | "modal";
type SectionName = "Tracked" | "Untracked";
type SectionMode = "tracked-untracked" | "single";

type TreeNode =
  | {
      kind: "folder";
      name: string;
      path: string;
      children: TreeNode[];
    }
  | {
      kind: "file";
      file: ChangesExplorerFile;
      path: string;
      name: string;
    };

interface ChangesExplorerProps {
  files: ChangesExplorerFile[];
  selectedPath: string | null;
  onSelectFile: (file: ChangesExplorerFile) => void;
  viewMode: ChangesExplorerViewMode;
  onViewModeChange: (mode: ChangesExplorerViewMode) => void;
  showFileCheckboxes: boolean;
  surface: ChangesExplorerSurface;
  showHeader?: boolean;
  autoFocusSearch?: boolean;
  className?: string;
  sectionMode?: SectionMode;
  expandedState?: Record<string, boolean>;
  onExpandedStateChange?: (expanded: Record<string, boolean>) => void;
  repoPath?: string;
  onImmediateStageChange?: () => Promise<void> | void;
}

const ALLOWED_STATUSES = [
  "added",
  "deleted",
  "modified",
  "renamed",
  "copied",
  "typeChanged",
] as const;

function normalizeStatus(status: string): FileChange["status"] {
  return ALLOWED_STATUSES.includes(status as FileChange["status"])
    ? (status as FileChange["status"])
    : "modified";
}

function normalizeFiles(files: ChangesExplorerFile[]): ChangesExplorerFile[] {
  return files.map((file) => ({
    ...file,
    status: normalizeStatus(file.status),
  }));
}

function getFileName(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function getParentPath(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function getAncestorFolderPaths(path: string) {
  const parts = path.split("/");
  const ancestors: string[] = [];

  for (let index = 1; index < parts.length; index += 1) {
    ancestors.push(parts.slice(0, index).join("/"));
  }

  return ancestors;
}

function isUntrackedFile(file: ChangesExplorerFile) {
  if (file.status !== "added") return false;
  if (!("hunks" in file)) return false;

  // In the working-changes explorer, any added file represents a new/untracked
  // path relative to HEAD and should stay grouped under "Untracked", even after
  // it has staged content and non-zero insertions.
  return true;
}

function partitionFiles(
  files: ChangesExplorerFile[],
  sectionMode: SectionMode,
) {
  if (sectionMode === "single") {
    return files.length > 0 ? [{ name: "Tracked" as const, files }] : [];
  }

  const tracked: ChangesExplorerFile[] = [];
  const untracked: ChangesExplorerFile[] = [];

  files.forEach((file) => {
    if (isUntrackedFile(file)) {
      untracked.push(file);
      return;
    }
    tracked.push(file);
  });

  return [
    { name: "Tracked" as const, files: tracked },
    { name: "Untracked" as const, files: untracked },
  ].filter((section) => section.files.length > 0);
}

function buildCompressedTree(files: ChangesExplorerFile[]): TreeNode[] {
  const root = new Map<string, any>();

  files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;

    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      const existing = current.get(part);

      if (isLeaf) {
        current.set(part, {
          kind: "file",
          file,
          path: file.path,
          name: part,
        });
        return;
      }

      if (!existing || existing.kind !== "folder") {
        const next = {
          kind: "folder",
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          children: new Map<string, any>(),
        };
        current.set(part, next);
        current = next.children;
        return;
      }

      current = existing.children;
    });
  });

  const toNodes = (map: Map<string, any>): TreeNode[] =>
    Array.from(map.values())
      .map((entry) => {
        if (entry.kind === "file") {
          return entry as TreeNode;
        }

        const folderChildren = toNodes(entry.children);
        let name = entry.name;
        let path = entry.path;
        let children = folderChildren;

        while (children.length === 1 && children[0].kind === "folder") {
          const child = children[0];
          name = `${name}/${child.name}`;
          path = child.path;
          children = child.children;
        }

        return {
          kind: "folder" as const,
          name,
          path,
          children,
        };
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

  return toNodes(root);
}

function collectFolderPaths(nodes: TreeNode[], acc = new Set<string>()) {
  nodes.forEach((node) => {
    if (node.kind !== "folder") return;
    acc.add(node.path);
    collectFolderPaths(node.children, acc);
  });
  return acc;
}

function fileMatchesSearch(file: ChangesExplorerFile, search: string) {
  if (!search) return true;
  return file.path.toLowerCase().includes(search.toLowerCase());
}

function getStatusIcon(file: ChangesExplorerFile) {
  if (isUntrackedFile(file)) {
    return (
      <IconPlus size={16} className="h-4 w-4 flex-shrink-0 text-lime-400" />
    );
  }

  switch (file.status) {
    case "added":
      return (
        <IconPlus size={16} className="h-4 w-4 flex-shrink-0 text-green-500" />
      );
    case "deleted":
      return (
        <IconMinus size={16} className="h-4 w-4 flex-shrink-0 text-red-500" />
      );
    case "modified":
      return (
        <IconPoint
          size={16}
          className="h-4 w-4 flex-shrink-0 text-yellow-500"
        />
      );
    case "renamed":
      return (
        <IconPencil size={16} className="h-4 w-4 flex-shrink-0 text-blue-500" />
      );
    case "copied":
      return (
        <IconCopy size={16} className="h-4 w-4 flex-shrink-0 text-purple-500" />
      );
    case "typeChanged":
      return (
        <IconExchange
          size={16}
          className="h-4 w-4 flex-shrink-0 text-orange-500"
        />
      );
    default:
      return (
        <IconQuestionMark
          size={16}
          className="h-4 w-4 flex-shrink-0 text-zinc-500"
        />
      );
  }
}

function buildAllStageableLineMap(file: ChangesExplorerFile) {
  if (!("hunks" in file)) return {};

  const allHunks: Record<number, number[]> = {};

  file.hunks.forEach((hunk, hunkIdx) => {
    const lineIdxs = hunk.lines
      .map((line: DiffLine, idx: number) =>
        line.kind === "Add" || line.kind === "Del" ? idx : null,
      )
      .filter((lineIdx) => lineIdx !== null) as number[];

    if (lineIdxs.length > 0) {
      allHunks[hunkIdx] = lineIdxs;
    }
  });

  return allHunks;
}

function serializeLineSelection(
  selection: Record<number, Set<number>> | undefined,
): Record<number, number[]> {
  const hunks: Record<number, number[]> = {};

  if (!selection) return hunks;

  Object.entries(selection).forEach(([hunkIdx, lineSet]) => {
    if (!(lineSet instanceof Set) || lineSet.size === 0) return;
    hunks[Number(hunkIdx)] = Array.from(lineSet).sort((a, b) => a - b);
  });

  return hunks;
}

function cloneStagedLinesState(
  stagedLines: ReturnType<typeof useStagedLinesStore.getState>["stagedLines"],
) {
  return Object.fromEntries(
    Object.entries(stagedLines).map(([filePath, fileSelection]) => [
      filePath,
      Object.fromEntries(
        Object.entries(fileSelection).map(([key, value]) => [
          key,
          value instanceof Set ? new Set(value) : value,
        ]),
      ),
    ]),
  ) as ReturnType<typeof useStagedLinesStore.getState>["stagedLines"];
}

function ChangesExplorer({
  files,
  selectedPath,
  onSelectFile,
  viewMode,
  onViewModeChange,
  showFileCheckboxes,
  surface,
  showHeader = false,
  autoFocusSearch = false,
  className = "",
  sectionMode = "tracked-untracked",
  expandedState,
  onExpandedStateChange,
  repoPath,
  onImmediateStageChange,
}: ChangesExplorerProps) {
  const [search, setSearch] = useState("");
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>(
    {},
  );
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const revealFrameRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = expandedState ?? localExpanded;

  const setExpanded = (
    updater:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => {
    const next = typeof updater === "function" ? updater(expanded) : updater;

    if (onExpandedStateChange) {
      onExpandedStateChange(next);
      return;
    }

    setLocalExpanded(next);
  };

  const stagedLines = useStagedLinesStore((s) => s.stagedLines);
  const clearStagedLinesForFile = useStagedLinesStore(
    (s) => s.clearStagedLinesForFile,
  );
  const setLineSelectionForFile = useStagedLinesStore(
    (s) => s.setLineSelectionForFile,
  );
  const setStagedNewFile = useStagedLinesStore((s) => s.setStagedNewFile);
  const isStagedNewFile = useStagedLinesStore((s) => s.isStagedNewFile);
  const setWholeFileStaged = useStagedLinesStore((s) => s.setWholeFileStaged);
  const isWholeFileStaged = useStagedLinesStore((s) => s.isWholeFileStaged);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    },
    [],
  );

  const scheduleImmediateStageRefresh = () => {
    if (!onImmediateStageChange) return;
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void onImmediateStageChange();
    }, 120);
  };

  const normalizedFiles = useMemo(() => normalizeFiles(files), [files]);
  const filteredFiles = useMemo(
    () => normalizedFiles.filter((file) => fileMatchesSearch(file, search)),
    [normalizedFiles, search],
  );
  const sections = useMemo(
    () => partitionFiles(filteredFiles, sectionMode),
    [filteredFiles, sectionMode],
  );
  const sectionTrees = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        tree: buildCompressedTree(section.files),
      })),
    [sections],
  );

  useEffect(() => {
    if (autoFocusSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocusSearch]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      sectionTrees.forEach((section) => {
        collectFolderPaths(section.tree).forEach((path) => {
          if (!(path in next)) {
            next[path] = true;
          }
        });
      });
      return next;
    });
  }, [sectionTrees]);

  useEffect(() => {
    if (viewMode !== "tree" || !selectedPath) return;

    const ancestorPaths = getAncestorFolderPaths(selectedPath);
    if (ancestorPaths.length === 0) return;

    setExpanded((prev) => {
      let changed = false;
      const next = { ...prev };

      ancestorPaths.forEach((path) => {
        if (next[path] !== true) {
          next[path] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [selectedPath, viewMode]);

  useEffect(() => {
    if (!contextMenuOpen) return;

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [contextMenuOpen]);

  useLayoutEffect(() => {
    if (!contextMenuOpen || !menuRef.current || !menuPos) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    const x = Math.max(8, Math.min(menuPos.x, maxX));
    const y = Math.max(8, Math.min(menuPos.y, maxY));

    if (x !== menuPos.x || y !== menuPos.y) {
      setMenuPos({ x, y });
    }
  }, [contextMenuOpen, menuPos]);

  useEffect(() => {
    if (!containerRef.current || !selectedPath) return;

    if (revealFrameRef.current !== null) {
      cancelAnimationFrame(revealFrameRef.current);
    }

    const scheduleReveal = () => {
      revealFrameRef.current = requestAnimationFrame(() => {
        revealFrameRef.current = requestAnimationFrame(() => {
          const el = containerRef.current?.querySelector(
            `[data-file-path='${CSS.escape(selectedPath)}']`,
          ) as HTMLElement | null;

          if (el) {
            el.scrollIntoView({ block: "nearest", behavior: "auto" });
          }
        });
      });
    };

    scheduleReveal();

    return () => {
      if (revealFrameRef.current !== null) {
        cancelAnimationFrame(revealFrameRef.current);
        revealFrameRef.current = null;
      }
    };
  }, [expanded, search, selectedPath, viewMode]);

  const openContextMenu = (x: number, y: number) => {
    setMenuPos({ x, y });
    setContextMenuOpen(true);
  };

  const toggleFolder = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !(prev[path] ?? true) }));
  };

  const getCheckboxState = (file: ChangesExplorerFile) => {
    const fileStaged = stagedLines[file.path] || {};
    const hunks = "hunks" in file ? file.hunks : [];
    let totalStageable = 0;

    hunks.forEach((hunk) => {
      totalStageable += hunk.lines.filter(
        (line) => line.kind === "Add" || line.kind === "Del",
      ).length;
    });

    let stagedCount = 0;
    for (const hunkIdx in fileStaged) {
      stagedCount += fileStaged[hunkIdx]?.size || 0;
    }

    if (isUntrackedFile(file)) {
      return isStagedNewFile(file.path)
        ? ("checked" as const)
        : ("unchecked" as const);
    }

    if (isWholeFileStaged(file.path)) {
      return "checked" as const;
    }

    if (stagedCount === 0) return "unchecked" as const;
    if (totalStageable === 0) return "checked" as const;
    if (stagedCount === totalStageable && totalStageable > 0) {
      return "checked" as const;
    }
    return "indeterminate" as const;
  };

  const areAllFilesFullySelected =
    showFileCheckboxes &&
    normalizedFiles.length > 0 &&
    normalizedFiles.every((file) => getCheckboxState(file) === "checked");

  const applyStageAllOptimistic = (targetFiles: ChangesExplorerFile[]) => {
    targetFiles.forEach((file) => {
      if (isUntrackedFile(file)) {
        setStagedNewFile(file.path, true);
        return;
      }

      setLineSelectionForFile(file.path, {});
      setWholeFileStaged(file.path, true);
    });
  };

  const applyUnstageAllOptimistic = (targetFiles: ChangesExplorerFile[]) => {
    targetFiles.forEach((file) => {
      clearStagedLinesForFile(file.path);
    });
  };

  const toggleAllFilesSelection = async () => {
    if (!repoPath || !showFileCheckboxes || normalizedFiles.length === 0) return;
    setActionError(null);

    const previousStagedLines = cloneStagedLinesState(
      useStagedLinesStore.getState().stagedLines,
    );

    try {
      if (areAllFilesFullySelected) {
        applyUnstageAllOptimistic(normalizedFiles);
        await invoke("git_unstage_all", { path: repoPath });
      } else {
        applyStageAllOptimistic(normalizedFiles);
        await invoke("git_stage_all", { path: repoPath });
      }

      scheduleImmediateStageRefresh();
    } catch (error) {
      useStagedLinesStore.setState({ stagedLines: previousStagedLines });
      setActionError(String(error));
    }
  };

  const toggleFileSelection = async (file: ChangesExplorerFile) => {
    if (!repoPath) return;
    setActionError(null);
    const previousStagedLines = cloneStagedLinesState(
      useStagedLinesStore.getState().stagedLines,
    );

    try {
      const checkboxState = getCheckboxState(file);

      if (isUntrackedFile(file)) {
        if (checkboxState === "checked") {
          setStagedNewFile(file.path, false);
          await invoke("git_unstage_file", {
            path: repoPath,
            filePath: file.path,
          });
        } else {
          setStagedNewFile(file.path, true);
          await invoke("git_add_file", { path: repoPath, filePath: file.path });
        }
        scheduleImmediateStageRefresh();
        return;
      }

      if (file.status === "deleted") {
        if (checkboxState === "checked") {
          clearStagedLinesForFile(file.path);
          setWholeFileStaged(file.path, false);
          await invoke("git_unstage_file", {
            path: repoPath,
            filePath: file.path,
          });
        } else {
          setWholeFileStaged(file.path, true);
          await invoke("git_add_file", { path: repoPath, filePath: file.path });
        }
        scheduleImmediateStageRefresh();
        return;
      }

      if (checkboxState === "checked") {
        clearStagedLinesForFile(file.path);
        if ("hunks" in file && file.hunks.length > 0) {
          await invoke("git_stage_lines", {
            path: repoPath,
            filePath: file.path,
            hunks: {},
          });
        } else {
          await invoke("git_unstage_file", {
            path: repoPath,
            filePath: file.path,
          });
        }
        scheduleImmediateStageRefresh();
        return;
      }

      const nextSelection = buildAllStageableLineMap(file);
      setWholeFileStaged(file.path, true);
      setLineSelectionForFile(file.path, {});
      await invoke("git_stage_lines", {
        path: repoPath,
        filePath: file.path,
        hunks: serializeLineSelection(
          Object.fromEntries(
            Object.entries(nextSelection).map(([hunkIdx, lineIdxs]) => [
              Number(hunkIdx),
              new Set(lineIdxs),
            ]),
          ) as Record<number, Set<number>>,
        ),
      });
      scheduleImmediateStageRefresh();
    } catch (error) {
      useStagedLinesStore.setState({ stagedLines: previousStagedLines });
      setActionError(String(error));
    }
  };

  const renderCheckbox = (file: ChangesExplorerFile) => {
    if (!showFileCheckboxes) return null;
    const checkboxState = getCheckboxState(file);

    return (
      <button
        type="button"
        className={`ml-3 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
          checkboxState === "checked" || checkboxState === "indeterminate"
            ? "border-blue-500 bg-blue-600 text-white"
            : "border-zinc-600 bg-transparent text-transparent"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          void toggleFileSelection(file);
        }}
        aria-checked={
          checkboxState === "indeterminate"
            ? "mixed"
            : checkboxState === "checked"
        }
        aria-label={`Toggle file selection for ${file.path}`}
      >
        {checkboxState === "checked" ? (
          <IconCheck size={12} className="text-white" />
        ) : checkboxState === "indeterminate" ? (
          <span className="block h-0.5 w-2 rounded bg-white" />
        ) : null}
      </button>
    );
  };

  const renderFlatFileRow = (file: ChangesExplorerFile) => {
    const isSelected = selectedPath === file.path;
    const fileName = getFileName(file.path);
    const parentPath = getParentPath(file.path);

    return (
      <button
        key={file.path}
        type="button"
        data-file-path={file.path}
        className={`flex w-full items-center gap-2 border-b border-transparent px-3 py-2 text-left text-sm transition-colors ${
          isSelected
            ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
            : "text-foreground hover:bg-background-emphasis"
        }`}
        onClick={() => onSelectFile(file)}
      >
        {getStatusIcon(file)}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{fileName}</span>
            {parentPath ? (
              <span className="truncate text-muted-foreground">
                {parentPath}
              </span>
            ) : null}
          </div>
        </div>
        {!isUntrackedFile(file) ? (
          <div className="ml-3 flex w-16 flex-shrink-0 items-center justify-end gap-2 text-xs">
            <span className="min-w-0 text-right text-lime-400">
              +{file.insertions}
            </span>
            <span className="min-w-0 text-right text-rose-400">
              -{file.deletions}
            </span>
          </div>
        ) : null}
        {renderCheckbox(file)}
      </button>
    );
  };

  const renderTreeNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === "folder") {
        const isOpen = search ? true : (expanded[node.path] ?? true);

        return (
          <div key={node.path}>
            <button
              type="button"
              className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-background-emphasis"
              style={{ paddingLeft: `${12 + depth * 22}px` }}
              onClick={() => toggleFolder(node.path)}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {isOpen ? (
                  <IconChevronDown size={14} />
                ) : (
                  <IconChevronRight size={14} />
                )}
              </span>
              <IconFolder size={16} className="text-slate-300" />
              <span className="truncate">{node.name}</span>
            </button>
            {isOpen ? renderTreeNodes(node.children, depth + 1) : null}
          </div>
        );
      }

      const isSelected = selectedPath === node.file.path;

      return (
        <button
          key={node.file.path}
          type="button"
          data-file-path={node.file.path}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
            isSelected
              ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
              : "text-foreground hover:bg-background-emphasis"
          }`}
          style={{ paddingLeft: `${40 + depth * 22}px` }}
          onClick={() => onSelectFile(node.file)}
        >
          {getStatusIcon(node.file)}
          <span className="min-w-0 flex-1 truncate font-medium">
            {node.name}
          </span>
          {!isUntrackedFile(node.file) ? (
            <div className="ml-3 flex w-16 flex-shrink-0 items-center justify-end gap-2 text-xs">
              <span className="min-w-0 text-right text-lime-400">
                +{node.file.insertions}
              </span>
              <span className="min-w-0 text-right text-rose-400">
                -{node.file.deletions}
              </span>
            </div>
          ) : null}
          {renderCheckbox(node.file)}
        </button>
      );
    });

  const renderSection = (name: SectionName, content: React.ReactNode) => (
    <section key={name} className="pb-2">
      {sectionMode === "tracked-untracked" ? (
        <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-zinc-500/90">
          {name}
        </div>
      ) : null}
      <div>{content}</div>
    </section>
  );

  const modalMenuItems = [
    "Stage All",
    "Unstage All",
    "__separator__",
    "Stash All",
    "Stash Pop",
    "View Stash",
    "__separator__",
    "Open Diff",
    "__separator__",
    "Discard Tracked Changes",
    "Trash Untracked Files",
    "__separator__",
  ];

  const contextMenu =
    contextMenuOpen && menuPos
      ? ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100001] min-w-[220px] rounded border border-zinc-700 bg-zinc-900/95 py-1 text-sm text-zinc-200 shadow-lg"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            {surface === "modal"
              ? modalMenuItems.map((item, index) =>
                  item === "__separator__" ? (
                    <div
                      key={`separator-${index}`}
                      className="my-1 border-t border-zinc-700"
                    />
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className="flex w-full cursor-default items-center justify-between px-3 py-1.5 text-left text-zinc-500"
                      disabled
                    >
                      <span>{item}</span>
                    </button>
                  ),
                )
              : null}
            {(["flat", "tree"] as ChangesExplorerViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors ${
                  viewMode === mode
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-200 hover:bg-zinc-800"
                }`}
                onClick={() => {
                  onViewModeChange(mode);
                  setContextMenuOpen(false);
                }}
              >
                <span>{mode === "flat" ? "Flat View" : "Tree View"}</span>
                {viewMode === mode ? <IconCheck size={14} /> : null}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 flex-1 flex-col border-r border-border bg-background ${className}`}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY);
      }}
    >
      {showHeader ? (
        <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-background-emphasis">
          <span className="text-sm font-semibold text-foreground">
            {files.length} Changes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
              onClick={(e) => {
                const rect = (
                  e.currentTarget as HTMLElement
                ).getBoundingClientRect();
                openContextMenu(rect.left, rect.bottom + 4);
              }}
              aria-label="Open changes menu"
            >
              <IconDotsVertical size={16} />
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                showFileCheckboxes && repoPath && normalizedFiles.length > 0
                  ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  : "bg-zinc-800 text-zinc-400"
              }`}
              onClick={() => {
                void toggleAllFilesSelection();
              }}
              disabled={!showFileCheckboxes || !repoPath || normalizedFiles.length === 0}
            >
              {areAllFilesFullySelected ? "Unstage All" : "Stage All"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-b border-border bg-background-emphasis p-2">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {actionError ? (
          <div className="border-b border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {actionError}
          </div>
        ) : null}
        {sections.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No files found
          </div>
        ) : viewMode === "flat" ? (
          sections.map((section) =>
            renderSection(
              section.name,
              section.files.map((file) => renderFlatFileRow(file)),
            ),
          )
        ) : (
          sectionTrees.map((section) =>
            renderSection(section.name, renderTreeNodes(section.tree, 0)),
          )
        )}
      </div>

      {contextMenu}
    </div>
  );
}

export default ChangesExplorer;
