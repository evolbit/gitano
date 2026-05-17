import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { appI18n } from "@/app/providers/i18n";
import FileTree from "./file-tree";

describe("FileTree", () => {
  it("renders the translated file tree heading and mock files", () => {
    render(
      <I18nextProvider i18n={appI18n}>
        <FileTree />
      </I18nextProvider>,
    );

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText(/App\.tsx/)).toBeInTheDocument();
    expect(screen.getByText(/package\.json/)).toBeInTheDocument();
  });
});
