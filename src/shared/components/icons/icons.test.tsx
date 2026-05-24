import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconCheck } from "./icons";

describe("shared icon exports", () => {
  it("passes sizing and accessibility props through to the rendered svg", () => {
    const { container } = render(
      <IconCheck aria-label="complete" data-testid="check-icon" size={18} />,
    );

    const icon = container.querySelector("svg");

    expect(icon).toHaveAttribute("aria-label", "complete");
    expect(icon).toHaveAttribute("width", "18");
    expect(icon).toHaveAttribute("height", "18");
  });
});
