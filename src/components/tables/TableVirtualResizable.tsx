import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";

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
}

export default function TableVirtualResizable<
  T extends { [key: string]: any }
>({
  columns,
  data,
  rowHeight = 56,
  className = "",
}: TableVirtualResizableProps<T>) {
  console.log(columns);
  const parentRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    Object.fromEntries(columns.map((col) => [col.key, col.width]))
  );
  const resizingCol = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

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
      {/* Cabecera de la tabla */}
      <div className="flex items-center bg-zinc-700 border-b border-zinc-800 h-11 font-semibold text-zinc-200 text-[15px] select-none">
        <div className="w-11 px-2" />
        {columns.map((col) => (
          <div
            key={col.key}
            className="relative flex items-center px-2 truncate group"
            style={{ width: colWidths[col.key] }}>
            {col.label}
            {/* Resizer */}
            <div
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize group-hover:bg-zinc-500/30 transition"
              onMouseDown={(e) => onMouseDown(e, col.key)}>
              <div className="w-1 h-6 mx-auto bg-zinc-400/60 rounded" />
            </div>
          </div>
        ))}
        <div className="w-20" />
      </div>
      {/* Lista virtualizada */}
      <div
        ref={parentRef}
        className="flex-1 w-full overflow-auto relative bg-zinc-900">
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
                  "absolute top-0 left-0 w-full h-14 flex items-center text-zinc-200 text-[15px] border-b border-zinc-800 cursor-pointer transition-colors duration-150 bg-zinc-800 hover:bg-zinc-700"
                }
                style={{ transform: `translateY(${virtualRow.start}px)` }}>
                <div className="w-11 flex justify-center items-center" />
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="px-2 truncate"
                    style={{ width: colWidths[col.key] }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </div>
                ))}
                <div className="w-20 flex items-center justify-center gap-2" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
