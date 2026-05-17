import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
