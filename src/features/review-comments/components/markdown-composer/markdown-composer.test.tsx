import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { MarkdownComposer } from "./markdown-composer";

describe("MarkdownComposer", () => {
  afterEach(() => {
    cleanup();
  });

  it("updates text, previews markdown, and only saves non-empty comments", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    function Harness() {
      const [value, setValue] = useState("");
      return (
        <MarkdownComposer
          value={value}
          onChange={setValue}
          onSave={onSave}
          onCancel={onCancel}
          saveLabel="Comment"
        />
      );
    }

    render(<Harness />);

    const saveButton = screen.getByRole("button", { name: "Comment" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Leave a comment"), {
      target: { value: "**Ship it**" },
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("Ship it").tagName.toLowerCase()).toBe("strong");

    fireEvent.click(saveButton);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
