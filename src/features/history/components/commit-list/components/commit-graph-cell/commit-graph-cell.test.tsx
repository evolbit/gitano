import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CommitGraphCell from "./commit-graph-cell";

describe("CommitGraphCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("draws graph segments and the commit node at lane positions", () => {
    const { container } = render(
      <CommitGraphCell
        rowHeight={40}
        lane={1}
        colorIdx={2}
        segments={[
          { color_idx: 0, from_lane: 0, from_y: 0, to_lane: 1, to_y: 1 },
          { color_idx: 1, from_lane: 1, from_y: 0, to_lane: 2, to_y: 1, control_lane: 1, control_y: 0.5 },
        ]}
      />,
    );

    const paths = container.querySelectorAll("path");
    const circle = container.querySelector("circle");

    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute("d", "M 20 0 L 36 40");
    expect(paths[1].getAttribute("d")).toContain("Q");
    expect(circle).toHaveAttribute("cx", "36");
    expect(circle).toHaveAttribute("fill", "#bf956a");
  });
});
