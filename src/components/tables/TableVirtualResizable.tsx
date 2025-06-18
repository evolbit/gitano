import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";

export type TableColumn<T> = {
  key: keyof T & string;
  label: string;
  width: number;
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
}: TableVirtualResizableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
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

  // Handlers para resize
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

  return (
    <div className={`h-full w-full flex flex-col ${className}`}>
      <div
        ref={parentRef}
        data-virtualizer-scroll
        className="flex-1 w-full overflow-auto relative bg-zinc-900">
        {/* Cabecera de la tabla - normal, sin sticky */}
        <div className="flex items-center bg-zinc-700 border-b border-zinc-800 h-11 font-semibold text-zinc-200 text-sm select-none">
          {columns.map((col) => (
            <div
              key={col.key}
              className="relative flex items-center px-1 truncate group"
              style={{ width: colWidths[col.key], minWidth: 40 }}>
              {col.label}
              {/* Resizer */}
              <div
                className="absolute top-0 right-0 h-full w-2 z-20 cursor-col-resize bg-zinc-700 transition"
                onMouseDown={(e) => onMouseDown(e, col.key)}
                style={{ touchAction: "none" }}>
                <div className="w-1 h-5 mx-auto bg-zinc-400/60 rounded" />
              </div>
            </div>
          ))}
        </div>
        {/* Contenido de la tabla */}
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            return (
              <div
                key={row.id || virtualRow.index}
                className={
                  "absolute top-0 left-0 w-full h-11 flex items-center text-zinc-200 text-sm border-b border-zinc-800 cursor-pointer transition-colors duration-150 bg-zinc-800 hover:bg-zinc-700"
                }
                style={{ transform: `translateY(${virtualRow.start}px)` }}>
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="px-2 truncate"
                    style={{ width: colWidths[col.key] }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {/* Loading indicator for infinite scroll */}
        {enableInfiniteScroll && loading && (
          <div className="p-4 text-zinc-400 text-center">
            Cargando más datos...
          </div>
        )}
        {enableInfiniteScroll && !hasMore && !loading && data.length > 0 && (
          <div className="p-4 text-zinc-500 text-center">No hay más datos</div>
        )}
      </div>
    </div>
  );
}
