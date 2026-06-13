import { useCallback, useEffect, useId, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import ReactDOM from "react-dom";
import {
  IconDeviceFloppy,
  IconGitMerge,
  IconRefresh,
  IconX,
} from "@/shared/components/icons/icons";
import { GIT_CONFLICT_SIDE } from "@/shared/types/git-conflicts";
import {
  DEFAULT_MONACO_THEME,
  MONACO_EDITOR_FONT_FAMILY,
  MONACO_EDITOR_FONT_SIZE,
  MONACO_EDITOR_LINE_HEIGHT,
} from "@/shared/lib/monaco";
import {
  applySyncedScrollTop,
  shouldIgnoreSyncedScrollEvent,
} from "../../utils/conflict-scroll-sync";
import { getConflictPaneVisualIdentity } from "../../utils/conflict-visual-identity";
import { ConflictMonacoEditor } from "../conflict-monaco-editor";
import type { ConflictResultEditorProps } from "./types";

type ConflictEditor = Monaco.editor.IStandaloneCodeEditor;
type MonacoApi = typeof Monaco;
type ResultViewZoneIds = string[];
type AcceptedResultWidgets = Monaco.editor.IContentWidget[];
type EditorSession = {
  editor: ConflictEditor;
  monaco: MonacoApi;
};

function commandButtonClass(disabled = false) {
  return `inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-border px-3 text-xs font-medium transition-colors ${
    disabled
      ? "cursor-not-allowed text-zinc-600"
      : "text-zinc-200 hover:bg-background-emphasis"
  }`;
}

const RESULT_ACTION_TITLE = {
  MarkResolved: "Stage this file as resolved after the result contains no conflict markers.",
  Reset: "Reset this result to the initially loaded conflict projection.",
  Save: "Write the edited result content to disk.",
} as const;

const ACCEPTED_RESULT_DECORATION_CLASS = "gitano-conflict-result-line-accepted";
const ACCEPTED_RESULT_ACTION_ZONE_HEIGHT = 24;
const ACCEPTED_RESULT_WIDGET_ID = "gitano-conflict-result-accepted-widget";
const MIN_ACCEPTED_RESULT_ACTION_WIDGET_WIDTH = 240;

function clampLineNumber(lineNumber: number, maxLine: number) {
  return Math.max(1, Math.min(lineNumber, maxLine));
}

function clampZoneAfterLineNumber(lineNumber: number, maxLine: number) {
  return Math.max(0, Math.min(lineNumber, maxLine));
}

function createPaddingZoneNode() {
  const node = document.createElement("div");
  node.className = "gitano-conflict-result-padding-zone";
  return node;
}

function resultStatusMessageClass(
  blocked: boolean,
  aiResolutionStatus: ConflictResultEditorProps["aiResolutionStatus"],
) {
  if (blocked) {
    return "border-b border-amber-900/40 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200";
  }

  if (aiResolutionStatus === "error") {
    return "border-b border-red-900/40 bg-red-950/30 px-3 py-1.5 text-xs text-red-100";
  }

  return "border-b border-purple-900/40 bg-purple-950/30 px-3 py-1.5 text-xs text-purple-100";
}

function formatAiResolutionDetails(details: string) {
  return details
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+(?=conflict-\d+\s*:)/gi, "\n");
}

function capitalizeFirstLetter(text: string) {
  return text.replace(/^(\s*)([a-z])/, (_match, leading, letter: string) =>
    `${leading}${letter.toUpperCase()}`,
  );
}

function parseAiResolutionDetails(details: string) {
  return formatAiResolutionDetails(details)
    .split("\n")
    .map((line) => {
      const text = line.trim();
      const conflictMatch = /^(conflict-\d+)\s*:\s*(.*)$/i.exec(text);

      return {
        conflictId: conflictMatch?.[1] ?? null,
        text: capitalizeFirstLetter(conflictMatch?.[2] ?? text),
      };
    })
    .filter((line) => line.text.length > 0 || line.conflictId);
}

function AiResolutionDetailsModal({
  details,
  onClose,
  open,
  summary,
}: {
  details: string | null;
  onClose: () => void;
  open: boolean;
  summary: string | null;
}) {
  const titleId = useId();
  const detailLines = details ? parseAiResolutionDetails(details) : [];

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || detailLines.length === 0) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/65 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88vh] w-[min(720px,94vw)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div className="min-w-0">
            <div
              id={titleId}
              className="truncate text-sm font-semibold text-foreground"
            >
              AI resolution details
            </div>
            {summary ? (
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {summary}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
            aria-label="Close AI resolution details"
            onClick={onClose}
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3 text-sm text-zinc-200">
            {detailLines.map((line, index) =>
              line.conflictId ? (
                <div
                  key={`${line.conflictId}:${index}`}
                  className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-x-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <span className="pt-px font-mono text-xs leading-5 uppercase tracking-normal text-zinc-500">
                    {line.conflictId}
                  </span>
                  <span className="min-w-0 break-words leading-5 text-zinc-100">
                    {line.text}
                  </span>
                </div>
              ) : (
                <p
                  key={`detail:${index}`}
                  className="break-words leading-5 text-zinc-300"
                >
                  {line.text}
                </p>
              ),
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function createAcceptedResultActionZoneNode() {
  const node = document.createElement("div");
  node.className = "gitano-conflict-result-action-zone";
  return node;
}

function createAcceptedResultActionWidget({
  editor,
  label,
  lineNumber,
  onRemove,
  preference,
  positionAffinity,
  regionId,
}: {
  editor: ConflictEditor;
  label: string;
  lineNumber: number;
  onRemove: () => void;
  preference: Monaco.editor.ContentWidgetPositionPreference;
  positionAffinity: Monaco.editor.PositionAffinity;
  regionId: string;
}): Monaco.editor.IContentWidget {
  const node = document.createElement("div");
  node.className = "gitano-conflict-result-action-widget";
  node.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const separator = document.createElement("span");
  separator.textContent = " | ";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = `Remove ${label}`;
  removeButton.title = `Remove ${label} from the result.`;
  removeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  });

  node.append(labelNode, separator, removeButton);

  return {
    allowEditorOverflow: false,
    getId: () => `${ACCEPTED_RESULT_WIDGET_ID}:${regionId}`,
    getDomNode: () => node,
    getPosition: () => ({
      position: { lineNumber, column: 1 },
      preference: [preference],
      positionAffinity,
    }),
    beforeRender: () => {
      const { contentWidth } = editor.getLayoutInfo();
      const width = Math.max(
        contentWidth,
        node.scrollWidth,
        MIN_ACCEPTED_RESULT_ACTION_WIDGET_WIDTH,
      );

      node.style.marginLeft = "0px";
      node.style.width = `${width}px`;
      node.style.height = `${ACCEPTED_RESULT_ACTION_ZONE_HEIGHT}px`;

      return {
        width,
        height: ACCEPTED_RESULT_ACTION_ZONE_HEIGHT,
      };
    },
    suppressMouseDown: true,
  };
}

function createAcceptedResultActionZoneMarginNode() {
  const node = document.createElement("div");
  node.className = "gitano-conflict-result-action-zone-margin";
  return node;
}

function updateResultViewZones({
  acceptedRegions,
  editor,
  monaco,
  onRemoveAcceptedRegionSide,
  regions,
  widgets,
  zoneIds,
}: {
  acceptedRegions: ConflictResultEditorProps["acceptedRegions"];
  editor: ConflictEditor;
  monaco: MonacoApi;
  onRemoveAcceptedRegionSide: ConflictResultEditorProps["onRemoveAcceptedRegionSide"];
  regions: ConflictResultEditorProps["resultRegions"];
  widgets: { current: AcceptedResultWidgets };
  zoneIds: { current: ResultViewZoneIds };
}) {
  widgets.current.forEach((widget) => editor.removeContentWidget(widget));
  widgets.current = [];
  const nextWidgets: AcceptedResultWidgets = [];
  const maxLine = editor.getModel()?.getLineCount() ?? 1;
  const acceptedRegionsById = new Map(
    acceptedRegions.map((acceptedRegion) => [
      acceptedRegion.regionId,
      acceptedRegion,
    ]),
  );

  editor.changeViewZones((accessor) => {
    zoneIds.current.forEach((id) => accessor.removeZone(id));
    zoneIds.current = [];

    regions.forEach((region) => {
      const acceptedRegion = acceptedRegionsById.get(region.id);

      if (acceptedRegion) {
        const actionZoneAfterLineNumber = clampZoneAfterLineNumber(
          region.resultStartLine - 1,
          maxLine,
        );

        zoneIds.current.push(
          accessor.addZone({
            afterLineNumber: actionZoneAfterLineNumber,
            domNode: createAcceptedResultActionZoneNode(),
            heightInPx: ACCEPTED_RESULT_ACTION_ZONE_HEIGHT,
            marginDomNode: createAcceptedResultActionZoneMarginNode(),
          }),
        );
        nextWidgets.push(
          createAcceptedResultActionWidget({
            editor,
            label: acceptedRegion.label,
            lineNumber:
              actionZoneAfterLineNumber === 0
                ? 1
                : clampLineNumber(actionZoneAfterLineNumber, maxLine),
            onRemove: () => onRemoveAcceptedRegionSide(region.id),
            preference:
              actionZoneAfterLineNumber === 0
                ? monaco.editor.ContentWidgetPositionPreference.ABOVE
                : monaco.editor.ContentWidgetPositionPreference.BELOW,
            positionAffinity: monaco.editor.PositionAffinity.LeftOfInjectedText,
            regionId: region.id,
          }),
        );
      }

      if (region.paddingLineCount <= 0) return;

      zoneIds.current.push(
        accessor.addZone({
          afterLineNumber: region.resultEndLine,
          domNode: createPaddingZoneNode(),
          heightInLines: region.paddingLineCount,
        }),
      );
    });
  });

  nextWidgets.forEach((widget) => {
    editor.addContentWidget(widget);
    editor.layoutContentWidget(widget);
  });
  widgets.current = nextWidgets;
}

export function ConflictResultEditor({
  filePath,
  content,
  language,
  resultRegions,
  dirty,
  unsupportedReason,
  aiResolutionSummary,
  aiResolutionDetails,
  aiResolutionStatus,
  acceptedRegions,
  onChange,
  onSave,
  onRemoveAcceptedRegionSide,
  onResetResult,
  onMarkResolved,
  markResolvedBlockedReason,
  actionInFlight,
  syncedScrollTop,
  onScrollTopChange,
  onScrollPaneMount,
}: ConflictResultEditorProps) {
  const saveDisabled = actionInFlight || !dirty;
  const markResolvedDisabled = actionInFlight || Boolean(markResolvedBlockedReason);
  const [statusDismissed, setStatusDismissed] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const statusMessage =
    markResolvedBlockedReason ?? (statusDismissed ? null : aiResolutionSummary);
  const statusDetails =
    !markResolvedBlockedReason && aiResolutionStatus === "info"
      ? aiResolutionDetails
      : null;
  const statusMessageClass = resultStatusMessageClass(
    Boolean(markResolvedBlockedReason),
    aiResolutionStatus,
  );
  const statusDismissible = !markResolvedBlockedReason && Boolean(statusMessage);
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const resultViewZoneIdsRef = useRef<ResultViewZoneIds>([]);
  const acceptedResultWidgetsRef = useRef<AcceptedResultWidgets>([]);
  const acceptedDecorationIdsRef = useRef<string[]>([]);
  const scrollListenerRef = useRef<Monaco.IDisposable | null>(null);
  const pendingSyncedScrollTopRef = useRef<number | null>(null);
  const onScrollPaneMountRef = useRef(onScrollPaneMount);
  const onScrollTopChangeRef = useRef(onScrollTopChange);
  const visualIdentity = getConflictPaneVisualIdentity(GIT_CONFLICT_SIDE.Result);

  useEffect(() => {
    setStatusDismissed(false);
    setDetailsModalOpen(false);
  }, [aiResolutionStatus, aiResolutionSummary, aiResolutionDetails]);

  useEffect(() => {
    onScrollPaneMountRef.current = onScrollPaneMount;
  }, [onScrollPaneMount]);

  useEffect(() => {
    onScrollTopChangeRef.current = onScrollTopChange;
  }, [onScrollTopChange]);

  const handleMount = useCallback(
    (editor: ConflictEditor, monaco: MonacoApi) => {
      scrollListenerRef.current?.dispose();
      setEditorSession({ editor, monaco });
      scrollListenerRef.current = editor.onDidScrollChange((event) => {
        if (
          !shouldIgnoreSyncedScrollEvent(
            pendingSyncedScrollTopRef,
            event.scrollTop,
          )
        ) {
          onScrollTopChangeRef.current(event.scrollTop);
        }
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      scrollListenerRef.current?.dispose();
      const editor = editorSession?.editor;

      if (editor) {
        acceptedResultWidgetsRef.current.forEach((widget) =>
          editor.removeContentWidget(widget),
        );
        acceptedResultWidgetsRef.current = [];
        editor.changeViewZones((accessor) => {
          resultViewZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
          resultViewZoneIdsRef.current = [];
        });
        acceptedDecorationIdsRef.current = editor.deltaDecorations(
          acceptedDecorationIdsRef.current,
          [],
        );
      }
    };
  }, [editorSession]);

  useEffect(() => {
    if (!editorSession) return;

    updateResultViewZones({
      acceptedRegions,
      editor: editorSession.editor,
      monaco: editorSession.monaco,
      onRemoveAcceptedRegionSide,
      regions: resultRegions,
      widgets: acceptedResultWidgetsRef,
      zoneIds: resultViewZoneIdsRef,
    });
  }, [
    acceptedRegions,
    content,
    editorSession,
    onRemoveAcceptedRegionSide,
    resultRegions,
  ]);

  useEffect(() => {
    if (!editorSession) return;

    const { editor, monaco } = editorSession;
    const maxLine = editor.getModel()?.getLineCount() ?? 1;
    const decorations = acceptedRegions.flatMap((acceptedRegion) => {
      const acceptedResultRegion = resultRegions.find(
        (region) => region.id === acceptedRegion.regionId,
      );

      if (!acceptedResultRegion) return [];

      return [
        {
          range: new monaco.Range(
            clampLineNumber(acceptedResultRegion.resultStartLine, maxLine),
            1,
            clampLineNumber(acceptedResultRegion.resultEndLine, maxLine),
            1,
          ),
          options: {
            className: ACCEPTED_RESULT_DECORATION_CLASS,
            isWholeLine: true,
          },
        },
      ];
    });

    if (decorations.length === 0) {
      acceptedDecorationIdsRef.current = editor.deltaDecorations(
        acceptedDecorationIdsRef.current,
        [],
      );
      return;
    }

    acceptedDecorationIdsRef.current = editor.deltaDecorations(
      acceptedDecorationIdsRef.current,
      decorations,
    );
  }, [acceptedRegions, editorSession, resultRegions]);

  useEffect(() => {
    const editor = editorSession?.editor;
    if (!editor || syncedScrollTop === null) return;

    applySyncedScrollTop({
      currentScrollTop: editor.getScrollTop(),
      pendingSyncedScrollTopRef,
      scrollTop: syncedScrollTop,
      setScrollTop: (scrollTop) => editor.setScrollTop(scrollTop),
    });
  }, [editorSession, syncedScrollTop]);

  useEffect(() => {
    const editor = editorSession?.editor;
    if (!editor || !onScrollPaneMountRef.current) return;

    onScrollPaneMountRef.current({
      setScrollTop: (scrollTop) => {
        applySyncedScrollTop({
          currentScrollTop: editor.getScrollTop(),
          pendingSyncedScrollTopRef,
          scrollTop,
          setScrollTop: (nextScrollTop) => editor.setScrollTop(nextScrollTop),
        });
      },
    });

    return () => onScrollPaneMountRef.current?.(null);
  }, [editorSession]);

  return (
    <section
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-border bg-background"
      data-conflict-side={GIT_CONFLICT_SIDE.Result}
      style={visualIdentity.style}
    >
      <div
        className="gitano-conflict-pane-header flex min-h-12 min-w-0 items-center gap-3 overflow-x-auto border-b border-border bg-background-emphasis px-3"
        data-conflict-pane-header="true"
      >
        <span
          className="gitano-conflict-pane-accent h-3 w-1 shrink-0 rounded-sm"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="gitano-conflict-pane-title text-xs font-semibold">
            Result
          </div>
          <div className="truncate text-[11px] text-zinc-500">{filePath}</div>
        </div>
        <button
          type="button"
          className={commandButtonClass(saveDisabled)}
          disabled={saveDisabled}
          onClick={onSave}
          title={RESULT_ACTION_TITLE.Save}
        >
          <IconDeviceFloppy size={14} />
          Save
        </button>
        <button
          type="button"
          className={commandButtonClass(actionInFlight)}
          disabled={actionInFlight}
          onClick={onResetResult}
          title={RESULT_ACTION_TITLE.Reset}
        >
          <IconRefresh size={14} />
          Reset Conflict
        </button>
        <button
          type="button"
          className={commandButtonClass(markResolvedDisabled)}
          disabled={markResolvedDisabled}
          onClick={onMarkResolved}
          title={markResolvedBlockedReason ?? RESULT_ACTION_TITLE.MarkResolved}
        >
          <IconGitMerge size={14} />
          Mark Resolved
        </button>
      </div>
      {statusMessage ? (
        <div className={statusMessageClass}>
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <span>{statusMessage}</span>
                {statusDetails ? (
                  <button
                    type="button"
                    className="font-semibold underline-offset-2 hover:underline"
                    onClick={() => setDetailsModalOpen(true)}
                  >
                    View details
                  </button>
                ) : null}
              </div>
            </div>
            {statusDismissible ? (
              <button
                type="button"
                className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-current/70 transition-colors hover:bg-white/10 hover:text-current"
                aria-label="Dismiss AI resolution message"
                onClick={() => {
                  setStatusDismissed(true);
                  setDetailsModalOpen(false);
                }}
              >
                <IconX size={13} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <AiResolutionDetailsModal
        details={statusDetails}
        onClose={() => setDetailsModalOpen(false)}
        open={detailsModalOpen}
        summary={statusMessage}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {unsupportedReason ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {unsupportedReason}
          </div>
        ) : (
          <ConflictMonacoEditor
            ariaLabel="Result editor"
            className="h-full min-w-0 overflow-hidden"
            resetKey={`${filePath}:${language}`}
            fallbackMessage={
              "Result editor failed to load. Restart the dev server or resolve this file in an external editor."
            }
            height="100%"
            language={language}
            theme={DEFAULT_MONACO_THEME}
            value={content}
            onChange={(value) => onChange(value ?? "")}
            onMount={handleMount}
            options={{
              automaticLayout: true,
              fontFamily: MONACO_EDITOR_FONT_FAMILY,
              fontSize: MONACO_EDITOR_FONT_SIZE,
              lineDecorationsWidth: 8,
              lineHeight: MONACO_EDITOR_LINE_HEIGHT,
              lineNumbersMinChars: 4,
              minimap: { enabled: false },
              scrollbar: {
                horizontalScrollbarSize: 10,
                verticalScrollbarSize: 10,
              },
              scrollBeyondLastLine: false,
              wordWrap: "off",
            }}
          />
        )}
      </div>
    </section>
  );
}
