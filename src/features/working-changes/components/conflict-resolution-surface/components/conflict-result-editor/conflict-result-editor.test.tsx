import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MONACO_THEME } from "@/shared/lib/monaco";
import { GIT_CONFLICT_SIDE } from "@/shared/types/git-conflicts";
import { ConflictResultEditor } from "./conflict-result-editor";

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
  const zoneNodes: HTMLElement[] = [];
  const widgets: HTMLElement[] = [];
  const widgetPositions: Array<{
    column: number;
    lineNumber: number;
    positionAffinity: number | null;
    preference: number[];
  }> = [];
  const laidOutWidgets: HTMLElement[] = [];
  const decorations: unknown[] = [];

  return {
    addedZones,
    decorations,
    layoutContentLeft: 48,
    layoutContentWidth: 720,
    emitScroll(scrollTop: number) {
      scrollListener?.({ scrollTop });
    },
    getScrollTop: vi.fn(() => 0),
    reset() {
      addedZones.length = 0;
      decorations.length = 0;
      laidOutWidgets.length = 0;
      zoneNodes.forEach((zone) => zone.remove());
      zoneNodes.length = 0;
      this.layoutContentLeft = 48;
      this.layoutContentWidth = 720;
      widgets.forEach((widget) => widget.remove());
      widgets.length = 0;
      widgetPositions.length = 0;
      scrollListener = null;
      this.getScrollTop.mockReturnValue(0);
      this.setScrollTop.mockClear();
    },
    setScrollTop: vi.fn(),
    value: {
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
            addedZones.push({
              afterLineNumber: zone.afterLineNumber,
              className: zone.domNode.className,
              heightInLines: zone.heightInLines ?? null,
              heightInPx: zone.heightInPx ?? null,
              marginClassName: zone.marginDomNode?.className ?? "",
              suppressMouseDown: zone.suppressMouseDown ?? null,
              textContent: zone.domNode.textContent ?? "",
            });
            zoneNodes.push(zone.domNode);
            document.body.appendChild(zone.domNode);
            return `zone-${addedZones.length}`;
          },
          removeZone: vi.fn(),
        });
      },
      addContentWidget: (widget: {
        getDomNode: () => HTMLElement;
        getPosition: () => {
          position: { column: number; lineNumber: number };
          positionAffinity?: number;
          preference: number[];
        } | null;
      }) => {
        const node = widget.getDomNode();
        const position = widget.getPosition();

        if (position) {
          widgetPositions.push({
            column: position.position.column,
            lineNumber: position.position.lineNumber,
            positionAffinity: position.positionAffinity ?? null,
            preference: position.preference,
          });
        }

        widgets.push(node);
        document.body.appendChild(node);
      },
      deltaDecorations: (_oldDecorations: string[], nextDecorations: unknown[]) => {
        decorations.length = 0;
        decorations.push(...nextDecorations);
        return nextDecorations.map((_, index) => `decoration-${index}`);
      },
      getModel: () => ({
        getLineCount: () => 20,
      }),
      getLayoutInfo: () => ({
        contentLeft: editorMock.layoutContentLeft,
        contentWidth: editorMock.layoutContentWidth,
      }),
      getScrollTop: () => editorMock.getScrollTop(),
      layoutContentWidget: (widget: {
        beforeRender?: () => { height: number; width: number } | null;
        getDomNode: () => HTMLElement;
      }) => {
        widget.beforeRender?.();
        laidOutWidgets.push(widget.getDomNode());
      },
      onDidScrollChange: (
        listener: (event: { scrollTop: number }) => void,
      ) => {
        scrollListener = listener;

        return { dispose: vi.fn() };
      },
      setScrollTop: (scrollTop: number) => {
        editorMock.setScrollTop(scrollTop);
      },
      removeContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
        widget.getDomNode().remove();
      },
    },
    widgetPositions,
    laidOutWidgets,
  };
});

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
    ContentWidgetPositionPreference: {
      ABOVE: 1,
      BELOW: 2,
    },
    defineTheme: vi.fn(),
    PositionAffinity: { LeftOfInjectedText: 3 },
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
      theme,
    }: {
      value: string;
      onChange: (value: string) => void;
      onMount?: (editor: unknown, monaco: unknown) => void;
      theme?: string;
    }) => {
      React.useEffect(() => {
        onMount?.(editorMock.value, monacoMock);
      }, [onMount]);

      return (
        <textarea
          aria-label="Result editor"
          data-theme={theme}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
    },
  };
});

function renderEditor(overrides = {}) {
  const props = {
    filePath: "src/conflict.ts",
    content: "merged",
    language: "typescript",
    resultRegions: [],
    dirty: true,
    unsupportedReason: null,
    aiResolutionSummary: null,
    aiResolutionDetails: null,
    aiResolutionStatus: null,
    acceptedRegions: [],
    onChange: vi.fn(),
    onSave: vi.fn(),
    onRemoveAcceptedRegionSide: vi.fn(),
    onResetResult: vi.fn(),
    onMarkResolved: vi.fn(),
    markResolvedBlockedReason: null,
    actionInFlight: false,
    syncedScrollTop: null,
    onScrollTopChange: vi.fn(),
    ...overrides,
  };

  render(<ConflictResultEditor {...props} />);
  return props;
}

describe("ConflictResultEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    editorMock.reset();
  });

  it("renders Monaco lazily and delegates edits/actions", async () => {
    const props = renderEditor();

    const editor = await screen.findByLabelText("Result editor");
    fireEvent.change(editor, { target: { value: "next" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Conflict" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Resolved" }));

    expect(props.onChange).toHaveBeenCalledWith("next");
    expect(props.onSave).toHaveBeenCalled();
    expect(props.onResetResult).toHaveBeenCalled();
    expect(props.onMarkResolved).toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Accept Current File" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Result").closest("section")).toHaveAttribute(
      "data-conflict-side",
      GIT_CONFLICT_SIDE.Result,
    );
    expect(editor).toHaveAttribute("data-theme", DEFAULT_MONACO_THEME);
  });

  it("disables mark resolved while conflict markers remain", () => {
    const props = renderEditor({
      markResolvedBlockedReason:
        "Resolve or remove remaining conflict markers before marking this file resolved.",
    });

    expect(screen.getByRole("button", { name: "Mark Resolved" })).toBeDisabled();
    expect(
      screen.getByText(
        "Resolve or remove remaining conflict markers before marking this file resolved.",
      ),
    ).toBeInTheDocument();
    expect(props.onMarkResolved).not.toHaveBeenCalled();
  });

  it("publishes result editor scroll changes", async () => {
    const props = renderEditor();

    await screen.findByLabelText("Result editor");
    act(() => {
      editorMock.emitScroll(120);
    });

    expect(props.onScrollTopChange).toHaveBeenCalledWith(120);
  });

  it("adds visual padding zones for result alignment rows", async () => {
    renderEditor({
      resultRegions: [
        {
          id: "conflict-1",
          resultStartLine: 2,
          resultSeparatorLine: null,
          resultEndLine: 2,
          baseText: "base",
          currentText: "current\nextra",
          incomingText: "incoming",
          paddingLineCount: 1,
          unresolvedText: "base",
        },
      ],
    });

    await screen.findByLabelText("Result editor");

    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 2,
      className: "gitano-conflict-result-padding-zone",
      heightInLines: 1,
      heightInPx: null,
      marginClassName: "",
      suppressMouseDown: null,
      textContent: "",
    });
  });

  it("shows an inline remove action for an accepted region side", async () => {
    const props = renderEditor({
      acceptedRegions: [{ regionId: "conflict-1", label: "Current" }],
      resultRegions: [
        {
          id: "conflict-1",
          resultStartLine: 2,
          resultSeparatorLine: null,
          resultEndLine: 4,
          baseText: "base",
          currentText: "current",
          incomingText: "incoming",
          paddingLineCount: 0,
          unresolvedText: "base",
        },
      ],
    });

    await screen.findByLabelText("Result editor");
    expect(screen.getByRole("button", { name: "Remove Current" }).parentElement)
      .toHaveTextContent("Current | Remove Current");
    fireEvent.click(screen.getByRole("button", { name: "Remove Current" }));

    expect(props.onRemoveAcceptedRegionSide).toHaveBeenCalledWith("conflict-1");
    expect(editorMock.decorations).toHaveLength(1);
    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 1,
      className: "gitano-conflict-result-action-zone",
      heightInLines: null,
      heightInPx: 24,
      marginClassName: "gitano-conflict-result-action-zone-margin",
      suppressMouseDown: null,
      textContent: "",
    });
    expect(editorMock.widgetPositions).toContainEqual({
      column: 1,
      lineNumber: 1,
      positionAffinity: 3,
      preference: [2],
    });
    expect(editorMock.laidOutWidgets[0]).toHaveStyle({
      height: "24px",
      marginLeft: "0px",
      width: "720px",
    });
  });

  it("keeps result action widgets readable during Monaco's initial zero-width layout", async () => {
    editorMock.layoutContentWidth = 0;

    renderEditor({
      acceptedRegions: [{ regionId: "conflict-1", label: "Incoming" }],
      resultRegions: [
        {
          id: "conflict-1",
          resultStartLine: 2,
          resultSeparatorLine: null,
          resultEndLine: 4,
          baseText: "base",
          currentText: "current",
          incomingText: "incoming",
          paddingLineCount: 0,
          unresolvedText: "base",
        },
      ],
    });

    await screen.findByRole("button", { name: "Remove Incoming" });

    expect(editorMock.laidOutWidgets[0]).toHaveStyle({
      height: "24px",
      marginLeft: "0px",
      width: "240px",
    });
    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 1,
      className: "gitano-conflict-result-action-zone",
      heightInLines: null,
      heightInPx: 24,
      marginClassName: "gitano-conflict-result-action-zone-margin",
      suppressMouseDown: null,
      textContent: "",
    });
  });

  it("shows an inline remove action for an accepted combination", async () => {
    const props = renderEditor({
      acceptedRegions: [{ regionId: "conflict-1", label: "Combination" }],
      resultRegions: [
        {
          id: "conflict-1",
          resultStartLine: 1,
          resultSeparatorLine: null,
          resultEndLine: 2,
          baseText: "base",
          currentText: "current",
          incomingText: "incoming",
          paddingLineCount: 0,
          unresolvedText: "base",
        },
      ],
    });

    await screen.findByLabelText("Result editor");
    fireEvent.click(screen.getByRole("button", { name: "Remove Combination" }));

    expect(props.onRemoveAcceptedRegionSide).toHaveBeenCalledWith("conflict-1");
    expect(editorMock.addedZones).toContainEqual({
      afterLineNumber: 0,
      className: "gitano-conflict-result-action-zone",
      heightInLines: null,
      heightInPx: 24,
      marginClassName: "gitano-conflict-result-action-zone-margin",
      suppressMouseDown: null,
      textContent: "",
    });
    expect(editorMock.widgetPositions).toContainEqual({
      column: 1,
      lineNumber: 1,
      positionAffinity: 3,
      preference: [1],
    });
  });

  it("shows inline remove actions for multiple accepted regions", async () => {
    const props = renderEditor({
      acceptedRegions: [
        { regionId: "conflict-1", label: "Incoming" },
        { regionId: "conflict-2", label: "Incoming" },
      ],
      resultRegions: [
        {
          id: "conflict-1",
          resultStartLine: 1,
          resultSeparatorLine: null,
          resultEndLine: 1,
          baseText: "base",
          currentText: "current",
          incomingText: "incoming",
          paddingLineCount: 0,
          unresolvedText: "base",
        },
        {
          id: "conflict-2",
          resultStartLine: 4,
          resultSeparatorLine: null,
          resultEndLine: 4,
          baseText: "base 2",
          currentText: "current 2",
          incomingText: "incoming 2",
          paddingLineCount: 0,
          unresolvedText: "base 2",
        },
      ],
    });

    await screen.findByLabelText("Result editor");
    const removeButtons = screen.getAllByRole("button", {
      name: "Remove Incoming",
    });

    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[1]);

    expect(props.onRemoveAcceptedRegionSide).toHaveBeenCalledWith("conflict-2");
    expect(editorMock.decorations).toHaveLength(2);
  });

  it("shows unsupported guidance instead of mounting Monaco", () => {
    renderEditor({
      unsupportedReason: "Open this conflict in an external editor.",
    });

    expect(
      screen.getByText("Open this conflict in an external editor."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Result editor")).not.toBeInTheDocument();
  });

  it("shows the AI resolution summary with details in a modal", () => {
    const details =
      "inspected the merge context. conflict-1: incoming - keeps the expected behavior. conflict-2: combination - keeps compatible validation changes.";

    renderEditor({
      aiResolutionSummary: "Resolved pricing.ts by keeping conservative pricing.",
      aiResolutionDetails: details,
      aiResolutionStatus: "info",
    });

    expect(
      screen.getByText("Resolved pricing.ts by keeping conservative pricing."),
    ).toBeInTheDocument();
    expect(screen.queryByText("conflict-1")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "AI resolution details" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    const dialog = screen.getByRole("dialog", {
      name: "AI resolution details",
    });
    expect(
      within(dialog).getByText("Inspected the merge context."),
    ).toBeInTheDocument();
    const firstConflictRow = within(dialog).getByText("conflict-1").closest("div");
    const secondConflictRow = within(dialog).getByText("conflict-2").closest("div");
    expect(firstConflictRow).not.toBe(secondConflictRow);
    expect(firstConflictRow).toHaveClass("items-start");
    expect(firstConflictRow?.parentElement?.parentElement).toHaveClass(
      "overflow-y-auto",
    );
    expect(firstConflictRow).toHaveTextContent(
      "Incoming - keeps the expected behavior.",
    );
    expect(secondConflictRow).toHaveTextContent(
      "Combination - keeps compatible validation changes.",
    );
    expect(dialog.innerHTML).not.toContain("bg-purple");

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Close AI resolution details",
      }),
    );
    expect(
      screen.queryByRole("dialog", { name: "AI resolution details" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(
      screen.getByRole("dialog", { name: "AI resolution details" }),
    ).toBeInTheDocument();
  });

  it("dismisses the AI resolution summary row", () => {
    renderEditor({
      aiResolutionSummary: "Resolved pricing.ts by keeping conservative pricing.",
      aiResolutionDetails: "conflict-1: Incoming - keeps expected behavior.",
      aiResolutionStatus: "info",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss AI resolution message",
      }),
    );

    expect(
      screen.queryByText("Resolved pricing.ts by keeping conservative pricing."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View details" }),
    ).not.toBeInTheDocument();
  });

  it("shows AI errors in the result status message", () => {
    renderEditor({
      aiResolutionSummary: "AI candidate is missing conflict signatures. Rerun AI.",
      aiResolutionDetails: "Hidden detail",
      aiResolutionStatus: "error",
    });

    const status = screen.getByText(
      "AI candidate is missing conflict signatures. Rerun AI.",
    );

    expect(status).toBeInTheDocument();
    expect(status.closest(".text-red-100")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "View details" })).not.toBeInTheDocument();
  });
});
