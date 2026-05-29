import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CommitAuthorCell from "./commit-author-cell";

describe("CommitAuthorCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("falls back to the author initial after avatar load failure", () => {
    const { container } = render(
      <CommitAuthorCell
        author="Ada Lovelace"
        initial="a"
        avatarUrl="https://example.com/avatar.png"
      />,
    );

    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("hides a changed avatar until the new image loads", () => {
    const { container, rerender } = render(
      <CommitAuthorCell
        author="Ada Lovelace"
        initial="A"
        avatarUrl="https://example.com/ada.png"
      />,
    );

    const firstImage = container.querySelector("img") as HTMLImageElement;
    fireEvent.load(firstImage);

    expect(firstImage).toHaveClass("opacity-100");

    rerender(
      <CommitAuthorCell
        author="Grace Hopper"
        initial="G"
        avatarUrl="https://example.com/grace.png"
      />,
    );

    const nextImage = container.querySelector("img") as HTMLImageElement;

    expect(nextImage).not.toBe(firstImage);
    expect(nextImage).toHaveAttribute("src", "https://example.com/grace.png");
    expect(nextImage).toHaveClass("opacity-0");
    expect(screen.getByText("G")).toBeInTheDocument();

    fireEvent.load(nextImage);

    expect(nextImage).toHaveClass("opacity-100");
  });

  it("labels empty authors as unknown", () => {
    render(<CommitAuthorCell author="" initial="" />);

    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
