import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BranchName } from "./branch-name";

describe("BranchName", () => {
  it("renders branch labels with emphasized styling", () => {
    render(<BranchName>feature/tests</BranchName>);

    expect(screen.getByText("feature/tests")).toHaveClass("font-semibold");
  });
});
