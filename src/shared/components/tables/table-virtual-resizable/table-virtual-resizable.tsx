import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";

const MAX_SCROLL_CANVAS_HEIGHT = 8_000_000;
const TABLE_OVERSCAN_ROWS = 5;

export type TableColumn<T> = {
  key: keyof T & string;
  label: string;
  width: number;
  minWidth?: number;
  grow?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  render?: (value: any, row: T) => React.ReactNode;
};

export type TableVirtualResizableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  rowHeight?: number;
  className?: string;
  totalRowCount?: number;
  rowIndexOffset?: number;
  getPlaceholderRow?: (absoluteIndex: number) => T | null;
  onVisibleRangeChange?: (range: {
    startIndex: number;
    endIndex: number;
  }) => void;
  onScrollTopChange?: (scrollTop: number) => void;
  // Infinite scroll props
  enableInfiniteScroll?: boolean;
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  loadMoreThreshold?: number;
  onRowClick?: (row: T, index: number) => void;
  onRowContextMenu?: (row: T, index: number, event: React.MouseEvent) => void;
  selectedRowIndex?: number;
  keyboardNavigation?: boolean;
  setKeyboardNavigation?: (v: boolean) => void;
};

export default function TableVirtualResizable<
  T extends { [key: string]: any }
>({
  columns,
  data,
  rowHeight = 50,
  className = "",
  totalRowCount,
  rowIndexOffset = 0,
  getPlaceholderRow,
  onVisibleRangeChange,
  onScrollTopChange,
  enableInfiniteScroll = false,
  hasMore = false,
  loading = false,
  onLoadMore,
  loadMoreThreshold = 200,
  onRowClick,
  onRowContextMenu,
  selectedRowIndex = -1,
  keyboardNavigation = false,
  setKeyboardNavigation,
}: TableVirtualResizableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    Object.fromEntries(columns.map((col) => [col.key, col.width]))
  );
  const resizingCol = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const lastLoadTriggered = useRef(false);
  const scrollReportFrameRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(0);
  const [currentScrollTop, setCurrentScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const rowCount = totalRowCount ?? data.length;
  const actualTotalSize = rowCount * rowHeight;
  const scrollCanvasHeight = Math.min(
    actualTotalSize,
    MAX_SCROLL_CANVAS_HEIGHT
  );
  const usesCompressedScroll = actualTotalSize > scrollCanvasHeight;
  const physicalContentScrollTop = Math.max(currentScrollTop - headerHeight, 0);
  const maxPhysicalScroll = Math.max(scrollCanvasHeight - viewportHeight, 1);
  const maxVirtualScroll = Math.max(actualTotalSize - viewportHeight, 0);
  const compressedScrollScale = usesCompressedScroll
    ? maxVirtualScroll / maxPhysicalScroll
    : 1;
  const virtualScrollTop = usesCompressedScroll
    ? Math.min(
        physicalContentScrollTop * compressedScrollScale,
        maxVirtualScroll
      )
    : currentScrollTop;

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: TABLE_OVERSCAN_ROWS,
  });
  const compressedStartIndex =
    rowCount > 0
      ? Math.max(
          0,
          Math.floor(virtualScrollTop / rowHeight) - TABLE_OVERSCAN_ROWS
        )
      : 0;
  const compressedEndIndex =
    rowCount > 0
      ? Math.min(
          rowCount - 1,
          Math.ceil((virtualScrollTop + viewportHeight) / rowHeight) +
            TABLE_OVERSCAN_ROWS
        )
      : -1;
  const compressedVirtualItems =
    usesCompressedScroll && compressedEndIndex >= compressedStartIndex
      ? Array.from(
          { length: compressedEndIndex - compressedStartIndex + 1 },
          (_, index) => {
            const rowIndex = compressedStartIndex + index;
            return {
              index: rowIndex,
              key: rowIndex,
              size: rowHeight,
              start:
                physicalContentScrollTop +
                rowIndex * rowHeight -
                virtualScrollTop,
            };
          }
        )
      : [];
  const virtualItems = usesCompressedScroll
    ? compressedVirtualItems
    : rowVirtualizer.getVirtualItems();
  const firstVisibleIndex = virtualItems[0]?.index ?? -1;
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;

  // Preserve the scroll position when more data is loaded
  const lastScrollTop = useRef(0);
  const isInitialLoad = useRef(true);
  const isAddingData = useRef(false);

  useEffect(() => {
    setColWidths((prev) =>
      Object.fromEntries(
        columns.map((col) => [col.key, prev[col.key] ?? col.width])
      )
    );
  }, [columns]);

  useEffect(() => {
    const element = parentRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      setContainerWidth(element.clientWidth);
      setViewportHeight(element.clientHeight);
      setHeaderHeight(headerRef.current?.offsetHeight ?? 0);
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);
    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!enableInfiniteScroll) return;

    if (parentRef.current && !isInitialLoad.current && isAddingData.current) {
      // Restore the scroll position after loading more data
      const timeoutId = setTimeout(() => {
        if (parentRef.current) {
          parentRef.current.scrollTop = lastScrollTop.current;
        }
        isAddingData.current = false;
      }, 10);

      return () => clearTimeout(timeoutId);
    }
    isInitialLoad.current = false;
  }, [data.length, enableInfiniteScroll]);

  // Detect when data is being added rather than reset
  useEffect(() => {
    if (!enableInfiniteScroll) return;

    if (!isInitialLoad.current && data.length > 0) {
      isAddingData.current = true;
    }
  }, [data.length, enableInfiniteScroll]);

  // Save the scroll position before loading more data
  useEffect(() => {
    const handleScroll = () => {
      if (parentRef.current) {
        lastScrollTop.current = parentRef.current.scrollTop;
        pendingScrollTopRef.current = parentRef.current.scrollTop;

        if (scrollReportFrameRef.current !== null) {
          return;
        }

        scrollReportFrameRef.current = window.requestAnimationFrame(() => {
          scrollReportFrameRef.current = null;
          setCurrentScrollTop(pendingScrollTopRef.current);
          onScrollTopChange?.(pendingScrollTopRef.current);
        });
      }
    };

    const scrollElement = parentRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll);
      }
      if (scrollReportFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollReportFrameRef.current);
        scrollReportFrameRef.current = null;
      }
    };
  }, [onScrollTopChange]);

  useEffect(() => {
    if (
      !onVisibleRangeChange ||
      firstVisibleIndex < 0 ||
      lastVisibleIndex < 0
    ) {
      return;
    }

    onVisibleRangeChange({
      startIndex: firstVisibleIndex,
      endIndex: lastVisibleIndex,
    });
  }, [firstVisibleIndex, lastVisibleIndex, onVisibleRangeChange]);

  // Auto-scroll when selectedRowIndex changes
  useEffect(() => {
    if (
      keyboardNavigation &&
      selectedRowIndex >= 0 &&
      selectedRowIndex < data.length
    ) {
      const visibleRows = Math.floor(
        (parentRef.current?.clientHeight || 1) / rowHeight
      );
      const isLast = selectedRowIndex === data.length - 1;
      const isNearEnd = selectedRowIndex >= data.length - visibleRows;
      const timeoutId = setTimeout(() => {
        const absoluteIndex = rowIndexOffset + selectedRowIndex;

        if (usesCompressedScroll && parentRef.current) {
          const currentVirtualTop = virtualScrollTop;
          const rowTop = absoluteIndex * rowHeight;
          const rowBottom = rowTop + rowHeight;
          let nextVirtualTop = currentVirtualTop;

          if (isLast) {
            nextVirtualTop = rowTop;
          } else if (
            isNearEnd ||
            rowBottom > currentVirtualTop + viewportHeight
          ) {
            nextVirtualTop = rowBottom - viewportHeight;
          } else if (rowTop < currentVirtualTop) {
            nextVirtualTop = rowTop;
          }

          parentRef.current.scrollTop = Math.max(
            0,
            nextVirtualTop / compressedScrollScale
          );
        } else {
          rowVirtualizer.scrollToIndex(absoluteIndex, {
            align: isLast ? "start" : isNearEnd ? "end" : "auto",
            behavior: "smooth",
          });
        }
        if (setKeyboardNavigation) setKeyboardNavigation(false);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [
    selectedRowIndex,
    data.length,
    rowVirtualizer,
    rowHeight,
    rowIndexOffset,
    keyboardNavigation,
    setKeyboardNavigation,
    usesCompressedScroll,
    virtualScrollTop,
    viewportHeight,
    compressedScrollScale,
  ]);

  // Infinite scroll handler - setup scroll listener
  useEffect(() => {
    if (!enableInfiniteScroll || !onLoadMore) return;

    const handleScroll = () => {
      if (
        !parentRef.current ||
        loading ||
        !hasMore ||
        lastLoadTriggered.current
      ) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;

      // Trigger load when user is within threshold of the bottom
      if (distanceToBottom < loadMoreThreshold) {
        lastLoadTriggered.current = true;
        onLoadMore();
      }
    };

    // Small delay to ensure the component is fully rendered
    const timeoutId = setTimeout(() => {
      const scrollElement = parentRef.current;
      if (scrollElement) {
        scrollElement.addEventListener("scroll", handleScroll);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      const scrollElement = parentRef.current;
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll);
      }
    };
  }, [enableInfiniteScroll, onLoadMore, loadMoreThreshold, hasMore, loading]);

  // Reset the flag when loading state changes
  useEffect(() => {
    if (!loading) {
      lastLoadTriggered.current = false;
    }
  }, [loading]);

  // Check if we need to load more data when content is smaller than container
  useEffect(() => {
    if (
      !enableInfiniteScroll ||
      !onLoadMore ||
      !hasMore ||
      loading ||
      lastLoadTriggered.current ||
      !parentRef.current
    )
      return;

    // Only check if we have very few items (less than 10) to avoid excessive loading
    if (data.length >= 10) return;

    const { scrollHeight, clientHeight } = parentRef.current;
    const needsMoreData = scrollHeight <= clientHeight;

    if (needsMoreData && hasMore && !loading) {
      lastLoadTriggered.current = true;
      onLoadMore();
    }
  }, [data.length, enableInfiniteScroll, onLoadMore, hasMore, loading]);

  // Resize handlers
  const onMouseDown = (e: React.MouseEvent, key: string) => {
    resizingCol.current = key;
    startX.current = e.clientX;
    startWidth.current = colWidths[key];
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const delta = e.clientX - startX.current;
    setColWidths((prev) => ({
      ...prev,
      [resizingCol.current!]: Math.max(40, startWidth.current + delta),
    }));
  };
  const onMouseUp = () => {
    resizingCol.current = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  const growColumn = columns.find((col) => col.grow);
  const growColumnKey = growColumn?.key;
  const fixedWidthTotal = columns
    .filter((col) => col.key !== growColumnKey)
    .reduce((total, col) => total + (colWidths[col.key] ?? col.width), 0);
  const growBaseWidth = growColumn
    ? Math.max(growColumn.minWidth ?? growColumn.width, colWidths[growColumn.key] ?? growColumn.width)
    : 0;
  const availableGrowWidth = Math.max(containerWidth - fixedWidthTotal, 0);
  const resolvedGrowWidth = growColumn
    ? Math.max(growBaseWidth, availableGrowWidth)
    : 0;
  const resolvedColWidths = Object.fromEntries(
    columns.map((col) => [
      col.key,
      col.key === growColumnKey
        ? resolvedGrowWidth
        : colWidths[col.key] ?? col.width,
    ])
  );
  const tableWidth = columns.reduce(
    (total, col) => total + resolvedColWidths[col.key],
    0
  );

  return (
    <div className={`h-full w-full flex flex-col ${className}`}>
      <div
        ref={parentRef}
        data-virtualizer-scroll
        className="flex-1 w-full overflow-auto relative bg-transparent">
        <div
          ref={headerRef}
          className="sticky top-0 z-30 flex h-7 min-h-7 items-center border-b border-border/70 bg-background font-semibold text-muted-foreground text-sm select-none"
          style={{ width: tableWidth, minWidth: "100%" }}>
          {columns.map((col) => (
            <div
              key={col.key}
              className={`relative flex h-full items-center px-3 truncate group ${col.headerClassName ?? ""}`}
              style={{
                width: resolvedColWidths[col.key],
                minWidth: col.minWidth ?? 40,
              }}>
              {col.label}
              {/* Resizer */}
              <div
                className="absolute top-0 right-0 h-full w-1.5 z-20 cursor-col-resize transition"
                onMouseDown={(e) => onMouseDown(e, col.key)}
                style={{ touchAction: "none" }}>
                <div className="w-px h-5 mx-auto bg-border/80 rounded-full group-hover:bg-zinc-500" />
              </div>
            </div>
          ))}
        </div>
        {/* Table content */}
        <div
          style={{
            height: usesCompressedScroll
              ? scrollCanvasHeight
              : rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}>
          {virtualItems.map((virtualRow) => {
            const localIndex = virtualRow.index - rowIndexOffset;
            const row =
              data[localIndex] ?? getPlaceholderRow?.(virtualRow.index);
            const isSelected = selectedRowIndex === localIndex;

            if (!row) {
              return (
                <div
                  key={virtualRow.key}
                  data-row-placeholder={virtualRow.index}
                  className="absolute top-0 left-0"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    height: rowHeight,
                    width: tableWidth,
                    minWidth: "100%",
                  }}
                />
              );
            }

            return (
              <div
                key={virtualRow.key}
                data-row-index={localIndex}
                className={`absolute top-0 left-0 flex items-center text-foreground text-sm cursor-pointer transition-colors duration-150 ${
                  isSelected
                    ? "bg-background text-zinc-100"
                    : "bg-transparent hover:bg-background"
                }`}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: rowHeight,
                  width: tableWidth,
                  minWidth: "100%",
                }}
                onClick={(event) => {
                  if (event.button !== 0) return;
                  onRowClick?.(row, localIndex);
                }}
                onContextMenu={(event) =>
                  onRowContextMenu?.(row, localIndex, event)
                }>
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`truncate ${col.cellClassName ?? "px-3"}`}
                    style={{ width: resolvedColWidths[col.key] }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </div>
                ))}
              </div>
            );
          })}
          {/* Visual filler when there is empty space */}
          {parentRef.current &&
            rowVirtualizer.getTotalSize() < parentRef.current.clientHeight && (
              <div
                style={{
                  height:
                    parentRef.current.clientHeight -
                    rowVirtualizer.getTotalSize(),
                  width: "100%",
                  background: "transparent",
                }}
              />
            )}
        </div>
        {/* Loading indicator for infinite scroll */}
        {enableInfiniteScroll && loading && (
          <div className="p-4 text-zinc-400 text-center">Loading more data...</div>
        )}
        {enableInfiniteScroll && !hasMore && !loading && data.length > 0 && (
          <div className="p-4 text-zinc-500 text-center">No more data</div>
        )}
      </div>
    </div>
  );
}
