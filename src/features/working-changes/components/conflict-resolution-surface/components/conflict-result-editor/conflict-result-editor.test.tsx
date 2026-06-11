import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MONACO_THEME } from "@/shared/lib/monaco";
import { ConflictResultEditor } from "./conflict-result-editor";

const editorMock = vi.hoisted(() => {
  let scrollListener: ((event: { scrollTop: number }) => void) | null = null;
  const addedZones: Array<{ afterLineNumber: number; heightInLines: number }> =
    [];
  const widgets: HTMLElement[] = [];
  const decorations: unknown[] = [];

  return {
    addedZones,
    decorations,
    emitScroll(scrollTop: number) {
      scrollListener?.({ scrollTop });
    },
    getScrollTop: vi.fn(() => 0),
    reset() {
      addedZones.length = 0;
      decorations.length = 0;
      widgets.forEach((widget) => widget.remove());
      widgets.length = 0;
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
            heightInLines: number;
          }) => string;
          removeZone: (id: string) => void;
        }) => void,
      ) => {
        callback({
          addZone: (zone) => {
            addedZones.push({
              afterLineNumber: zone.afterLineNumber,
              heightInLines: zone.heightInLines,
            });
            return `zone-${addedZones.length}`;
          },
          removeZone: vi.fn(),
        });
      },
      addContentWidget: (widget: { getDomNode: () => HTMLElement }) => {
        const node = widget.getDomNode();
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
      getScrollTop: () => editorMock.getScrollTop(),
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
    },
    defineTheme: vi.fn(),
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
      heightInLines: 1,
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
    fireEvent.click(screen.getByRole("button", { name: "Remove Current" }));

    expect(props.onRemoveAcceptedRegionSide).toHaveBeenCalledWith("conflict-1");
    expect(editorMock.decorations).toHaveLength(1);
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
});
