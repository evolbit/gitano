import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeType } from "@/shared/types/git";
import { createFileChange } from "@/test/fixtures/git";
import FileListItem from "./file-list-item";

describe("FileListItem", () => {
  it("renders parent paths, file names, and diff stats", () => {
    render(
      <FileListItem
        file={createFileChange({
          path: "src/features/file.ts",
          insertions: 3,
          deletions: 1,
        })}
      />,
    );

    expect(screen.getByText("src/features/")).toBeInTheDocument();
    expect(screen.getByText("file.ts")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("hides stats for empty added files", () => {
    render(
      <FileListItem
        file={createFileChange({
          path: "new-file.ts",
          status: "added",
          insertions: 0,
          deletions: 0,
        })}
      />,
    );

    expect(screen.queryByText("+0")).not.toBeInTheDocument();
    expect(screen.queryByText("-0")).not.toBeInTheDocument();
  });

  it("renders conflicted files with the conflict icon style", () => {
    const { container } = render(
      <FileListItem
        file={createFileChange({
          status: ChangeType.Conflicted,
          insertions: 0,
          deletions: 0,
        })}
      />,
    );

    expect(container.querySelector("svg")?.className.baseVal).toContain(
      "text-amber-400",
    );
    expect(screen.getByText("+0")).toBeInTheDocument();
    expect(screen.getByText("-0")).toBeInTheDocument();
  });
});
