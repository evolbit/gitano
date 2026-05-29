import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TableVirtualResizable, { type TableColumn } from "./table-virtual-resizable";

const scrollToIndexMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
  }) => ({
    getTotalSize: () => count * estimateSize(),
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * estimateSize(),
        size: estimateSize(),
      })),
    scrollToIndex: scrollToIndexMock,
  }),
}));

type Row = {
  id: string;
  name: string;
};

const columns: TableColumn<Row>[] = [
  {
    key: "name",
    label: "Name",
    width: 120,
  },
];

const rows: Row[] = [{ id: "one", name: "First row" }];

describe("TableVirtualResizable", () => {
  it("does not treat right-click as row click", () => {
    const onRowClick = vi.fn();
    const onRowContextMenu = vi.fn();

    render(
      <TableVirtualResizable
        columns={columns}
        data={rows}
        onRowClick={onRowClick}
        onRowContextMenu={onRowContextMenu}
      />,
    );

    const row = screen.getByText("First row").closest("[data-row-index]");

    expect(row).not.toBeNull();
    fireEvent.click(row!, { button: 2 });
    fireEvent.contextMenu(row!);

    expect(onRowClick).not.toHaveBeenCalled();
    expect(onRowContextMenu).toHaveBeenCalledWith(rows[0], 0, expect.anything());
  });

  it("maps capped scroll height to the final rows for very large tables", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const onVisibleRangeChange = vi.fn();

    try {
      const { container } = render(
        <TableVirtualResizable
          columns={columns}
          data={[]}
          totalRowCount={1_000_000}
          rowHeight={30}
          getPlaceholderRow={(absoluteIndex) => ({
            id: `row-${absoluteIndex}`,
            name: `Row ${absoluteIndex}`,
          })}
          onVisibleRangeChange={onVisibleRangeChange}
        />,
      );

      const scrollElement = container.querySelector<HTMLDivElement>(
        "[data-virtualizer-scroll]",
      );

      expect(scrollElement).not.toBeNull();

      Object.defineProperty(scrollElement, "scrollTop", {
        configurable: true,
        value: 8_000_000,
        writable: true,
      });
      fireEvent.scroll(scrollElement!);

      expect(screen.getByText("Row 999999")).toBeInTheDocument();
      expect(onVisibleRangeChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ endIndex: 999_999 }),
      );
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });
});
