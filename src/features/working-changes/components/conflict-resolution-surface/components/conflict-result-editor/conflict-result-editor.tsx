import { useCallback, useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import {
  IconDeviceFloppy,
  IconGitMerge,
  IconRefresh,
} from "@/shared/components/icons/icons";
import {
  DEFAULT_MONACO_THEME,
  MONACO_EDITOR_FONT_FAMILY,
  MONACO_EDITOR_FONT_SIZE,
  MONACO_EDITOR_LINE_HEIGHT,
} from "@/shared/lib/monaco";
import { ConflictMonacoEditor } from "../conflict-monaco-editor";
import type { ConflictResultEditorProps } from "./types";

type ConflictEditor = Monaco.editor.IStandaloneCodeEditor;
type MonacoApi = typeof Monaco;
type PaddingZoneIds = string[];
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

const ACCEPTED_RESULT_WIDGET_ID = "gitano-conflict-result-accepted-widget";
const ACCEPTED_RESULT_DECORATION_CLASS = "gitano-conflict-result-line-accepted";

function clampLineNumber(lineNumber: number, maxLine: number) {
  return Math.max(1, Math.min(lineNumber, maxLine));
}

function createPaddingZoneNode() {
  const node = document.createElement("div");
  node.className = "gitano-conflict-result-padding-zone";
  return node;
}

function createAcceptedResultWidget({
  label,
  lineNumber,
  monaco,
  onRemove,
  regionId,
}: {
  label: string;
  lineNumber: number;
  monaco: MonacoApi;
  onRemove: () => void;
  regionId: string;
}): Monaco.editor.IContentWidget {
  const node = document.createElement("div");
  node.className = "gitano-conflict-result-action-widget";

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const separator = document.createElement("span");
  separator.textContent = "|";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = `Remove ${label}`;
  removeButton.title = `Remove ${label} from the result.`;
  removeButton.addEventListener("click", (event) => {
    event.preventDefault();
    onRemove();
  });

  node.append(labelNode, separator, removeButton);

  return {
    getId: () => `${ACCEPTED_RESULT_WIDGET_ID}:${regionId}`,
    getDomNode: () => node,
    getPosition: () => ({
      position: { lineNumber, column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
    }),
  };
}

function updatePaddingZones({
  editor,
  regions,
  zoneIds,
}: {
  editor: ConflictEditor;
  regions: ConflictResultEditorProps["resultRegions"];
  zoneIds: { current: PaddingZoneIds };
}) {
  editor.changeViewZones((accessor) => {
    zoneIds.current.forEach((id) => accessor.removeZone(id));
    zoneIds.current = [];

    regions.forEach((region) => {
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
}

export function ConflictResultEditor({
  filePath,
  content,
  language,
  resultRegions,
  dirty,
  unsupportedReason,
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
}: ConflictResultEditorProps) {
  const saveDisabled = actionInFlight || !dirty;
  const markResolvedDisabled = actionInFlight || Boolean(markResolvedBlockedReason);
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const paddingZoneIdsRef = useRef<PaddingZoneIds>([]);
  const acceptedDecorationIdsRef = useRef<string[]>([]);
  const scrollListenerRef = useRef<Monaco.IDisposable | null>(null);
  const syncingScrollRef = useRef(false);

  const handleMount = useCallback(
    (editor: ConflictEditor, monaco: MonacoApi) => {
      scrollListenerRef.current?.dispose();
      setEditorSession({ editor, monaco });
      updatePaddingZones({
        editor,
        regions: resultRegions,
        zoneIds: paddingZoneIdsRef,
      });
      scrollListenerRef.current = editor.onDidScrollChange((event) => {
        if (!syncingScrollRef.current) {
          onScrollTopChange(event.scrollTop);
        }
      });
    },
    [onScrollTopChange, resultRegions],
  );

  useEffect(() => {
    return () => {
      scrollListenerRef.current?.dispose();
      const editor = editorSession?.editor;

      if (editor) {
        editor.changeViewZones((accessor) => {
          paddingZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
          paddingZoneIdsRef.current = [];
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

    updatePaddingZones({
      editor: editorSession.editor,
      regions: resultRegions,
      zoneIds: paddingZoneIdsRef,
    });
  }, [content, editorSession, resultRegions]);

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
    if (!editorSession || acceptedRegions.length === 0) return;

    const widgets = acceptedRegions.flatMap((acceptedRegion) => {
      const acceptedResultRegion = resultRegions.find(
        (region) => region.id === acceptedRegion.regionId,
      );

      if (!acceptedResultRegion) return [];

      const { monaco } = editorSession;
      const maxLine = editorSession.editor.getModel()?.getLineCount() ?? 1;

      return [
        createAcceptedResultWidget({
          label: acceptedRegion.label,
          lineNumber: clampLineNumber(
            acceptedResultRegion.resultStartLine,
            maxLine,
          ),
          monaco,
          regionId: acceptedRegion.regionId,
          onRemove: () =>
            onRemoveAcceptedRegionSide(acceptedRegion.regionId),
        }),
      ];
    });

    widgets.forEach((widget) => editorSession.editor.addContentWidget(widget));

    return () => {
      widgets.forEach((widget) =>
        editorSession.editor.removeContentWidget(widget),
      );
    };
  }, [
    acceptedRegions,
    editorSession,
    onRemoveAcceptedRegionSide,
    resultRegions,
  ]);

  useEffect(() => {
    const editor = editorSession?.editor;
    if (!editor || syncedScrollTop === null) return;
    if (Math.abs(editor.getScrollTop() - syncedScrollTop) < 1) return;

    syncingScrollRef.current = true;
    editor.setScrollTop(syncedScrollTop);
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [editorSession, syncedScrollTop]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-border bg-background">
      <div className="flex min-h-12 min-w-0 items-center gap-3 overflow-x-auto border-b border-border bg-background-emphasis px-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">Result</div>
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
      {markResolvedBlockedReason ? (
        <div className="border-b border-amber-900/40 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200">
          {markResolvedBlockedReason}
        </div>
      ) : null}
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
