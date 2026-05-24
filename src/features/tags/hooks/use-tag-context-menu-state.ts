import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import type { TagContextMenu } from "../components/tags-panel/types";

export function useTagContextMenuState() {
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<TagContextMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const openContextMenu = useCallback((node: BranchTreeNode, x: number, y: number) => {
    setContextMenu({ x, y, node });
    setMenuPos({ x, y });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const isRowActionsVisible = useCallback(
    (rowKey: string) => hoveredRowKey === rowKey || contextMenu?.node.full === rowKey,
    [hoveredRowKey, contextMenu],
  );

  return {
    closeContextMenu,
    contextMenu,
    isRowActionsVisible,
    menuPos,
    menuRef,
    openContextMenu,
    setHoveredRowKey,
  };
}
