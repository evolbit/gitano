import { describe, expect, it } from "vitest";
import {
  applyMarkdownToolbarAction,
  type MarkdownEditorState,
} from "@/shared/lib/markdown/markdown-transforms";

function state(
  value: string,
  selectionStart = 0,
  selectionEnd = value.length,
): MarkdownEditorState {
  return { value, selectionStart, selectionEnd };
}

describe("markdown toolbar transforms", () => {
  it("wraps selected text for bold and italic", () => {
    expect(
      applyMarkdownToolbarAction(state("hello"), { type: "bold" }).value,
    ).toBe("**hello**");
    expect(
      applyMarkdownToolbarAction(state("hello"), { type: "italic" }).value,
    ).toBe("_hello_");
  });

  it("prefixes every selected line for lists and quotes", () => {
    expect(
      applyMarkdownToolbarAction(state("one\ntwo"), {
        type: "bulletList",
      }).value,
    ).toBe("- one\n- two");
    expect(
      applyMarkdownToolbarAction(state("one\ntwo"), {
        type: "orderedList",
      }).value,
    ).toBe("1. one\n2. two");
    expect(
      applyMarkdownToolbarAction(state("one\ntwo"), { type: "quote" }).value,
    ).toBe("> one\n> two");
  });

  it("inserts link, mention, emoji, and attachment placeholders", () => {
    expect(
      applyMarkdownToolbarAction(state("docs"), { type: "link" }).value,
    ).toBe("[docs](url)");
    expect(
      applyMarkdownToolbarAction(state("", 0, 0), { type: "mention" }).value,
    ).toBe("@");
    expect(
      applyMarkdownToolbarAction(state("", 0, 0), {
        type: "emoji",
        emoji: "✅",
      }).value,
    ).toBe("✅");
    expect(
      applyMarkdownToolbarAction(state("", 0, 0), {
        type: "attachment",
      }).value,
    ).toBe("![attachment]()");
  });
});
