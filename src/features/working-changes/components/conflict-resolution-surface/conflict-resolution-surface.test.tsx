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
  type GitConflictSide,
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

const monacoMock = vi.hoisted(() => ({
  Range: class Range {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
  editor: {
    ContentWidgetPositionPreference: { ABOVE: 1 },
    defineTheme: vi.fn(),
    OverviewRulerLane: { Right: 1 },
  },
}));

vi.mock("monaco-editor", () => ({
  ...monacoMock,
}));

vi.mock("@monaco-editor/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    loader: {
      config: vi.fn(),
    },
    default: ({
      value,
      onChange,
      onMount,
      options,
    }: {
      value: string;
      onChange?: (value: string) => void;
      onMount?: (editor: unknown, monaco: unknown) => void;
      options?: { ariaLabel?: string };
    }) => {
      const widgetHostRef = React.useRef<HTMLDivElement | null>(null);

      React.useEffect(() => {
        const widgets: Array<{ getDomNode: () => HTMLElement }> = [];
        const editor = {
          addContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
            widgets.push(widget);
            widgetHostRef.current?.append(widget.getDomNode());
          },
          changeViewZones: (
            callback: (accessor: {
              addZone: () => string;
              removeZone: () => void;
            }) => void,
          ) => {
            callback({
              addZone: () => "zone",
              removeZone: vi.fn(),
            });
          },
          deltaDecorations: () => [],
          getModel: () => ({
            getLineCount: () => Math.max(1, value.split("\n").length),
          }),
          getScrollTop: () => 0,
          onDidScrollChange: () => ({ dispose: vi.fn() }),
          removeContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
            widget.getDomNode().remove();
          },
          revealLineInCenter: vi.fn(),
          setScrollTop: vi.fn(),
        };

        onMount?.(editor, monacoMock);

        return () => {
          widgets.forEach((widget) => widget.getDomNode().remove());
        };
      }, [onMount, value]);

      return (
        <>
          <textarea
            aria-label={options?.ariaLabel ?? "Result editor"}
            value={value}
            onChange={(event) => onChange?.(event.currentTarget.value)}
          />
          <div ref={widgetHostRef} />
        </>
      );
    },
  };
});

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

function version(side: GitConflictSide, text: string) {
  return {
    side,
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    text,
    size: {
      byteSize: text.length,
      lineCount: text.split("\n").length,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    lineEnding: GIT_CONFLICT_LINE_ENDING.Lf,
    hasFinalNewline: true,
  };
}

function detail(overrides: Partial<GitConflictFileDetail> = {}): GitConflictFileDetail {
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
    ...overrides,
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

  it("contains the merge surface inside the available workspace width", async () => {
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

    const root = screen.getByText("Conflict 2 of 3").closest("section");

    expect(root).toHaveClass("min-w-0");
    expect(root).toHaveClass("overflow-hidden");

    await waitFor(() => {
      expect(screen.getByText("Result")).toBeInTheDocument();
    });
  });

  it("places file accept actions in the matching side pane headers", async () => {
    getMergeConflictFileMock.mockResolvedValueOnce(
      detail({
        base: version(GIT_CONFLICT_SIDE.Base, "base"),
        current: version(GIT_CONFLICT_SIDE.Current, "current"),
        incoming: version(GIT_CONFLICT_SIDE.Incoming, "incoming"),
        result: version(
          GIT_CONFLICT_SIDE.Result,
          ["<<<<<<< HEAD", "current", "=======", "incoming", ">>>>>>> branch"].join("\n"),
        ),
      }),
    );

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

    const incomingFileButton = await screen.findByRole("button", {
      name: "Accept Incoming File",
    });
    const currentFileButton = screen.getByRole("button", {
      name: "Accept Current File",
    });
    const resultSection = screen.getByText("Result").closest("section");

    expect(screen.getByText("Incoming").closest("section")).toContainElement(
      incomingFileButton,
    );
    expect(screen.getByText("Current").closest("section")).toContainElement(
      currentFileButton,
    );
    expect(resultSection).not.toContainElement(incomingFileButton);
    expect(resultSection).not.toContainElement(currentFileButton);

    fireEvent.click(currentFileButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Result editor")).toHaveValue("current");
    });
    expect(screen.getByRole("button", { name: "Remove Current" })).toBeInTheDocument();
    expect(acceptConflictSideMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset Conflict" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Result editor")).toHaveValue("base");
    });
  });

  it("keeps the opposite side actions available and updates the inline result remove action", async () => {
    getMergeConflictFileMock.mockResolvedValueOnce(
      detail({
        base: version(GIT_CONFLICT_SIDE.Base, "base"),
        current: version(GIT_CONFLICT_SIDE.Current, "current"),
        incoming: version(GIT_CONFLICT_SIDE.Incoming, "incoming"),
        result: version(
          GIT_CONFLICT_SIDE.Result,
          ["<<<<<<< HEAD", "current", "=======", "incoming", ">>>>>>> branch"].join("\n"),
        ),
      }),
    );

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

    fireEvent.click(await screen.findByRole("button", { name: "Accept Current" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove Current" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Accept Current" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept Incoming" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Accept Combination (Incoming First)",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept Incoming" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove Incoming" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Remove Current" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept Current" })).toBeInTheDocument();
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
