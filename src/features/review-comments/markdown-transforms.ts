export type MarkdownEditorState = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export type MarkdownToolbarAction =
  | { type: "heading" }
  | { type: "bold" }
  | { type: "italic" }
  | { type: "quote" }
  | { type: "inlineCode" }
  | { type: "codeBlock" }
  | { type: "link" }
  | { type: "orderedList" }
  | { type: "bulletList" }
  | { type: "taskList" }
  | { type: "mention" }
  | { type: "emoji"; emoji: string }
  | { type: "attachment" };

export function applyMarkdownToolbarAction(
  state: MarkdownEditorState,
  action: MarkdownToolbarAction,
): MarkdownEditorState {
  switch (action.type) {
    case "heading":
      return prefixSelectedLines(state, () => "### ");
    case "bold":
      return wrapSelection(state, "**", "**", "bold text");
    case "italic":
      return wrapSelection(state, "_", "_", "italic text");
    case "quote":
      return prefixSelectedLines(state, () => "> ");
    case "inlineCode":
      return wrapSelection(state, "`", "`", "code");
    case "codeBlock":
      return wrapSelection(state, "```\n", "\n```", "code");
    case "link":
      return insertLink(state);
    case "orderedList":
      return prefixSelectedLines(state, (index) => `${index + 1}. `);
    case "bulletList":
      return prefixSelectedLines(state, () => "- ");
    case "taskList":
      return prefixSelectedLines(state, () => "- [ ] ");
    case "mention":
      return replaceSelection(state, "@", 1, 1);
    case "emoji":
      return replaceSelection(state, action.emoji, action.emoji.length, action.emoji.length);
    case "attachment":
      return replaceSelection(state, "![attachment]()", 2, 12);
  }
}

function wrapSelection(
  state: MarkdownEditorState,
  prefix: string,
  suffix: string,
  placeholder: string,
) {
  const selected = getSelectedText(state) || placeholder;
  const next = `${prefix}${selected}${suffix}`;
  return replaceSelection(state, next, prefix.length, prefix.length + selected.length);
}

function insertLink(state: MarkdownEditorState) {
  const selected = getSelectedText(state) || "link text";
  const next = `[${selected}](url)`;
  const urlStart = next.length - 4;
  return replaceSelection(state, next, urlStart, urlStart + 3);
}

function prefixSelectedLines(
  state: MarkdownEditorState,
  getPrefix: (lineIndex: number) => string,
) {
  const lineStart = state.value.lastIndexOf("\n", state.selectionStart - 1) + 1;
  const nextLineBreak = state.value.indexOf("\n", state.selectionEnd);
  const lineEnd = nextLineBreak === -1 ? state.value.length : nextLineBreak;
  const selectedBlock = state.value.slice(lineStart, lineEnd);
  const lines = selectedBlock.length > 0 ? selectedBlock.split("\n") : [""];
  const transformed = lines
    .map((line, index) => `${getPrefix(index)}${line}`)
    .join("\n");
  const nextValue = `${state.value.slice(0, lineStart)}${transformed}${state.value.slice(lineEnd)}`;
  const prefixLength = getPrefix(0).length;

  return {
    value: nextValue,
    selectionStart: state.selectionStart + prefixLength,
    selectionEnd: state.selectionEnd + (transformed.length - selectedBlock.length),
  };
}

function replaceSelection(
  state: MarkdownEditorState,
  replacement: string,
  selectionStartOffset: number,
  selectionEndOffset: number,
): MarkdownEditorState {
  return {
    value: `${state.value.slice(0, state.selectionStart)}${replacement}${state.value.slice(state.selectionEnd)}`,
    selectionStart: state.selectionStart + selectionStartOffset,
    selectionEnd: state.selectionStart + selectionEndOffset,
  };
}

function getSelectedText(state: MarkdownEditorState) {
  return state.value.slice(state.selectionStart, state.selectionEnd);
}
