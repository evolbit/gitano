import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictVersion,
} from "@/shared/types/git-conflicts";
import { DEFAULT_MONACO_THEME } from "@/shared/lib/monaco";
import { ConflictReadOnlyPane } from "./conflict-read-only-pane";

const getMergeConflictContentRangeMock = vi.hoisted(() => vi.fn());
const editorMock = vi.hoisted(() => ({
  revealLineInCenter: vi.fn(),
  scrollTop: 0,
  setScrollTop: vi.fn(),
  reset() {
    this.revealLineInCenter.mockClear();
    this.scrollTop = 0;
    this.setScrollTop.mockClear();
  },
}));

vi.mock("@/shared/api/git/conflicts", () => ({
  getMergeConflictContentRange: getMergeConflictContentRangeMock,
}));

vi.mock("monaco-editor", () => ({
  editor: {
    defineTheme: vi.fn(),
  },
}));

vi.mock("@monaco-editor/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    loader: {
      config: vi.fn(),
    },
    default: ({
      onMount,
      options,
      theme,
      value,
    }: {
      onMount?: (editor: unknown, monaco: unknown) => void;
      options?: { ariaLabel?: string };
      theme?: string;
      value: string;
    }) => {
      const widgetHostRef = React.useRef<HTMLDivElement | null>(null);

      React.useEffect(() => {
        const widgets: Array<{ getDomNode: () => HTMLElement }> = [];
        const editor = {
          addContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
            widgets.push(widget);
            widgetHostRef.current?.append(widget.getDomNode());
          },
          deltaDecorations: () => [],
          getModel: () => ({
            getLineCount: () => value.split("\n").length,
          }),
          getScrollTop: () => editorMock.scrollTop,
          onDidScrollChange: () => ({ dispose: vi.fn() }),
          removeContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
            widget.getDomNode().remove();
          },
          revealLineInCenter: editorMock.revealLineInCenter,
          setScrollTop: (scrollTop: number) => {
            editorMock.scrollTop = scrollTop;
            editorMock.setScrollTop(scrollTop);
          },
        };
        const monaco = {
          Range: class {
            constructor(
              public startLineNumber: number,
              public startColumn: number,
              public endLineNumber: number,
              public endColumn: number,
            ) {}
          },
          editor: {
            ContentWidgetPositionPreference: { ABOVE: 0 },
            defineTheme: vi.fn(),
            OverviewRulerLane: { Right: 1 },
          },
        };

        onMount?.(editor, monaco);

        return () => {
          widgets.forEach((widget) => widget.getDomNode().remove());
        };
      }, [onMount, value]);

      return (
        <>
          <pre aria-label={options?.ariaLabel} data-theme={theme}>
            {value}
          </pre>
          <div ref={widgetHostRef} />
        </>
      );
    },
  };
});

function renderWithQueryClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function version(overrides: Partial<GitConflictVersion> = {}): GitConflictVersion {
  return {
    side: GIT_CONFLICT_SIDE.Incoming,
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    text: "one\ntwo",
    size: {
      byteSize: 7,
      lineCount: 2,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    lineEnding: GIT_CONFLICT_LINE_ENDING.Lf,
    hasFinalNewline: false,
    ...overrides,
  };
}

function fileActionProps(onAcceptFile = vi.fn()) {
  return {
    fileActionLabel: "Accept Incoming File",
    fileActionTitle: "Replace the entire result file with the incoming side.",
    fileActionDisabled: false,
    onAcceptFile,
  };
}

describe("ConflictReadOnlyPane", () => {
  beforeEach(() => {
    getMergeConflictContentRangeMock.mockReset();
    editorMock.reset();
  });

  it("renders full text content", async () => {
    const onAcceptFile = vi.fn();

    renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        version={version()}
        language="typescript"
        regions={[]}
        activeRegion={null}
        acceptedRegionSidesById={{}}
        {...fileActionProps(onAcceptFile)}
        onAcceptRegion={vi.fn()}
        onAcceptCombination={vi.fn()}
        onIgnoreRegion={vi.fn()}
        syncedScrollTop={null}
        onScrollTopChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Incoming")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Incoming conflict editor"),
    ).toHaveTextContent("one two");
    expect(screen.getByLabelText("Incoming conflict editor")).toHaveAttribute(
      "data-theme",
      DEFAULT_MONACO_THEME,
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept Incoming File" }));

    expect(onAcceptFile).toHaveBeenCalled();
  });

  it("renders conflict actions for every text conflict region", async () => {
    const onAcceptRegion = vi.fn();
    const onAcceptCombination = vi.fn();
    const onIgnoreRegion = vi.fn();

    renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        version={version()}
        language="typescript"
        regions={[
          {
            id: "conflict-1",
            resultStartLine: 1,
            resultSeparatorLine: 2,
            resultEndLine: 3,
          },
          {
            id: "conflict-2",
            resultStartLine: 4,
            resultSeparatorLine: 5,
            resultEndLine: 6,
          },
        ]}
        activeRegion={null}
        acceptedRegionSidesById={{}}
        {...fileActionProps()}
        onAcceptRegion={onAcceptRegion}
        onAcceptCombination={onAcceptCombination}
        onIgnoreRegion={onIgnoreRegion}
        syncedScrollTop={null}
        onScrollTopChange={vi.fn()}
      />,
    );

    const acceptButtons = await screen.findAllByRole("button", {
      name: "Accept Incoming",
    });
    const combinationButtons = screen.getAllByRole("button", {
      name: "Accept Combination (Incoming First)",
    });
    const ignoreButtons = screen.getAllByRole("button", { name: "Ignore" });

    expect(acceptButtons).toHaveLength(2);
    fireEvent.click(acceptButtons[1]);
    fireEvent.click(combinationButtons[1]);
    fireEvent.click(ignoreButtons[1]);

    expect(onAcceptRegion).toHaveBeenCalledWith("conflict-2");
    expect(onAcceptCombination).toHaveBeenCalledWith("conflict-2");
    expect(onIgnoreRegion).toHaveBeenCalledWith("conflict-2");
  });

  it("keeps actions visible for non-accepted regions", async () => {
    const { container } = renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        version={version()}
        language="typescript"
        regions={[
          {
            id: "conflict-1",
            resultStartLine: 1,
            resultSeparatorLine: 2,
            resultEndLine: 3,
          },
          {
            id: "conflict-2",
            resultStartLine: 4,
            resultSeparatorLine: 5,
            resultEndLine: 6,
          },
        ]}
        activeRegion={null}
        acceptedRegionSidesById={{ "conflict-1": GIT_CONFLICT_SIDE.Incoming }}
        {...fileActionProps()}
        onAcceptRegion={vi.fn()}
        onAcceptCombination={vi.fn()}
        onIgnoreRegion={vi.fn()}
        syncedScrollTop={null}
        onScrollTopChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        within(container).getByLabelText("Incoming conflict editor"),
      ).toBeInTheDocument();
    });

    expect(
      within(container).getAllByRole("button", { name: "Accept Incoming" }),
    ).toHaveLength(1);
  });

  it("hides conflict actions after a region side is accepted", async () => {
    const { container } = renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        version={version()}
        language="typescript"
        regions={[
          {
            id: "conflict-1",
            resultStartLine: 1,
            resultSeparatorLine: 2,
            resultEndLine: 3,
          },
        ]}
        activeRegion={{
          id: "conflict-1",
          resultStartLine: 1,
          resultSeparatorLine: 2,
          resultEndLine: 3,
        }}
        acceptedRegionSidesById={{ "conflict-1": GIT_CONFLICT_SIDE.Incoming }}
        {...fileActionProps()}
        onAcceptRegion={vi.fn()}
        onAcceptCombination={vi.fn()}
        onIgnoreRegion={vi.fn()}
        syncedScrollTop={null}
        onScrollTopChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        within(container).getByLabelText("Incoming conflict editor"),
      ).toBeInTheDocument();
    });

    expect(
      within(container).queryByRole("button", { name: "Accept Incoming" }),
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByRole("button", {
        name: "Accept Combination (Incoming First)",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByRole("button", { name: "Ignore" }),
    ).not.toBeInTheDocument();
  });

  it("does not recenter the active region when synced scroll changes", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const activeRegion = {
      id: "conflict-1",
      resultStartLine: 2,
      resultSeparatorLine: null,
      resultEndLine: 2,
    };
    const onScrollTopChange = vi.fn();
    const renderPane = (syncedScrollTop: number | null) => (
      <QueryClientProvider client={client}>
        <ConflictReadOnlyPane
          repoPath="/repo"
          filePath="src/conflict.ts"
          title="Incoming"
          version={version({ text: "one\ntwo\nthree\nfour" })}
          language="typescript"
          regions={[activeRegion]}
          activeRegion={{ ...activeRegion }}
          acceptedRegionSidesById={{}}
          {...fileActionProps()}
          onAcceptRegion={vi.fn()}
          onAcceptCombination={vi.fn()}
          onIgnoreRegion={vi.fn()}
          syncedScrollTop={syncedScrollTop}
          onScrollTopChange={onScrollTopChange}
        />
      </QueryClientProvider>
    );

    const { rerender } = render(renderPane(null));

    await waitFor(() => {
      expect(editorMock.revealLineInCenter).toHaveBeenCalledWith(2);
    });

    editorMock.revealLineInCenter.mockClear();
    rerender(renderPane(120));

    await waitFor(() => {
      expect(editorMock.setScrollTop).toHaveBeenCalledWith(120);
    });
    expect(editorMock.revealLineInCenter).not.toHaveBeenCalled();
  });

  it("loads a line range for very large text content", async () => {
    getMergeConflictContentRangeMock.mockResolvedValueOnce({
      path: "src/conflict.ts",
      side: GIT_CONFLICT_SIDE.Incoming,
      startLine: 1,
      lines: ["range-one"],
      totalLineCount: 100_000,
      signature: "sig",
    });

    renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        version={version({
          text: "",
          size: {
            byteSize: 12_000_000,
            lineCount: 100_000,
            sizeClass: GIT_CONFLICT_SIZE_CLASS.VeryLarge,
          },
        })}
        language="typescript"
        regions={[]}
        activeRegion={null}
        acceptedRegionSidesById={{}}
        {...fileActionProps()}
        onAcceptRegion={vi.fn()}
        onAcceptCombination={vi.fn()}
        onIgnoreRegion={vi.fn()}
        syncedScrollTop={null}
        onScrollTopChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getMergeConflictContentRangeMock).toHaveBeenCalled();
    });
  });
});
