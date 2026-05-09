import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";

export type TableColumn<T> = {
  key: keyof T & string;
  label: string;
  width: number;
  minWidth?: number;
  grow?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
};

export interface TableVirtualResizableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowHeight?: number;
  className?: string;
  // Infinite scroll props
  enableInfiniteScroll?: boolean;
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  loadMoreThreshold?: number;
  onRowClick?: (row: T, index: number) => void;
  selectedRowIndex?: number;
  keyboardNavigation?: boolean;
  setKeyboardNavigation?: (v: boolean) => void;
}

export default function TableVirtualResizable<
  T extends { [key: string]: any }
>({
  columns,
  data,
  rowHeight = 50,
  className = "",
  enableInfiniteScroll = false,
  hasMore = false,
  loading = false,
  onLoadMore,
  loadMoreThreshold = 200,
  onRowClick,
  selectedRowIndex = -1,
  keyboardNavigation = false,
  setKeyboardNavigation,
}: TableVirtualResizableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    Object.fromEntries(columns.map((col) => [col.key, col.width]))
  );
  const resizingCol = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const lastLoadTriggered = useRef(false);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

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

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
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
  }, [data.length]);

  // Detect when data is being added rather than reset
  useEffect(() => {
    if (!isInitialLoad.current && data.length > 0) {
      isAddingData.current = true;
    }
  }, [data.length]);

  // Save the scroll position before loading more data
  useEffect(() => {
    const handleScroll = () => {
      if (parentRef.current) {
        lastScrollTop.current = parentRef.current.scrollTop;
      }
    };

    const scrollElement = parentRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

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
        rowVirtualizer.scrollToIndex(selectedRowIndex, {
          align: isLast ? "start" : isNearEnd ? "end" : "auto",
          behavior: "smooth",
        });
        if (setKeyboardNavigation) setKeyboardNavigation(false);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [
    selectedRowIndex,
    data.length,
    rowVirtualizer,
    rowHeight,
    keyboardNavigation,
    setKeyboardNavigation,
  ]);

  // Infinite scroll handler - setup scroll listener
  useEffect(() => {
    if (!enableInfiniteScroll || !onLoadMore) return;

    const handleScroll = () => {
      console.log("Scroll event triggered", {
        hasMore,
        loading,
        lastLoadTriggered: lastLoadTriggered.current,
        parentRef: !!parentRef.current,
      });

      if (
        !parentRef.current ||
        loading ||
        !hasMore ||
        lastLoadTriggered.current
      ) {
        console.log("Scroll event blocked", {
          noParent: !parentRef.current,
          loading,
          noHasMore: !hasMore,
          lastLoadTriggered: lastLoadTriggered.current,
        });
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;

      console.log("Table scroll event", {
        scrollTop,
        scrollHeight,
        clientHeight,
        threshold: loadMoreThreshold,
        distance: distanceToBottom,
        hasMore,
        loading,
        lastLoadTriggered: lastLoadTriggered.current,
      });

      // Trigger load when user is within threshold of the bottom
      if (distanceToBottom < loadMoreThreshold) {
        console.log("Triggering onLoadMore from table scroll");
        lastLoadTriggered.current = true;
        onLoadMore();
      }
    };

    // Small delay to ensure the component is fully rendered
    const timeoutId = setTimeout(() => {
      const scrollElement = parentRef.current;
      if (scrollElement) {
        console.log(
          "Setting up scroll listener for infinite scroll",
          scrollElement
        );
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
    console.log("Loading state changed", {
      loading,
      lastLoadTriggered: lastLoadTriggered.current,
    });
    if (!loading) {
      console.log("Resetting lastLoadTriggered flag");
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

    console.log("Checking if content needs more data", {
      scrollHeight,
      clientHeight,
      needsMoreData,
      hasMore,
      loading,
      dataLength: data.length,
    });

    if (needsMoreData && hasMore && !loading) {
      console.log("Content is smaller than container, triggering onLoadMore");
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
        className="flex-1 w-full overflow-auto relative bg-background">
        {/* Table header: regular, not sticky */}
        <div
          className="flex items-center bg-background-emphasis h-12 font-semibold text-foreground text-sm select-none"
          style={{ width: tableWidth, minWidth: "100%" }}>
          {columns.map((col) => (
            <div
              key={col.key}
              className="relative flex items-center px-1 truncate group"
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
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            const isSelected = selectedRowIndex === virtualRow.index;
            return (
              <div
                key={row.id || virtualRow.index}
                data-row-index={virtualRow.index}
                className={`absolute top-0 left-0 h-12 flex items-center text-foreground text-sm border-b border-border cursor-pointer transition-colors duration-150 ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-background hover:bg-background-emphasis"
                }`}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  width: tableWidth,
                  minWidth: "100%",
                }}
                onClick={() => onRowClick && onRowClick(row, virtualRow.index)}>
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="px-4 truncate"
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
