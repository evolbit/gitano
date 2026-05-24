import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileChange } from "@/shared/types/git";
import DiffFileList from "./diff-file-list";

const files: FileChange[] = [
  { path: "src/alpha.ts", status: "modified", insertions: 2, deletions: 1 },
  { path: "src/beta.ts", status: "added", insertions: 4, deletions: 0 },
];

describe("DiffFileList", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters visible files and activates the filtered selection from the keyboard", () => {
    const onSelect = vi.fn();
    const onAction = vi.fn();

    render(
      <DiffFileList
        files={files}
        selectedIndex={0}
        onSelect={onSelect}
        onAction={onAction}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Buscar archivo..."), {
      target: { value: "beta" },
    });

    expect(screen.queryByText("alpha.ts")).not.toBeInTheDocument();
    expect(screen.getByText("beta.ts")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ path: "src/beta.ts" }),
      0,
    );
  });

  it("selects a file with the pointer", () => {
    const onAction = vi.fn();

    render(
      <DiffFileList
        files={files}
        selectedIndex={0}
        onSelect={vi.fn()}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByText("beta.ts").closest("li") as HTMLElement);

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ path: "src/beta.ts" }),
      1,
    );
  });
});
