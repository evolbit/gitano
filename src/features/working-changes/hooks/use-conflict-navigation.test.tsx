import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { useConflictNavigation } from "./use-conflict-navigation";

function conflict(path: string): ChangesExplorerFile {
  return {
    path,
    status: ChangeType.Conflicted,
    insertions: 0,
    deletions: 0,
  };
}

describe("useConflictNavigation", () => {
  it("reports previous and next conflict paths", () => {
    const onSelectPath = vi.fn();
    const { result } = renderHook(() =>
      useConflictNavigation({
        conflicts: [
          conflict("src/a.ts"),
          conflict("src/b.ts"),
          conflict("src/c.ts"),
        ],
        selectedPath: "src/b.ts",
        onSelectPath,
      }),
    );

    expect(result.current.activeIndex).toBe(1);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.previousPath).toBe("src/a.ts");
    expect(result.current.nextPath).toBe("src/c.ts");

    result.current.goPrevious();
    result.current.goNext();

    expect(onSelectPath).toHaveBeenNthCalledWith(1, "src/a.ts");
    expect(onSelectPath).toHaveBeenNthCalledWith(2, "src/c.ts");
  });

  it("does not navigate when the selected path is missing", () => {
    const onSelectPath = vi.fn();
    const { result } = renderHook(() =>
      useConflictNavigation({
        conflicts: [conflict("src/a.ts")],
        selectedPath: "src/missing.ts",
        onSelectPath,
      }),
    );

    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);

    result.current.goPrevious();
    result.current.goNext();

    expect(onSelectPath).not.toHaveBeenCalled();
  });
});
