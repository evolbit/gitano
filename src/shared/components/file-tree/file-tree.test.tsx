import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FileTree from "./file-tree";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "fileTree.title" ? "Files" : key),
  }),
}));

describe("FileTree", () => {
  it("renders the translated file tree heading and mock files", () => {
    render(<FileTree />);

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText(/App\.tsx/)).toBeInTheDocument();
    expect(screen.getByText(/package\.json/)).toBeInTheDocument();
  });
});
