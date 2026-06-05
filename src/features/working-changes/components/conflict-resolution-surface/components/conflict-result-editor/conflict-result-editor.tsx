import { useCallback, useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import {
  IconDeviceFloppy,
  IconGitMerge,
} from "@/shared/components/icons/icons";
import { ConflictMonacoEditor } from "../conflict-monaco-editor";
import type { ConflictResultEditorProps } from "./types";

type ConflictEditor = Monaco.editor.IStandaloneCodeEditor;
type PaddingZoneIds = string[];

function commandButtonClass(disabled = false) {
  return `inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-border px-3 text-xs font-medium transition-colors ${
    disabled
      ? "cursor-not-allowed text-zinc-600"
      : "text-zinc-200 hover:bg-background-emphasis"
  }`;
}

const RESULT_ACTION_TITLE = {
  AcceptCurrentFile: "Replace the entire result file with the current side.",
  AcceptCurrentRegion: "Replace only the active conflict region with the current side.",
  AcceptIncomingFile: "Replace the entire result file with the incoming side.",
  AcceptIncomingRegion: "Replace only the active conflict region with the incoming side.",
  MarkResolved: "Stage this file as resolved after the result contains no conflict markers.",
  Save: "Write the edited result content to disk.",
} as const;

function createPaddingZoneNode() {
  const node = document.createElement("div");
  node.className = "gitano-conflict-result-padding-zone";
  return node;
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
  acceptedRegionLabel,
  onChange,
  onSave,
  onAcceptCurrentRegion,
  onAcceptIncomingRegion,
  onRemoveAcceptedRegionSide,
  onAcceptCurrentFile,
  onAcceptIncomingFile,
  onMarkResolved,
  canAcceptRegion,
  canAcceptFile,
  markResolvedBlockedReason,
  actionInFlight,
  syncedScrollTop,
  onScrollTopChange,
}: ConflictResultEditorProps) {
  const saveDisabled = actionInFlight || !dirty;
  const regionDisabled = actionInFlight || !canAcceptRegion;
  const fileDisabled = actionInFlight || !canAcceptFile;
  const markResolvedDisabled = actionInFlight || Boolean(markResolvedBlockedReason);
  const editorRef = useRef<ConflictEditor | null>(null);
  const paddingZoneIdsRef = useRef<PaddingZoneIds>([]);
  const scrollListenerRef = useRef<Monaco.IDisposable | null>(null);
  const syncingScrollRef = useRef(false);

  const handleMount = useCallback(
    (editor: ConflictEditor) => {
      scrollListenerRef.current?.dispose();
      editorRef.current = editor;
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
      const editor = editorRef.current;

      if (editor) {
        editor.changeViewZones((accessor) => {
          paddingZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
          paddingZoneIdsRef.current = [];
        });
      }
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    updatePaddingZones({
      editor,
      regions: resultRegions,
      zoneIds: paddingZoneIdsRef,
    });
  }, [content, resultRegions]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || syncedScrollTop === null) return;
    if (Math.abs(editor.getScrollTop() - syncedScrollTop) < 1) return;

    syncingScrollRef.current = true;
    editor.setScrollTop(syncedScrollTop);
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [syncedScrollTop]);

  return (
    <section className="flex min-h-0 flex-col border-t border-border bg-background">
      <div className="flex min-h-12 items-center gap-3 overflow-x-auto border-b border-border bg-background-emphasis px-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">Result</div>
          <div className="truncate text-[11px] text-zinc-500">{filePath}</div>
        </div>
        {acceptedRegionLabel ? (
          <button
            type="button"
            className={commandButtonClass(actionInFlight)}
            disabled={actionInFlight}
            onClick={onRemoveAcceptedRegionSide}
            title={`Undo the accepted ${acceptedRegionLabel.toLowerCase()} for this region.`}
          >
            Remove {acceptedRegionLabel}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={commandButtonClass(regionDisabled)}
              disabled={regionDisabled}
              onClick={onAcceptCurrentRegion}
              title={RESULT_ACTION_TITLE.AcceptCurrentRegion}
            >
              Accept Current Region
            </button>
            <button
              type="button"
              className={commandButtonClass(regionDisabled)}
              disabled={regionDisabled}
              onClick={onAcceptIncomingRegion}
              title={RESULT_ACTION_TITLE.AcceptIncomingRegion}
            >
              Accept Incoming Region
            </button>
          </>
        )}
        <button
          type="button"
          className={commandButtonClass(fileDisabled)}
          disabled={fileDisabled}
          onClick={onAcceptCurrentFile}
          title={RESULT_ACTION_TITLE.AcceptCurrentFile}
        >
          Accept Current File
        </button>
        <button
          type="button"
          className={commandButtonClass(fileDisabled)}
          disabled={fileDisabled}
          onClick={onAcceptIncomingFile}
          title={RESULT_ACTION_TITLE.AcceptIncomingFile}
        >
          Accept Incoming File
        </button>
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
      <div className="min-h-0 flex-1">
        {unsupportedReason ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {unsupportedReason}
          </div>
        ) : (
          <ConflictMonacoEditor
            ariaLabel="Result editor"
            className="h-full"
            resetKey={`${filePath}:${language}`}
            fallbackMessage={
              "Result editor failed to load. Restart the dev server or resolve this file in an external editor."
            }
            height="100%"
            language={language}
            theme="vs-dark"
            value={content}
            onChange={(value) => onChange(value ?? "")}
            onMount={handleMount}
            options={{
              automaticLayout: true,
              fontFamily: "IBM Plex Mono",
              fontSize: 12,
              lineDecorationsWidth: 8,
              lineHeight: 20,
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
