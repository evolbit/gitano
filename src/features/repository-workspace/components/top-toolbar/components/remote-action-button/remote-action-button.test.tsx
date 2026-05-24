import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RemoteActionButton } from "./remote-action-button";

function renderButton(
  props: Partial<React.ComponentProps<typeof RemoteActionButton>> = {},
) {
  const onClick = props.onClick ?? vi.fn();
  render(
    <MantineProvider>
      <RemoteActionButton
        label="Pull"
        icon={<span aria-hidden="true">icon</span>}
        onClick={onClick}
        {...props}
      />
    </MantineProvider>,
  );
  return { onClick };
}

describe("RemoteActionButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("dispatches clicks when enabled", () => {
    const { onClick } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Pull" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables interaction while loading", () => {
    const { onClick } = renderButton({ loading: true });

    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Pull" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
