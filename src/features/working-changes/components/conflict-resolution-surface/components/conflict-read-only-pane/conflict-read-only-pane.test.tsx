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
import { ConflictReadOnlyPane } from "./conflict-read-only-pane";

const getMergeConflictContentRangeMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/conflicts", () => ({
  getMergeConflictContentRange: getMergeConflictContentRangeMock,
}));

vi.mock("monaco-editor", () => ({
  editor: {},
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
      value,
    }: {
      onMount?: (editor: unknown, monaco: unknown) => void;
      options?: { ariaLabel?: string };
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
          getScrollTop: () => 0,
          onDidScrollChange: () => ({ dispose: vi.fn() }),
          removeContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
            widget.getDomNode().remove();
          },
          revealLineInCenter: vi.fn(),
          setScrollTop: vi.fn(),
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
          <pre aria-label={options?.ariaLabel}>{value}</pre>
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

describe("ConflictReadOnlyPane", () => {
  beforeEach(() => {
    getMergeConflictContentRangeMock.mockReset();
  });

  it("renders full text content", async () => {
    renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        version={version()}
        language="typescript"
        regions={[]}
        activeRegion={null}
        acceptedRegionLabel={null}
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
  });

  it("renders active conflict actions in the text pane", async () => {
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
        ]}
        activeRegion={{
          id: "conflict-1",
          resultStartLine: 1,
          resultSeparatorLine: 2,
          resultEndLine: 3,
        }}
        acceptedRegionLabel={null}
        onAcceptRegion={onAcceptRegion}
        onAcceptCombination={onAcceptCombination}
        onIgnoreRegion={onIgnoreRegion}
        syncedScrollTop={null}
        onScrollTopChange={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Accept Incoming" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Accept Combination (Incoming First)",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));

    expect(onAcceptRegion).toHaveBeenCalled();
    expect(onAcceptCombination).toHaveBeenCalled();
    expect(onIgnoreRegion).toHaveBeenCalled();
  });

  it("hides active conflict actions after a region side is accepted", async () => {
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
        acceptedRegionLabel="Incoming"
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
        acceptedRegionLabel={null}
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
