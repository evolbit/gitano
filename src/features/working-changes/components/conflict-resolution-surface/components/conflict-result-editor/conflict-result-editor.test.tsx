import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConflictResultEditor } from "./conflict-result-editor";

const editorMock = vi.hoisted(() => {
  let scrollListener: ((event: { scrollTop: number }) => void) | null = null;
  const addedZones: Array<{ afterLineNumber: number; heightInLines: number }> =
    [];

  return {
    addedZones,
    emitScroll(scrollTop: number) {
      scrollListener?.({ scrollTop });
    },
    getScrollTop: vi.fn(() => 0),
    reset() {
      addedZones.length = 0;
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
    },
  };
});

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
      value,
      onChange,
      onMount,
    }: {
      value: string;
      onChange: (value: string) => void;
      onMount?: (editor: unknown) => void;
    }) => {
      React.useEffect(() => {
        onMount?.(editorMock.value);
      }, [onMount]);

      return (
        <textarea
          aria-label="Result editor"
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
    acceptedRegionLabel: null,
    onChange: vi.fn(),
    onSave: vi.fn(),
    onAcceptCurrentRegion: vi.fn(),
    onAcceptIncomingRegion: vi.fn(),
    onRemoveAcceptedRegionSide: vi.fn(),
    onAcceptCurrentFile: vi.fn(),
    onAcceptIncomingFile: vi.fn(),
    onMarkResolved: vi.fn(),
    canAcceptRegion: true,
    canAcceptFile: true,
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
    fireEvent.click(
      screen.getByRole("button", { name: "Accept Current Region" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark Resolved" }));

    expect(props.onChange).toHaveBeenCalledWith("next");
    expect(props.onSave).toHaveBeenCalled();
    expect(props.onAcceptCurrentRegion).toHaveBeenCalled();
    expect(props.onMarkResolved).toHaveBeenCalled();
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

  it("shows a remove action for an accepted region side", () => {
    const props = renderEditor({
      acceptedRegionLabel: "Current",
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Current" }));

    expect(props.onRemoveAcceptedRegionSide).toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Accept Current Region" }),
    ).not.toBeInTheDocument();
  });

  it("shows a remove action for an accepted combination", () => {
    const props = renderEditor({
      acceptedRegionLabel: "Combination",
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Combination" }));

    expect(props.onRemoveAcceptedRegionSide).toHaveBeenCalled();
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
