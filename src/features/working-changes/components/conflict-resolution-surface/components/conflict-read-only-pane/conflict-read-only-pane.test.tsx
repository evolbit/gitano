import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const editorMock = vi.hoisted(() => {
  let scrollListener: ((event: { scrollTop: number }) => void) | null = null;
  const addedZones: Array<{
    afterLineNumber: number;
    className: string;
    heightInLines: number | null;
    heightInPx: number | null;
    marginClassName: string;
    suppressMouseDown: boolean | null;
    textContent: string;
  }> = [];
  const addedContentWidgets: HTMLElement[] = [];
  const addedContentWidgetPositions: Array<{
    column: number;
    lineNumber: number;
    positionAffinity: number | null;
    preference: number[];
  }> = [];
  const laidOutContentWidgets: HTMLElement[] = [];

  return {
    addedContentWidgetPositions,
    addedContentWidgets,
    addedZones,
    laidOutContentWidgets,
    layoutContentLeft: 48,
    layoutContentWidth: 720,
    emitScroll(scrollTop: number) {
      scrollListener?.({ scrollTop });
    },
    revealLineInCenter: vi.fn(),
    scrollTop: 0,
    setScrollTop: vi.fn(),
    reset() {
      addedContentWidgets.length = 0;
      addedContentWidgetPositions.length = 0;
      laidOutContentWidgets.length = 0;
      addedZones.length = 0;
      scrollListener = null;
      this.revealLineInCenter.mockClear();
      this.layoutContentLeft = 48;
      this.layoutContentWidth = 720;
      this.scrollTop = 0;
      this.setScrollTop.mockClear();
    },
    setScrollListener(listener: (event: { scrollTop: number }) => void) {
      scrollListener = listener;
    },
  };
});

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
      const zoneHostRef = React.useRef<HTMLDivElement | null>(null);

      React.useEffect(() => {
        const widgets: Array<{ getDomNode: () => HTMLElement }> = [];
        const zones = new Map<string, HTMLElement>();
        let zoneIndex = 0;
        const editor = {
          addContentWidget: (widget: {
            getDomNode: () => HTMLElement;
            getPosition: () => {
              position: { column: number; lineNumber: number };
              positionAffinity?: number;
              preference: number[];
            } | null;
          }) => {
            widgets.push(widget);
            editorMock.addedContentWidgets.push(widget.getDomNode());
            const position = widget.getPosition();
            if (position) {
              editorMock.addedContentWidgetPositions.push({
                column: position.position.column,
                lineNumber: position.position.lineNumber,
                positionAffinity: position.positionAffinity ?? null,
                preference: position.preference,
              });
            }
            widgetHostRef.current?.append(widget.getDomNode());
          },
          changeViewZones: (
            callback: (accessor: {
              addZone: (zone: {
                afterLineNumber: number;
                domNode: HTMLElement;
                heightInLines?: number;
                heightInPx?: number;
                marginDomNode?: HTMLElement | null;
                suppressMouseDown?: boolean;
              }) => string;
              removeZone: (id: string) => void;
            }) => void,
          ) => {
            callback({
              addZone: (zone) => {
                zoneIndex += 1;
                const id = `zone-${zoneIndex}`;
                zones.set(id, zone.domNode);
                editorMock.addedZones.push({
                  afterLineNumber: zone.afterLineNumber,
                  className: zone.domNode.className,
                  heightInLines: zone.heightInLines ?? null,
                  heightInPx: zone.heightInPx ?? null,
                  marginClassName: zone.marginDomNode?.className ?? "",
                  suppressMouseDown: zone.suppressMouseDown ?? null,
                  textContent: zone.domNode.textContent ?? "",
                });
                zoneHostRef.current?.append(zone.domNode);
                return id;
              },
              removeZone: (id) => {
                zones.get(id)?.remove();
                zones.delete(id);
              },
            });
          },
          deltaDecorations: () => [],
          getModel: () => ({
            getLineCount: () => value.split("\n").length,
          }),
          getLayoutInfo: () => ({
            contentLeft: editorMock.layoutContentLeft,
            contentWidth: editorMock.layoutContentWidth,
          }),
          getScrollTop: () => editorMock.scrollTop,
          layoutContentWidget: (widget: {
            beforeRender?: () => { height: number; width: number } | null;
            getDomNode: () => HTMLElement;
          }) => {
            widget.beforeRender?.();
            editorMock.laidOutContentWidgets.push(widget.getDomNode());
          },
          onDidScrollChange: (
            listener: (event: { scrollTop: number }) => void,
          ) => {
            editorMock.setScrollListener(listener);

            return { dispose: vi.fn() };
          },
          removeContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
            widget.getDomNode().remove();
          },
          revealLineInCenter: editorMock.revealLineInCenter,
          setScrollTop: (scrollTop: number) => {
            editorMock.scrollTop = scrollTop;
            editorMock.setScrollTop(scrollTop);
            editorMock.emitScroll(scrollTop);
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
            ContentWidgetPositionPreference: { ABOVE: 1, BELOW: 2 },
            defineTheme: vi.fn(),
            OverviewRulerLane: { Right: 1 },
            PositionAffinity: { LeftOfInjectedText: 3 },
          },
        };

        onMount?.(editor, monaco);

        return () => {
          widgets.forEach((widget) => widget.getDomNode().remove());
          zones.forEach((zone) => zone.remove());
        };
      }, [onMount, value]);

      return (
        <>
          <pre aria-label={options?.ariaLabel} data-theme={theme}>
            {value}
          </pre>
          <div ref={zoneHostRef} />
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
  afterEach(() => {
    cleanup();
  });

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
        side={GIT_CONFLICT_SIDE.Incoming}
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
    expect(screen.getByText("Incoming").closest("section")).toHaveAttribute(
      "data-conflict-side",
      GIT_CONFLICT_SIDE.Incoming,
    );
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
        side={GIT_CONFLICT_SIDE.Incoming}
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
    expect(editorMock.addedContentWidgets).toHaveLength(2);
    expect(editorMock.addedContentWidgetPositions[0]).toEqual({
      column: 1,
      lineNumber: 1,
      positionAffinity: 3,
      preference: [1],
    });
    expect(editorMock.addedContentWidgetPositions[1]).toEqual({
      column: 1,
      lineNumber: 2,
      positionAffinity: 3,
      preference: [2],
    });
    expect(editorMock.laidOutContentWidgets).toHaveLength(2);
    expect(editorMock.addedContentWidgets[0]).toHaveStyle({
      height: "24px",
      marginLeft: "0px",
      width: "720px",
    });
    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 0,
      className: "gitano-conflict-action-zone",
      heightInLines: null,
      heightInPx: 24,
      marginClassName: "gitano-conflict-action-zone-margin",
      suppressMouseDown: null,
      textContent: "",
    });
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
        side={GIT_CONFLICT_SIDE.Incoming}
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

  it("keeps action widget mouse events out of Monaco", async () => {
    const onMouseDown = vi.fn();

    renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        side={GIT_CONFLICT_SIDE.Incoming}
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

    await screen.findByRole("button", { name: "Accept Incoming" });

    const widget = editorMock.addedContentWidgets[0];
    widget.parentElement?.addEventListener("mousedown", onMouseDown);
    fireEvent.mouseDown(widget);

    expect(onMouseDown).not.toHaveBeenCalled();
  });

  it("keeps action widgets readable during Monaco's initial zero-width layout", async () => {
    editorMock.layoutContentWidth = 0;

    renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        side={GIT_CONFLICT_SIDE.Incoming}
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

    await screen.findByRole("button", { name: "Accept Incoming" });

    expect(editorMock.addedContentWidgets[0]).toHaveStyle({
      height: "24px",
      marginLeft: "0px",
      width: "420px",
    });
    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 0,
      className: "gitano-conflict-action-zone",
      heightInLines: null,
      heightInPx: 24,
      marginClassName: "gitano-conflict-action-zone-margin",
      suppressMouseDown: null,
      textContent: "",
    });
  });

  it("hides conflict actions after a region side is accepted", async () => {
    const { container } = renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        side={GIT_CONFLICT_SIDE.Incoming}
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
    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 0,
      className:
        "gitano-conflict-action-zone gitano-conflict-action-zone-spacer",
      heightInLines: null,
      heightInPx: 24,
      marginClassName:
        "gitano-conflict-action-zone-margin gitano-conflict-action-zone-spacer",
      suppressMouseDown: null,
      textContent: "",
    });
  });

  it("adds display-only alignment zones for shorter side regions", async () => {
    renderWithQueryClient(
      <ConflictReadOnlyPane
        repoPath="/repo"
        filePath="src/conflict.ts"
        title="Incoming"
        side={GIT_CONFLICT_SIDE.Incoming}
        version={version()}
        language="typescript"
        regions={[
          {
            id: "conflict-1",
            resultStartLine: 1,
            resultSeparatorLine: null,
            resultEndLine: 2,
            alignmentLineCount: 3,
          },
        ]}
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

    await screen.findByLabelText("Incoming conflict editor");

    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 2,
      className: "gitano-conflict-side-alignment-zone",
      heightInLines: 3,
      heightInPx: null,
      marginClassName: "",
      suppressMouseDown: null,
      textContent: "",
    });
  });

  it("registers a live scroll handle for parent-driven synchronization", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const onScrollPaneMount = vi.fn();
    const rerenderedOnScrollPaneMount = vi.fn();
    const region = {
      id: "conflict-1",
      resultStartLine: 1,
      resultSeparatorLine: null,
      resultEndLine: 1,
    };
    const renderPane = (
      mountHandler: typeof onScrollPaneMount,
      acceptedRegionSidesById = {},
    ) => (
      <QueryClientProvider client={client}>
        <ConflictReadOnlyPane
          repoPath="/repo"
          filePath="src/conflict.ts"
          title="Incoming"
          side={GIT_CONFLICT_SIDE.Incoming}
          version={version({ text: "one\ntwo\nthree\nfour" })}
          language="typescript"
          regions={[region]}
          activeRegion={null}
          acceptedRegionSidesById={acceptedRegionSidesById}
          {...fileActionProps()}
          onAcceptRegion={vi.fn()}
          onAcceptCombination={vi.fn()}
          onIgnoreRegion={vi.fn()}
          syncedScrollTop={null}
          onScrollTopChange={vi.fn()}
          onScrollPaneMount={mountHandler}
        />
      </QueryClientProvider>
    );

    const { rerender } = render(renderPane(onScrollPaneMount));

    await screen.findByLabelText("Incoming conflict editor");

    const mountCalls = onScrollPaneMount.mock.calls;
    const handle = mountCalls[mountCalls.length - 1]?.[0];
    expect(handle).toEqual({ setScrollTop: expect.any(Function) });

    act(() => {
      handle.setScrollTop(180);
    });

    expect(editorMock.setScrollTop).toHaveBeenCalledWith(180);

    rerender(
      renderPane(rerenderedOnScrollPaneMount, {
        [region.id]: GIT_CONFLICT_SIDE.Incoming,
      }),
    );

    expect(onScrollPaneMount).not.toHaveBeenCalledWith(null);

    act(() => {
      handle.setScrollTop(220);
    });

    expect(editorMock.setScrollTop).toHaveBeenCalledWith(220);
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
          side={GIT_CONFLICT_SIDE.Incoming}
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
    expect(onScrollTopChange).not.toHaveBeenCalledWith(120);

    act(() => {
      editorMock.emitScroll(160);
    });

    expect(onScrollTopChange).toHaveBeenCalledWith(160);
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
        side={GIT_CONFLICT_SIDE.Incoming}
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

  it("keeps range-loaded actions in a non-overlapping side action strip", async () => {
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
        side={GIT_CONFLICT_SIDE.Incoming}
        version={version({
          text: "",
          size: {
            byteSize: 12_000_000,
            lineCount: 100_000,
            sizeClass: GIT_CONFLICT_SIZE_CLASS.VeryLarge,
          },
        })}
        language="typescript"
        regions={[
          {
            id: "conflict-1",
            resultStartLine: 1,
            resultSeparatorLine: null,
            resultEndLine: 1,
          },
        ]}
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

    const actionStrip = await screen.findByText("Accept Incoming");

    expect(actionStrip.closest("[data-conflict-range-action-strip]")).not.toBeNull();
    expect(actionStrip.closest("section")).toHaveAttribute(
      "data-conflict-side",
      GIT_CONFLICT_SIDE.Incoming,
    );
  });
});
