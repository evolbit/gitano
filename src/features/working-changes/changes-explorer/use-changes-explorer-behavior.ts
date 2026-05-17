import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  collectFolderPaths,
  type ChangesExplorerFile,
  type ChangesExplorerTreeNode,
} from "@/shared/lib/tree/changes-explorer-tree";
import { getAncestorFolderPaths } from "@/shared/lib/path";
import { getFolderExpansionKey } from "./utils/folder-expansion-key";
import {
  ChangesExplorerProps,
  ChangesExplorerViewMode,
  ContextMenuScope,
} from "./types";

function areExpandedStatesEqual(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
) {
  if (a === b) return true;

  const aEntries = Object.entries(a);
  if (aEntries.length !== Object.keys(b).length) return false;

  return aEntries.every(([path, value]) => b[path] === value);
}

type SetExpandedState =
  | Record<string, boolean>
  | ((prev: Record<string, boolean>) => Record<string, boolean>);

type UseChangesExplorerBehaviorArgs = Pick<
  ChangesExplorerProps,
  "expandedState" | "onExpandedStateChange" | "autoFocusSearch"
> & {
  search: string;
  selectedPath: string | null;
  viewMode: ChangesExplorerViewMode;
  sectionTrees: {
    name: string;
    files: ChangesExplorerFile[];
    tree: ChangesExplorerTreeNode[];
  }[];
};

export function useChangesExplorerBehavior({
  expandedState,
  onExpandedStateChange,
  autoFocusSearch = false,
  search,
  selectedPath,
  viewMode,
  sectionTrees,
}: UseChangesExplorerBehaviorArgs) {
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({});
  const [activeContextMenu, setActiveContextMenu] =
    useState<ContextMenuScope | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const revealFrameRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandedRef = useRef(expandedState ?? localExpanded);
  const sectionTreesRef = useRef(sectionTrees);
  const onExpandedStateChangeRef = useRef(onExpandedStateChange);

  const expanded = expandedState ?? localExpanded;

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    sectionTreesRef.current = sectionTrees;
  }, [sectionTrees]);

  useEffect(() => {
    onExpandedStateChangeRef.current = onExpandedStateChange;
  }, [onExpandedStateChange]);

  const setExpanded = useCallback(
    (updater: SetExpandedState) => {
      const next =
        typeof updater === "function" ? updater(expandedRef.current) : updater;

      if (areExpandedStatesEqual(next, expandedRef.current)) return;

      expandedRef.current = next;

      if (onExpandedStateChangeRef.current) {
        onExpandedStateChangeRef.current(next);
        return;
      }

      setLocalExpanded(next);
    },
    [],
  );

  const openContextMenu = useCallback(
    (x: number, y: number, scope: ContextMenuScope) => {
      setMenuPos({ x, y });
      setActiveContextMenu(scope);
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setActiveContextMenu(null);
  }, []);

  const toggleFolder = useCallback(
    (expansionKey: string) => {
      setExpanded((prev) => ({
        ...prev,
        [expansionKey]: !(prev[expansionKey] ?? true),
      }));
    },
    [setExpanded],
  );

  const scheduleImmediateStageRefresh = useCallback(
    (onImmediateStageChange?: () => Promise<void> | void) => {
      if (!onImmediateStageChange) return;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        void onImmediateStageChange();
      }, 120);
    },
    [],
  );

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (revealFrameRef.current !== null) {
        cancelAnimationFrame(revealFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!activeContextMenu) return;

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveContextMenu(null);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [activeContextMenu]);

  useLayoutEffect(() => {
    if (!activeContextMenu || !menuRef.current || !menuPos) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    const x = Math.max(8, Math.min(menuPos.x, maxX));
    const y = Math.max(8, Math.min(menuPos.y, maxY));

    if (x !== menuPos.x || y !== menuPos.y) {
      setMenuPos({ x, y });
    }
  }, [activeContextMenu, menuPos]);

  useEffect(() => {
    if (!containerRef.current || !selectedPath) return;

    if (revealFrameRef.current !== null) {
      cancelAnimationFrame(revealFrameRef.current);
    }

    const scheduleReveal = () => {
      revealFrameRef.current = requestAnimationFrame(() => {
        revealFrameRef.current = requestAnimationFrame(() => {
          const escapedPath = (() => {
            if (typeof CSS !== "undefined" && "escape" in CSS) {
              return CSS.escape(selectedPath);
            }

            return selectedPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
          })();

          const el = containerRef.current?.querySelector(
            `[data-file-path='${escapedPath}']`,
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
  }, [search, selectedPath, viewMode]);

  useEffect(() => {
    if (!autoFocusSearch || !searchInputRef.current) return;
    searchInputRef.current.focus();
  }, [autoFocusSearch]);

  useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = { ...prev };

      sectionTrees.forEach((section) => {
        collectFolderPaths(section.tree).forEach((path) => {
          const expansionKey = getFolderExpansionKey(section.name, path);
          if (!(expansionKey in next)) {
            next[expansionKey] = true;
            changed = true;
          }
        });
      });

      return changed ? next : prev;
    });
  }, [sectionTrees, setExpanded]);

  useEffect(() => {
    if (viewMode !== "tree" || !selectedPath) return;

    const ancestorPaths = getAncestorFolderPaths(selectedPath);
    if (ancestorPaths.length === 0) return;

    setExpanded((prev) => {
      let changed = false;
      const next = { ...prev };

      sectionTreesRef.current.forEach((section) => {
        const sectionContainsSelectedPath = section.files.some(
          (file) => file.path === selectedPath,
        );
        if (!sectionContainsSelectedPath) return;

        ancestorPaths.forEach((path) => {
          const expansionKey = getFolderExpansionKey(section.name, path);
          if (next[expansionKey] !== true) {
            next[expansionKey] = true;
            changed = true;
          }
        });
      });

      return changed ? next : prev;
    });
  }, [selectedPath, viewMode, setExpanded]);

  return {
    expanded,
    setExpanded,
    activeContextMenu,
    setActiveContextMenu,
    menuPos,
    setMenuPos,
    actionError,
    setActionError,
    containerRef,
    searchInputRef,
    menuRef,
    openContextMenu,
    closeContextMenu,
    toggleFolder,
    scheduleImmediateStageRefresh,
  };
}
