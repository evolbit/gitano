import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getMergeConflictContentRange } from "@/shared/api/git/conflicts";
import type { GitConflictRegion } from "@/shared/types/git-conflicts";
import { isLineInConflictRegion } from "../../utils/conflict-text";
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
  return "text-[11px] font-medium text-zinc-300 hover:text-zinc-100";
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
  acceptedRegionLabel,
  actionLabel,
  combinationActionLabel,
  onAcceptRegion,
  onAcceptCombination,
  onIgnoreRegion,
  syncedScrollTop,
  onScrollTopChange,
}: ConflictRangePaneProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
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
    if (!activeRegion) return;

    virtualizer.scrollToIndex(
      Math.max(0, activeRegion.resultStartLine - 1),
      { align: "center" },
    );
  }, [activeRegion, virtualizer]);

  useEffect(() => {
    if (!scrollRef.current || syncedScrollTop === null) return;
    if (Math.abs(scrollRef.current.scrollTop - syncedScrollTop) < 1) return;

    syncingScrollRef.current = true;
    scrollRef.current.scrollTop = syncedScrollTop;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [syncedScrollTop]);

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

  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-border last:border-r-0">
      <div className="border-b border-border bg-background-emphasis px-3 py-1.5 text-xs font-semibold">
        {title}
      </div>
      {activeRegion && !acceptedRegionLabel ? (
        <div className="flex min-h-8 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-amber-500/40 bg-background-emphasis px-3 text-[11px] text-zinc-500">
          <button
            type="button"
            className={actionButtonClass()}
            onClick={onAcceptRegion}
          >
            {actionLabel}
          </button>
          <span>|</span>
          <button
            type="button"
            className={actionButtonClass()}
            onClick={onAcceptCombination}
          >
            {combinationActionLabel}
          </button>
          <span>|</span>
          <button
            type="button"
            className={actionButtonClass()}
            onClick={onIgnoreRegion}
          >
            Ignore
          </button>
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(event) => {
          if (!syncingScrollRef.current) {
            onScrollTopChange(event.currentTarget.scrollTop);
          }
        }}
      >
        <div
          className="relative min-w-max"
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
