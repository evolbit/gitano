import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiffViewer from "./diff-viewer";

const mocks = vi.hoisted(() => ({
  getCommitFileDiff: vi.fn(),
  getStashFileDiff: vi.fn(),
  getDiffContext: vi.fn(),
}));

vi.mock("@/shared/api/git/diffs", () => mocks);
vi.mock("@/shared/api/git/staging", () => ({ stageLines: vi.fn() }));

vi.mock("../diff-viewer-base/diff-viewer-base", () => ({
  default: ({ hunks, loading, filePath }: { hunks: unknown[]; loading: boolean; filePath: string }) => (
    <div>
      <span>Base for {filePath}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="hunk-count">{hunks.length}</span>
    </div>
  ),
}));

describe("DiffViewer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads commit hunks for immutable diffs", async () => {
    mocks.getCommitFileDiff.mockResolvedValueOnce([
      { header: "@@", old_start: 1, old_lines: 1, new_start: 1, new_lines: 1, lines: [], is_new_file: false },
    ]);

    render(<DiffViewer repoPath="/repo" filePath="src/app.ts" sha="abc123" />);

    await waitFor(() => {
      expect(mocks.getCommitFileDiff).toHaveBeenCalledWith({
        path: "/repo",
        sha: "abc123",
        filePath: "src/app.ts",
        context: 3,
      });
    });
    await waitFor(() => expect(screen.getByTestId("hunk-count")).toHaveTextContent("1"));
  });

  it("uses the stash diff API for stash sources", async () => {
    mocks.getStashFileDiff.mockResolvedValueOnce([]);

    render(
      <DiffViewer
        repoPath="/repo"
        filePath="src/app.ts"
        sha="stash@{0}"
        diffSource="stash"
      />,
    );

    await waitFor(() => expect(mocks.getStashFileDiff).toHaveBeenCalledOnce());
  });
});
