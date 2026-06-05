import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictFileDetail,
} from "@/shared/types/git-conflicts";
import { ConflictResolutionSurface } from "./conflict-resolution-surface";

const getMergeConflictFileMock = vi.hoisted(() => vi.fn());
const writeConflictResultMock = vi.hoisted(() => vi.fn());
const acceptConflictSideMock = vi.hoisted(() => vi.fn());
const markConflictResolvedMock = vi.hoisted(() => vi.fn());
const getMergeConflictContentRangeMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/conflicts", () => ({
  getMergeConflictFile: getMergeConflictFileMock,
  getMergeConflictContentRange: getMergeConflictContentRangeMock,
  writeConflictResult: writeConflictResultMock,
  acceptConflictSide: acceptConflictSideMock,
  markConflictResolved: markConflictResolvedMock,
}));

vi.mock("monaco-editor", () => ({
  editor: {},
}));

vi.mock("@monaco-editor/react", () => ({
  loader: {
    config: vi.fn(),
  },
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Result editor"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}));

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function detail(): GitConflictFileDetail {
  const result = {
    side: GIT_CONFLICT_SIDE.Result,
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    text: "merged",
    size: {
      byteSize: 6,
      lineCount: 1,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    lineEnding: GIT_CONFLICT_LINE_ENDING.Lf,
    hasFinalNewline: true,
  };

  return {
    path: "src/b.ts",
    status: ChangeType.Conflicted,
    base: null,
    current: null,
    incoming: null,
    result,
    regions: [{ id: "conflict-1", resultStartLine: 1, resultSeparatorLine: 3, resultEndLine: 5 }],
    conflictKinds: [GIT_CONFLICT_KIND.BothModified],
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    signatures: {
      indexSignature: "index",
      resultSignature: "result",
    },
  };
}

const conflicts = [
  { path: "src/a.ts", status: ChangeType.Conflicted, insertions: 0, deletions: 0 },
  { path: "src/b.ts", status: ChangeType.Conflicted, insertions: 0, deletions: 0 },
  { path: "src/c.ts", status: ChangeType.Conflicted, insertions: 0, deletions: 0 },
];

describe("ConflictResolutionSurface", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    getMergeConflictFileMock.mockReset();
    getMergeConflictFileMock.mockResolvedValue(detail());
    writeConflictResultMock.mockReset();
    acceptConflictSideMock.mockReset();
    markConflictResolvedMock.mockReset();
    getMergeConflictContentRangeMock.mockReset();
  });

  it("loads conflict detail for the selected file", async () => {
    renderWithQueryClient(
      <ConflictResolutionSurface
        repoPath="/repo"
        filePath="src/b.ts"
        fileSignature="sig"
        conflicts={conflicts}
        onSelectConflictPath={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Conflict 2 of 3")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Result")).toBeInTheDocument();
    });
    expect(getMergeConflictFileMock).toHaveBeenCalledWith("/repo", "src/b.ts");
  });

  it("navigates conflict files and closes the surface", () => {
    const onSelectConflictPath = vi.fn();
    const onClose = vi.fn();

    renderWithQueryClient(
      <ConflictResolutionSurface
        repoPath="/repo"
        filePath="src/b.ts"
        fileSignature="sig"
        conflicts={conflicts}
        onSelectConflictPath={onSelectConflictPath}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous conflict" }));
    fireEvent.click(screen.getByRole("button", { name: "Next conflict" }));
    fireEvent.click(screen.getByRole("button", { name: "Close conflict resolution" }));

    expect(onSelectConflictPath).toHaveBeenNthCalledWith(1, "src/a.ts");
    expect(onSelectConflictPath).toHaveBeenNthCalledWith(2, "src/c.ts");
    expect(onClose).toHaveBeenCalled();
  });

  it("refreshes conflict detail on demand", async () => {
    renderWithQueryClient(
      <ConflictResolutionSurface
        repoPath="/repo"
        filePath="src/b.ts"
        fileSignature="sig"
        conflicts={conflicts}
        onSelectConflictPath={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getMergeConflictFileMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh conflict detail" }));

    await waitFor(() => {
      expect(getMergeConflictFileMock).toHaveBeenCalledTimes(2);
    });
  });
});
