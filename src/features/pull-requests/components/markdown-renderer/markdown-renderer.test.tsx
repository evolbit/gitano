import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownRenderer", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a preview placeholder for blank markdown", () => {
    render(<MarkdownRenderer markdown="   " />);

    expect(screen.getByText("Nothing to preview")).toBeInTheDocument();
  });

  it("renders links safely in a new tab", () => {
    render(<MarkdownRenderer markdown="[OpenAI](https://openai.com)" />);

    const link = screen.getByRole("link", { name: "OpenAI" });

    expect(link).toHaveAttribute("href", "https://openai.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("renders GitHub-flavored tables and emoji shortcodes", () => {
    render(
      <MarkdownRenderer
        markdown={[
          "### :white_check_mark: Snyk checks",
          "",
          "| Status | Total |",
          "|---|---|",
          "| :white_check_mark: | [0 issues](https://example.test) |",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "✅ Snyk checks" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0 issues" })).toHaveAttribute(
      "href",
      "https://example.test",
    );
  });
});
