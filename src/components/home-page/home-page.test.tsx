import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./home-page";

vi.mock("@/features/launchpad", () => ({
  default: ({ onRepoOpened }: { onRepoOpened?: (path: string) => void }) => (
    <button
      type="button"
      onClick={() => onRepoOpened?.("/repo")}>
      launchpad
    </button>
  ),
}));

describe("HomePage", () => {
  it("passes repository open events through to Launchpad", async () => {
    const user = userEvent.setup();
    const onRepoOpened = vi.fn();

    render(<HomePage onRepoOpened={onRepoOpened} />);
    await user.click(screen.getByRole("button", { name: "launchpad" }));

    expect(onRepoOpened).toHaveBeenCalledWith("/repo");
  });
});
