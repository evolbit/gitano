import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import InputText from "./input-text";

describe("InputText", () => {
  afterEach(() => {
    cleanup();
  });

  it("forwards text changes and renders adornments", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <InputText
        value=""
        onChange={onChange}
        placeholder="Branch name"
        leftIcon={<span>left</span>}
        rightIcon={<span>right</span>}
      />,
    );

    await user.type(screen.getByPlaceholderText("Branch name"), "f");

    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
  });
});
