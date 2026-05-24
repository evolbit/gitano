import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileChangeWithHunks } from "@/shared/types/git";
import DiffModal from "./diff-modal";

vi.mock("@gfazioli/mantine-split-pane", () => {
  const Split = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Pane = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Resizer = () => <div data-testid="split-resizer" />;
  return { Split };
});

vi.mock("@/features/working-changes", () => ({
  ChangesExplorer: ({ files, onSelectFile }: { files: FileChangeWithHunks[]; onSelectFile: (file: FileChangeWithHunks) => void }) => (
    <button type="button" onClick={() => onSelectFile(files[1])}>Select second file</button>
  ),
}));

vi.mock("../diff-viewer/diff-viewer", () => ({
  default: ({ filePath }: { filePath: string }) => <div>Diff viewer for {filePath}</div>,
}));

const files: FileChangeWithHunks[] = [
  { path: "src/alpha.ts", status: "modified", insertions: 1, deletions: 0, hunks: [] },
  { path: "src/beta.ts", status: "modified", insertions: 2, deletions: 1, hunks: [] },
];

describe("DiffModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing while closed", () => {
    render(
      <DiffModal
        open={false}
        files={files}
        initialFile={files[0]}
        repoPath="/repo"
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText("File differences")).not.toBeInTheDocument();
  });

  it("updates the selected diff and reports file selection", () => {
    const onFileSelect = vi.fn();

    render(
      <DiffModal
        open
        files={files}
        initialFile={files[0]}
        repoPath="/repo"
        onClose={vi.fn()}
        onFileSelect={onFileSelect}
      />,
    );

    expect(screen.getByText("Diff viewer for src/alpha.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select second file" }));

    expect(onFileSelect).toHaveBeenCalledWith(files[1]);
    expect(screen.getByText("Diff viewer for src/beta.ts")).toBeInTheDocument();
  });
});
