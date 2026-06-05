import { useCallback, useMemo } from "react";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";

type UseConflictNavigationOptions = {
  conflicts: ChangesExplorerFile[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
};

export function useConflictNavigation({
  conflicts,
  selectedPath,
  onSelectPath,
}: UseConflictNavigationOptions) {
  const conflictPaths = useMemo(
    () => conflicts.map((conflict) => conflict.path),
    [conflicts],
  );
  const activeIndex = selectedPath
    ? conflictPaths.indexOf(selectedPath)
    : -1;
  const previousPath =
    activeIndex > 0 ? conflictPaths[activeIndex - 1] : null;
  const nextPath =
    activeIndex >= 0 && activeIndex < conflictPaths.length - 1
      ? conflictPaths[activeIndex + 1]
      : null;

  const goPrevious = useCallback(() => {
    if (previousPath) onSelectPath(previousPath);
  }, [onSelectPath, previousPath]);

  const goNext = useCallback(() => {
    if (nextPath) onSelectPath(nextPath);
  }, [nextPath, onSelectPath]);

  return {
    activeIndex,
    totalCount: conflictPaths.length,
    previousPath,
    nextPath,
    canGoPrevious: previousPath !== null,
    canGoNext: nextPath !== null,
    goPrevious,
    goNext,
  };
}
