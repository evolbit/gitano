import { useCallback, useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import {
  DEFAULT_MONACO_THEME,
  MONACO_EDITOR_FONT_FAMILY,
  MONACO_EDITOR_FONT_SIZE,
  MONACO_EDITOR_LINE_HEIGHT,
} from "@/shared/lib/monaco";
import { ConflictMonacoEditor } from "../conflict-monaco-editor";
import { ConflictPaneHeader } from "./conflict-pane-header";
import type { ConflictTextPaneProps } from "./types";

const CONFLICT_DECORATION_CLASS = "gitano-conflict-side-line";
const ACTIVE_CONFLICT_DECORATION_CLASS = "gitano-conflict-side-line-active";
const CONFLICT_ACTION_WIDGET_ID = "gitano-conflict-side-action-widget";

type ConflictEditor = Monaco.editor.IStandaloneCodeEditor;
type MonacoApi = typeof Monaco;
type EditorSession = {
  editor: ConflictEditor;
  monaco: MonacoApi;
};

function clampLineNumber(lineNumber: number, maxLine: number) {
  return Math.max(1, Math.min(lineNumber, maxLine));
}

function createConflictActionWidget({
  actionLabel,
  combinationActionLabel,
  lineNumber,
  monaco,
  onAcceptCombination,
  onAcceptRegion,
  onIgnoreRegion,
  regionId,
}: {
  actionLabel: string;
  combinationActionLabel: string;
  lineNumber: number;
  monaco: MonacoApi;
  onAcceptCombination: () => void;
  onAcceptRegion: () => void;
  onIgnoreRegion: () => void;
  regionId: string;
}): Monaco.editor.IContentWidget {
  const node = document.createElement("div");
  node.className = "gitano-conflict-action-widget";

  const acceptButton = document.createElement("button");
  acceptButton.type = "button";
  acceptButton.textContent = actionLabel;
  acceptButton.addEventListener("click", (event) => {
    event.preventDefault();
    onAcceptRegion();
  });

  const separator = document.createElement("span");
  separator.textContent = " | ";

  const combinationButton = document.createElement("button");
  combinationButton.type = "button";
  combinationButton.textContent = combinationActionLabel;
  combinationButton.addEventListener("click", (event) => {
    event.preventDefault();
    onAcceptCombination();
  });

  const secondSeparator = document.createElement("span");
  secondSeparator.textContent = " | ";

  const ignoreButton = document.createElement("button");
  ignoreButton.type = "button";
  ignoreButton.textContent = "Ignore";
  ignoreButton.addEventListener("click", (event) => {
    event.preventDefault();
    onIgnoreRegion();
  });

  node.append(
    acceptButton,
    separator,
    combinationButton,
    secondSeparator,
    ignoreButton,
  );

  return {
    getId: () => `${CONFLICT_ACTION_WIDGET_ID}:${regionId}`,
    getDomNode: () => node,
    getPosition: () => ({
      position: { lineNumber, column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
    }),
  };
}

export function FullTextPane({
  title,
  side,
  text,
  language,
  regions,
  activeRegion,
  acceptedRegionSidesById,
  actionLabel,
  combinationActionLabel,
  fileActionLabel,
  fileActionTitle,
  fileActionDisabled,
  onAcceptRegion,
  onAcceptCombination,
  onAcceptFile,
  onIgnoreRegion,
  syncedScrollTop,
  onScrollTopChange,
}: ConflictTextPaneProps) {
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const scrollListenerRef = useRef<Monaco.IDisposable | null>(null);
  const syncingScrollRef = useRef(false);
  const revealedRegionKeyRef = useRef<string | null>(null);
  const actionHandlersRef = useRef({
    onAcceptCombination,
    onAcceptRegion,
    onIgnoreRegion,
  });

  useEffect(() => {
    actionHandlersRef.current = {
      onAcceptCombination,
      onAcceptRegion,
      onIgnoreRegion,
    };
  }, [onAcceptCombination, onAcceptRegion, onIgnoreRegion]);

  const handleMount = useCallback(
    (editor: ConflictEditor, monaco: MonacoApi) => {
      scrollListenerRef.current?.dispose();
      revealedRegionKeyRef.current = null;
      scrollListenerRef.current = editor.onDidScrollChange((event) => {
        if (!syncingScrollRef.current) {
          onScrollTopChange(event.scrollTop);
        }
      });
      setEditorSession({ editor, monaco });
    },
    [onScrollTopChange],
  );

  useEffect(() => {
    return () => {
      scrollListenerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!editorSession || syncedScrollTop === null) return;

    const { editor } = editorSession;
    if (Math.abs(editor.getScrollTop() - syncedScrollTop) < 1) return;

    syncingScrollRef.current = true;
    editor.setScrollTop(syncedScrollTop);
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [editorSession, syncedScrollTop]);

  useEffect(() => {
    if (!editorSession || !activeRegion) {
      revealedRegionKeyRef.current = null;
      return;
    }

    const regionKey = `${activeRegion.id}:${activeRegion.resultStartLine}`;
    if (revealedRegionKeyRef.current === regionKey) return;

    revealedRegionKeyRef.current = regionKey;
    editorSession.editor.revealLineInCenter(activeRegion.resultStartLine);
  }, [activeRegion?.id, activeRegion?.resultStartLine, editorSession]);

  useEffect(() => {
    if (!editorSession) return;

    const { editor, monaco } = editorSession;
    const maxLine = editor.getModel()?.getLineCount() ?? 1;
    const decorations = regions.map((region) => {
      const active = activeRegion?.id === region.id;

      return {
        range: new monaco.Range(
          clampLineNumber(region.resultStartLine, maxLine),
          1,
          clampLineNumber(region.resultEndLine, maxLine),
          1,
        ),
        options: {
          className: active
            ? ACTIVE_CONFLICT_DECORATION_CLASS
            : CONFLICT_DECORATION_CLASS,
          isWholeLine: true,
          overviewRuler: {
            color: active
              ? "rgba(245, 158, 11, 0.85)"
              : "rgba(245, 158, 11, 0.45)",
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      };
    });

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      decorations,
    );

    return () => {
      decorationIdsRef.current = editor.deltaDecorations(
        decorationIdsRef.current,
        [],
      );
    };
  }, [activeRegion, editorSession, regions]);

  useEffect(() => {
    if (!editorSession) return;

    const { editor, monaco } = editorSession;
    const maxLine = editor.getModel()?.getLineCount() ?? 1;
    const widgets = regions
      .filter(
        (region) =>
          acceptedRegionSidesById[region.id] !== side,
      )
      .map((region) =>
        createConflictActionWidget({
          actionLabel,
          combinationActionLabel,
          lineNumber: clampLineNumber(region.resultStartLine, maxLine),
          monaco,
          regionId: region.id,
          onAcceptCombination: () =>
            actionHandlersRef.current.onAcceptCombination(region.id),
          onAcceptRegion: () =>
            actionHandlersRef.current.onAcceptRegion(region.id),
          onIgnoreRegion: () =>
            actionHandlersRef.current.onIgnoreRegion(region.id),
        }),
      );

    widgets.forEach((widget) => editor.addContentWidget(widget));

    return () => {
      widgets.forEach((widget) => editor.removeContentWidget(widget));
    };
  }, [
    acceptedRegionSidesById,
    actionLabel,
    combinationActionLabel,
    editorSession,
    regions,
    side,
  ]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border last:border-r-0">
      <ConflictPaneHeader
        title={title}
        fileActionLabel={fileActionLabel}
        fileActionTitle={fileActionTitle}
        fileActionDisabled={fileActionDisabled}
        onAcceptFile={onAcceptFile}
      />
      <ConflictMonacoEditor
        ariaLabel={`${title} conflict editor`}
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        resetKey={`${title}:${language}`}
        fallbackMessage="Conflict editor failed to load. Restart the dev server or use the result editor."
        height="100%"
        language={language}
        theme={DEFAULT_MONACO_THEME}
        value={text}
        onMount={handleMount}
        options={{
          automaticLayout: true,
          domReadOnly: true,
          folding: false,
          fontFamily: MONACO_EDITOR_FONT_FAMILY,
          fontSize: MONACO_EDITOR_FONT_SIZE,
          glyphMargin: false,
          lineDecorationsWidth: 8,
          lineHeight: MONACO_EDITOR_LINE_HEIGHT,
          lineNumbersMinChars: 4,
          minimap: { enabled: false },
          overviewRulerBorder: false,
          readOnly: true,
          renderLineHighlight: "none",
          renderValidationDecorations: "off",
          scrollBeyondLastLine: false,
          scrollbar: {
            horizontalScrollbarSize: 10,
            verticalScrollbarSize: 10,
          },
          wordWrap: "off",
        }}
      />
    </section>
  );
}
