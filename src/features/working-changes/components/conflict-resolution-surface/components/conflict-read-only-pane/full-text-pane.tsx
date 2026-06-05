import { useCallback, useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import { ConflictMonacoEditor } from "../conflict-monaco-editor";
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
}: {
  actionLabel: string;
  combinationActionLabel: string;
  lineNumber: number;
  monaco: MonacoApi;
  onAcceptCombination: () => void;
  onAcceptRegion: () => void;
  onIgnoreRegion: () => void;
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
  separator.textContent = "|";

  const combinationButton = document.createElement("button");
  combinationButton.type = "button";
  combinationButton.textContent = combinationActionLabel;
  combinationButton.addEventListener("click", (event) => {
    event.preventDefault();
    onAcceptCombination();
  });

  const secondSeparator = document.createElement("span");
  secondSeparator.textContent = "|";

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
    getId: () => CONFLICT_ACTION_WIDGET_ID,
    getDomNode: () => node,
    getPosition: () => ({
      position: { lineNumber, column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
    }),
  };
}

export function FullTextPane({
  title,
  text,
  language,
  regions,
  activeRegion,
  acceptedRegionLabel,
  actionLabel,
  combinationActionLabel,
  onAcceptRegion,
  onAcceptCombination,
  onIgnoreRegion,
  syncedScrollTop,
  onScrollTopChange,
}: ConflictTextPaneProps) {
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const scrollListenerRef = useRef<Monaco.IDisposable | null>(null);
  const syncingScrollRef = useRef(false);
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
    if (!editorSession || !activeRegion) return;

    editorSession.editor.revealLineInCenter(activeRegion.resultStartLine);
  }, [activeRegion, editorSession]);

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
    if (!editorSession || !activeRegion || acceptedRegionLabel) return;

    const { editor, monaco } = editorSession;
    const maxLine = editor.getModel()?.getLineCount() ?? 1;
    const lineNumber = clampLineNumber(activeRegion.resultStartLine, maxLine);
    const widget = createConflictActionWidget({
      actionLabel,
      combinationActionLabel,
      lineNumber,
      monaco,
      onAcceptCombination: () =>
        actionHandlersRef.current.onAcceptCombination(),
      onAcceptRegion: () => actionHandlersRef.current.onAcceptRegion(),
      onIgnoreRegion: () => actionHandlersRef.current.onIgnoreRegion(),
    });

    editor.addContentWidget(widget);

    return () => {
      editor.removeContentWidget(widget);
    };
  }, [
    acceptedRegionLabel,
    actionLabel,
    combinationActionLabel,
    activeRegion,
    editorSession,
  ]);

  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-border last:border-r-0">
      <div className="border-b border-border bg-background-emphasis px-3 py-1.5 text-xs font-semibold">
        {title}
      </div>
      <ConflictMonacoEditor
        ariaLabel={`${title} conflict editor`}
        className="min-h-0 flex-1"
        resetKey={`${title}:${language}`}
        fallbackMessage="Conflict editor failed to load. Restart the dev server or use the result editor."
        height="100%"
        language={language}
        theme="vs-dark"
        value={text}
        onMount={handleMount}
        options={{
          automaticLayout: true,
          domReadOnly: true,
          folding: false,
          fontFamily: "IBM Plex Mono",
          fontSize: 12,
          glyphMargin: false,
          lineDecorationsWidth: 8,
          lineHeight: 20,
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
