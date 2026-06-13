import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConflictAiPanel } from "./conflict-ai-panel";

describe("ConflictAiPanel", () => {
  it("runs a full-file AI action from one resolve button", () => {
    const onRunFile = vi.fn();

    render(
      <ConflictAiPanel
        loading={false}
        canRunFile
        onRunFile={onRunFile}
        onRefreshFile={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Region" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "File" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resolve with AI" }));

    expect(onRunFile).toHaveBeenCalled();
  });

  it("does not render old apply controls", () => {
    render(
      <ConflictAiPanel
        loading={false}
        canRunFile
        onRunFile={vi.fn()}
        onRefreshFile={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("shows the busy spinner inside the resolve button", () => {
    render(
      <ConflictAiPanel
        loading
        canRunFile
        onRunFile={vi.fn()}
        onRefreshFile={vi.fn()}
      />,
    );

    const resolveButton = screen.getByRole("button", { name: "Resolving" });

    expect(resolveButton).toBeDisabled();
    expect(resolveButton.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Generating AI fix")).not.toBeInTheDocument();
  });
});
