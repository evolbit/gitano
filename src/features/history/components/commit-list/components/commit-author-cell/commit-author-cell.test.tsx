import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CommitAuthorCell from "./commit-author-cell";

describe("CommitAuthorCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("falls back to the author initial after avatar load failure", () => {
    const { container } = render(
      <CommitAuthorCell author="Ada Lovelace" initial="a" avatarUrl="https://example.com/avatar.png" />,
    );

    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("labels empty authors as unknown", () => {
    render(<CommitAuthorCell author="" initial="" />);

    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
