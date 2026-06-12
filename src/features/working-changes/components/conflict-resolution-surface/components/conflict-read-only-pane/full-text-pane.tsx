import { useCallback, useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
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
import { ConflictPaneHeader } from "./conflict-pane-header";
import type { ConflictTextPaneProps } from "./types";

const CONFLICT_DECORATION_CLASS = "gitano-conflict-side-line";
const ACTIVE_CONFLICT_DECORATION_CLASS = "gitano-conflict-side-line-active";
const CONFLICT_ACTION_ZONE_HEIGHT = 24;
const CONFLICT_ACTION_WIDGET_ID = "gitano-conflict-side-action-widget";
const MIN_CONFLICT_ACTION_WIDGET_WIDTH = 420;

type ConflictEditor = Monaco.editor.IStandaloneCodeEditor;
type MonacoApi = typeof Monaco;
type ViewZoneIds = string[];
type ContentWidgets = Monaco.editor.IContentWidget[];
type EditorSession = {
  editor: ConflictEditor;
  monaco: MonacoApi;
};

function clampLineNumber(lineNumber: number, maxLine: number) {
  return Math.max(1, Math.min(lineNumber, maxLine));
}

function clampZoneAfterLineNumber(lineNumber: number, maxLine: number) {
  return Math.max(0, Math.min(lineNumber, maxLine));
}

function createConflictActionNode({
  actionLabel,
  combinationActionLabel,
  onAcceptCombination,
  onAcceptRegion,
  onIgnoreRegion,
}: {
  actionLabel: string;
  combinationActionLabel: string;
  onAcceptCombination: () => void;
  onAcceptRegion: () => void;
  onIgnoreRegion: () => void;
}) {
  const node = document.createElement("div");
  node.className = "gitano-conflict-action-widget";

  node.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  const acceptButton = document.createElement("button");
  acceptButton.type = "button";
  acceptButton.textContent = actionLabel;
  acceptButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onAcceptRegion();
  });

  const separator = document.createElement("span");
  separator.textContent = " | ";
  separator.setAttribute("aria-hidden", "true");

  const combinationButton = document.createElement("button");
  combinationButton.type = "button";
  combinationButton.textContent = combinationActionLabel;
  combinationButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onAcceptCombination();
  });

  const secondSeparator = document.createElement("span");
  secondSeparator.textContent = " | ";
  secondSeparator.setAttribute("aria-hidden", "true");

  const ignoreButton = document.createElement("button");
  ignoreButton.type = "button";
  ignoreButton.textContent = "Ignore";
  ignoreButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onIgnoreRegion();
  });

  node.append(
    acceptButton,
    separator,
    combinationButton,
    secondSeparator,
    ignoreButton,
  );

  return node;
}

function createConflictActionZoneNode(hidden: boolean) {
  const node = document.createElement("div");
  node.className = "gitano-conflict-action-zone";

  if (hidden) {
    node.classList.add("gitano-conflict-action-zone-spacer");
    node.setAttribute("aria-hidden", "true");
  }

  return node;
}

function createConflictActionZoneMarginNode(hidden: boolean) {
  const node = document.createElement("div");
  node.className = "gitano-conflict-action-zone-margin";

  if (hidden) {
    node.classList.add("gitano-conflict-action-zone-spacer");
    node.setAttribute("aria-hidden", "true");
  }

  return node;
}

function createConflictActionWidget({
  actionLabel,
  combinationActionLabel,
  editor,
  lineNumber,
  onAcceptCombination,
  onAcceptRegion,
  onIgnoreRegion,
  preference,
  positionAffinity,
  regionId,
}: {
  actionLabel: string;
  combinationActionLabel: string;
  editor: ConflictEditor;
  lineNumber: number;
  onAcceptCombination: () => void;
  onAcceptRegion: () => void;
  onIgnoreRegion: () => void;
  preference: Monaco.editor.ContentWidgetPositionPreference;
  positionAffinity: Monaco.editor.PositionAffinity;
  regionId: string;
}): Monaco.editor.IContentWidget {
  const node = createConflictActionNode({
    actionLabel,
    combinationActionLabel,
    onAcceptCombination,
    onAcceptRegion,
    onIgnoreRegion,
  });

  return {
    allowEditorOverflow: false,
    getId: () => `${CONFLICT_ACTION_WIDGET_ID}:${regionId}`,
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
        MIN_CONFLICT_ACTION_WIDGET_WIDTH,
      );

      node.style.marginLeft = "0px";
      node.style.width = `${width}px`;
      node.style.height = `${CONFLICT_ACTION_ZONE_HEIGHT}px`;

      return {
        width,
        height: CONFLICT_ACTION_ZONE_HEIGHT,
      };
    },
    suppressMouseDown: true,
  };
}

function createAlignmentZoneNode() {
  const node = document.createElement("div");
  node.className = "gitano-conflict-side-alignment-zone";
  return node;
}

function updateViewZones({
  acceptedRegionSidesById,
  actionLabel,
  actionHandlers,
  combinationActionLabel,
  editor,
  monaco,
  regions,
  side,
  widgets,
  zoneIds,
}: {
  acceptedRegionSidesById: ConflictTextPaneProps["acceptedRegionSidesById"];
  actionLabel: string;
  actionHandlers: {
    onAcceptCombination: (regionId: string) => void;
    onAcceptRegion: (regionId: string) => void;
    onIgnoreRegion: (regionId: string) => void;
  };
  combinationActionLabel: string;
  editor: ConflictEditor;
  monaco: MonacoApi;
  regions: ConflictTextPaneProps["regions"];
  side: ConflictTextPaneProps["side"];
  widgets: { current: ContentWidgets };
  zoneIds: { current: ViewZoneIds };
}) {
  const maxLine = editor.getModel()?.getLineCount() ?? 1;

  widgets.current.forEach((widget) => editor.removeContentWidget(widget));
  widgets.current = [];
  const nextWidgets: ContentWidgets = [];

  editor.changeViewZones((accessor) => {
    zoneIds.current.forEach((id) => accessor.removeZone(id));
    zoneIds.current = [];

    regions.forEach((region) => {
      const actionsHidden = acceptedRegionSidesById[region.id] === side;
      const actionZoneAfterLineNumber = clampZoneAfterLineNumber(
        region.resultStartLine - 1,
        maxLine,
      );

      zoneIds.current.push(
        accessor.addZone({
          afterLineNumber: actionZoneAfterLineNumber,
          domNode: createConflictActionZoneNode(actionsHidden),
          heightInPx: CONFLICT_ACTION_ZONE_HEIGHT,
          marginDomNode: createConflictActionZoneMarginNode(actionsHidden),
        }),
      );

      if (!actionsHidden) {
        nextWidgets.push(
          createConflictActionWidget({
            actionLabel,
            combinationActionLabel,
            editor,
            lineNumber:
              actionZoneAfterLineNumber === 0
                ? 1
                : clampLineNumber(actionZoneAfterLineNumber, maxLine),
            onAcceptCombination: () =>
              actionHandlers.onAcceptCombination(region.id),
            onAcceptRegion: () => actionHandlers.onAcceptRegion(region.id),
            onIgnoreRegion: () => actionHandlers.onIgnoreRegion(region.id),
            preference:
              actionZoneAfterLineNumber === 0
                ? monaco.editor.ContentWidgetPositionPreference.ABOVE
                : monaco.editor.ContentWidgetPositionPreference.BELOW,
            positionAffinity: monaco.editor.PositionAffinity.LeftOfInjectedText,
            regionId: region.id,
          }),
        );
      }

      const alignmentLineCount = region.alignmentLineCount ?? 0;
      if (alignmentLineCount <= 0) return;

      zoneIds.current.push(
        accessor.addZone({
          afterLineNumber: clampLineNumber(region.resultEndLine, maxLine),
          domNode: createAlignmentZoneNode(),
          heightInLines: alignmentLineCount,
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
  onScrollPaneMount,
}: ConflictTextPaneProps) {
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const contentWidgetsRef = useRef<ContentWidgets>([]);
  const viewZoneIdsRef = useRef<ViewZoneIds>([]);
  const scrollListenerRef = useRef<Monaco.IDisposable | null>(null);
  const pendingSyncedScrollTopRef = useRef<number | null>(null);
  const revealedRegionKeyRef = useRef<string | null>(null);
  const visualIdentity = getConflictPaneVisualIdentity(side);
  const actionHandlersRef = useRef({
    onAcceptCombination,
    onAcceptRegion,
    onIgnoreRegion,
  });
  const onScrollPaneMountRef = useRef(onScrollPaneMount);
  const onScrollTopChangeRef = useRef(onScrollTopChange);

  useEffect(() => {
    actionHandlersRef.current = {
      onAcceptCombination,
      onAcceptRegion,
      onIgnoreRegion,
    };
  }, [onAcceptCombination, onAcceptRegion, onIgnoreRegion]);

  useEffect(() => {
    onScrollPaneMountRef.current = onScrollPaneMount;
  }, [onScrollPaneMount]);

  useEffect(() => {
    onScrollTopChangeRef.current = onScrollTopChange;
  }, [onScrollTopChange]);

  const handleMount = useCallback(
    (editor: ConflictEditor, monaco: MonacoApi) => {
      scrollListenerRef.current?.dispose();
      revealedRegionKeyRef.current = null;
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
      onScrollPaneMountRef.current?.({
        setScrollTop: (scrollTop) => {
          applySyncedScrollTop({
            currentScrollTop: editor.getScrollTop(),
            pendingSyncedScrollTopRef,
            scrollTop,
            setScrollTop: (nextScrollTop) =>
              editor.setScrollTop(nextScrollTop),
          });
        },
      });
      setEditorSession({ editor, monaco });
    },
    [],
  );

  useEffect(() => {
    if (!editorSession) return;

    return () => {
      scrollListenerRef.current?.dispose();
      const { editor } = editorSession;

      contentWidgetsRef.current.forEach((widget) =>
        editor.removeContentWidget(widget),
      );
      contentWidgetsRef.current = [];
      editor.changeViewZones((accessor) => {
        viewZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
        viewZoneIdsRef.current = [];
      });
      onScrollPaneMountRef.current?.(null);
    };
  }, [editorSession]);

  useEffect(() => {
    if (!editorSession || syncedScrollTop === null) return;

    applySyncedScrollTop({
      currentScrollTop: editorSession.editor.getScrollTop(),
      pendingSyncedScrollTopRef,
      scrollTop: syncedScrollTop,
      setScrollTop: (scrollTop) => editorSession.editor.setScrollTop(scrollTop),
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
              ? visualIdentity.overviewRulerActiveColor
              : visualIdentity.overviewRulerColor,
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
  }, [activeRegion, editorSession, regions, visualIdentity]);

  useEffect(() => {
    if (!editorSession) return;

    updateViewZones({
      acceptedRegionSidesById,
      actionLabel,
      actionHandlers: actionHandlersRef.current,
      combinationActionLabel,
      editor: editorSession.editor,
      monaco: editorSession.monaco,
      regions,
      side,
      widgets: contentWidgetsRef,
      zoneIds: viewZoneIdsRef,
    });
    return () => {
      contentWidgetsRef.current.forEach((widget) =>
        editorSession.editor.removeContentWidget(widget),
      );
      contentWidgetsRef.current = [];
      editorSession.editor.changeViewZones((accessor) => {
        viewZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
        viewZoneIdsRef.current = [];
      });
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
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border last:border-r-0"
      data-conflict-side={side}
      style={visualIdentity.style}
    >
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
