import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChangesExplorerModalMenuItems } from "./changes-explorer-menu-modal-items";

describe("ChangesExplorerModalMenuItems", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders modal-wide actions as disabled placeholders", () => {
    render(<ChangesExplorerModalMenuItems />);

    expect(screen.getByRole("button", { name: "Stage All" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open Diff" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard Tracked Changes" })).toBeDisabled();
  });
});
