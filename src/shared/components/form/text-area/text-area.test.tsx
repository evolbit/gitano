import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TextArea from "./text-area";

describe("TextArea", () => {
  afterEach(() => {
    cleanup();
  });

  it("forwards text changes and ref access", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const ref = { current: null as HTMLTextAreaElement | null };

    render(
      <TextArea
        ref={ref}
        value=""
        onChange={onChange}
        placeholder="Commit message"
      />,
    );

    await user.type(screen.getByPlaceholderText("Commit message"), "fix");

    expect(onChange).toHaveBeenCalled();
    expect(ref.current).toBe(screen.getByPlaceholderText("Commit message"));
  });
});
