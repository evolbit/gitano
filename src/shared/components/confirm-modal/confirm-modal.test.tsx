import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmModal } from "./confirm-modal";

describe("ConfirmModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing while closed", () => {
    render(
      <ConfirmModal
        open={false}
        title="Delete branch"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls confirm and cancel handlers from primary interactions", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        open
        title="Delete branch"
        description="This cannot be undone."
        details="feature/remove-me"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cancels on Escape and backdrop clicks", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        open
        title="Discard changes"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("presentation"));

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("disables actions while loading", () => {
    render(
      <ConfirmModal
        open
        title="Push"
        loading
        loadingLabel="Pushing..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Pushing..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
