import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getMergeConflictContentRange } from "@/shared/api/git/conflicts";
import type { GitConflictRegion } from "@/shared/types/git-conflicts";
import {
  applySyncedScrollTop,
  shouldIgnoreSyncedScrollEvent,
} from "../../utils/conflict-scroll-sync";
import { isLineInConflictRegion } from "../../utils/conflict-text";
import { getConflictPaneVisualIdentity } from "../../utils/conflict-visual-identity";
import { ConflictPaneHeader } from "./conflict-pane-header";
import {
  CONFLICT_LINE_HIGHLIGHT,
  ConflictLineRow,
  type ConflictLineHighlight,
} from "./conflict-line-row";
import type { ConflictRangePaneProps } from "./types";

const RANGE_LINE_HEIGHT = 20;
const RANGE_OVERSCAN = 40;
const INITIAL_RANGE_LINES = 80;

function actionButtonClass() {
  return "text-[11px] font-medium text-zinc-200 hover:text-zinc-100";
}

type RangeQueryKeyOptions = Pick<
  ConflictRangePaneProps,
  "repoPath" | "filePath" | "side" | "signature"
> & {
  startLine: number;
  lineCount: number;
};

function rangeQueryKey({
  repoPath,
  filePath,
  side,
  startLine,
  lineCount,
  signature,
}: RangeQueryKeyOptions) {
  return [
    "working-changes-conflict-content-range",
    repoPath,
    filePath,
    side,
    startLine,
    lineCount,
    signature,
  ] as const;
}

function conflictHighlightForLine({
  activeRegion,
  lineNumber,
  regions,
}: {
  activeRegion: GitConflictRegion | null;
  lineNumber: number;
  regions: GitConflictRegion[];
}): ConflictLineHighlight {
  if (activeRegion && isLineInConflictRegion(lineNumber, [activeRegion])) {
    return CONFLICT_LINE_HIGHLIGHT.Strong;
  }

  if (isLineInConflictRegion(lineNumber, regions)) {
    return CONFLICT_LINE_HIGHLIGHT.Weak;
  }

  return CONFLICT_LINE_HIGHLIGHT.None;
}

export function RangeLoadedPane({
  repoPath,
  filePath,
  title,
  side,
  totalLineCount,
  signature,
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
}: ConflictRangePaneProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingSyncedScrollTopRef = useRef<number | null>(null);
  const scrolledRegionKeyRef = useRef<string | null>(null);
  const onScrollPaneMountRef = useRef(onScrollPaneMount);
  const onScrollTopChangeRef = useRef(onScrollTopChange);
  const visualIdentity = getConflictPaneVisualIdentity(side);
  const virtualizer = useVirtualizer({
    count: totalLineCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => RANGE_LINE_HEIGHT,
    overscan: RANGE_OVERSCAN,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const renderedRows =
    virtualItems.length > 0
      ? virtualItems
      : Array.from(
          { length: Math.min(totalLineCount, INITIAL_RANGE_LINES) },
          (_, index) => ({
            key: index,
            index,
            size: RANGE_LINE_HEIGHT,
            start: index * RANGE_LINE_HEIGHT,
          }),
        );

  useEffect(() => {
    onScrollPaneMountRef.current = onScrollPaneMount;
  }, [onScrollPaneMount]);

  useEffect(() => {
    onScrollTopChangeRef.current = onScrollTopChange;
  }, [onScrollTopChange]);

  useEffect(() => {
    if (!activeRegion) {
      scrolledRegionKeyRef.current = null;
      return;
    }

    const regionKey = `${activeRegion.id}:${activeRegion.resultStartLine}`;
    if (scrolledRegionKeyRef.current === regionKey) return;

    scrolledRegionKeyRef.current = regionKey;
    virtualizer.scrollToIndex(
      Math.max(0, activeRegion.resultStartLine - 1),
      { align: "center" },
    );
  }, [activeRegion?.id, activeRegion?.resultStartLine, virtualizer]);

  useEffect(() => {
    if (!scrollRef.current || syncedScrollTop === null) return;

    applySyncedScrollTop({
      currentScrollTop: scrollRef.current.scrollTop,
      pendingSyncedScrollTopRef,
      scrollTop: syncedScrollTop,
      setScrollTop: (scrollTop) => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollTop;
        }
      },
    });
  }, [syncedScrollTop]);

  useEffect(() => {
    if (!onScrollPaneMountRef.current) return;

    onScrollPaneMountRef.current({
      setScrollTop: (scrollTop) => {
        if (!scrollRef.current) return;

        applySyncedScrollTop({
          currentScrollTop: scrollRef.current.scrollTop,
          pendingSyncedScrollTopRef,
          scrollTop,
          setScrollTop: (nextScrollTop) => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = nextScrollTop;
            }
          },
        });
      },
    });

    return () => onScrollPaneMountRef.current?.(null);
  }, []);

  const firstLine = (renderedRows[0]?.index ?? 0) + 1;
  const lastRenderedRow = renderedRows[renderedRows.length - 1];
  const lastLine = (lastRenderedRow?.index ?? 0) + 1;
  const startLine = Math.max(1, firstLine - RANGE_OVERSCAN);
  const lineCount = Math.max(
    1,
    Math.min(totalLineCount - startLine + 1, lastLine - startLine + RANGE_OVERSCAN),
  );
  const rangeQuery = useQuery({
    queryKey: rangeQueryKey({
      repoPath,
      filePath,
      side,
      signature,
      startLine,
      lineCount,
    }),
    queryFn: () =>
      getMergeConflictContentRange({
        repoPath,
        filePath,
        side,
        startLine,
        lineCount,
      }),
  });
  const linesByNumber = useMemo(() => {
    const map = new Map<number, string>();

    rangeQuery.data?.lines.forEach((line, index) => {
      map.set(rangeQuery.data.startLine + index, line);
    });

    return map;
  }, [rangeQuery.data]);
  const actionRegion = activeRegion ?? regions[0] ?? null;
  const hideActionRegion =
    Boolean(actionRegion) &&
    acceptedRegionSidesById[actionRegion?.id ?? ""] === side;

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
      {actionRegion && !hideActionRegion ? (
        <div
          className="gitano-conflict-range-action-strip flex min-h-8 items-center gap-4 overflow-x-auto whitespace-nowrap px-3 text-[11px] text-zinc-400"
          data-conflict-range-action-strip="true"
        >
          <button
            type="button"
            className={actionButtonClass()}
            onClick={() => onAcceptRegion(actionRegion.id)}
          >
            {actionLabel}
          </button>
          <span>|</span>
          <button
            type="button"
            className={actionButtonClass()}
            onClick={() => onAcceptCombination(actionRegion.id)}
          >
            {combinationActionLabel}
          </button>
          <span>|</span>
          <button
            type="button"
            className={actionButtonClass()}
            onClick={() => onIgnoreRegion(actionRegion.id)}
          >
            Ignore
          </button>
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className="min-h-0 min-w-0 flex-1 overflow-auto"
        onScroll={(event) => {
          if (
            !shouldIgnoreSyncedScrollEvent(
              pendingSyncedScrollTopRef,
              event.currentTarget.scrollTop,
            )
          ) {
            onScrollTopChangeRef.current(event.currentTarget.scrollTop);
          }
        }}
      >
        <div
          className="relative min-w-0"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {renderedRows.map((virtualRow) => {
            const lineNumber = virtualRow.index + 1;

            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ConflictLineRow
                  lineNumber={lineNumber}
                  content={linesByNumber.get(lineNumber) ?? ""}
                  highlight={conflictHighlightForLine({
                    activeRegion,
                    lineNumber,
                    regions,
                  })}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
