import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRANCH_ICON_COLOR, PRIORITY_BRANCH_COLOR } from "../../constants";
import { BranchIcon } from "./branch-icon";

describe("BranchIcon", () => {
  it("uses the priority color for mainline branches", () => {
    const { container } = render(<BranchIcon name="main" />);

    expect(container.querySelector("svg")).toHaveClass(PRIORITY_BRANCH_COLOR);
  });

  it("uses the default color for non-priority branches", () => {
    const { container } = render(<BranchIcon name="feature/tests" />);

    expect(container.querySelector("svg")).toHaveClass(DEFAULT_BRANCH_ICON_COLOR);
  });
});
