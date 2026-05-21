## Context

The shared diff renderer currently uses non-wrapping code cells (`whitespace-pre`) in unified rows, split rows, and split context rows. That keeps source lines visually compact, but it also allows long content to run beyond the visible pane in constrained layouts without an obvious scroll path. The affected surfaces all flow through `DiffViewerBase` and `DiffHunk`, so the fix can stay local to the shared diff row rendering.

## Goals / Non-Goals

**Goals:**

- Make long diff source lines readable by wrapping them inside the visible diff pane.
- Keep existing unified and split display modes.
- Keep staging gutters and line-number gutters fixed outside the wrapped source content.
- Avoid blank gutter-sized spaces at wrapped continuation lines.
- Preserve existing diff data, staging state, and display-mode state.

**Non-Goals:**

- Add synchronized horizontal scrolling.
- Add a user-facing wrap toggle or diff preference.
- Change backend diff generation, hunk data shape, or staging semantics.
- Introduce intraline diff rendering or syntax-aware wrapping.

## Decisions

### Decision: Wrap only source content cells

Use CSS wrapping on the source-content elements instead of changing the row data model. Unified mode keeps the block gutter, line gutter, old line-number column, and new line-number column fixed; only the source text column wraps. Split mode keeps the old/new line-number columns and center staging gutters fixed; only the left and right source text columns wrap.

Alternative considered: wrap the whole diff row. That would be simpler CSS, but it would let continuation text flow under gutters or line-number columns, creating the blank-space problem this change is meant to avoid.

### Decision: Preserve whitespace while allowing long tokens to break

Use wrapping that preserves code indentation and spaces while allowing very long tokens to break within the available pane. This keeps code readable for normal lines and prevents path-like strings, generated identifiers, or long string literals from forcing overflow.

Alternative considered: rely only on normal word wrapping. That handles prose-like lines but still fails on long code tokens.

### Decision: Keep vertical alignment top-based

Line-number and staging gutter cells should align to the top of a wrapped row. Continuation lines should occupy only the source-content area, so the visual association remains clear without repeating line numbers.

Alternative considered: repeat line numbers on each wrapped continuation. That adds visual noise and implies multiple source lines where there is still only one diff line.

## Risks / Trade-offs

- Wrapped rows make large hunks taller -> Mitigate by limiting the change to source content and preserving compact gutter widths.
- Split mode gets narrower per side -> Mitigate by breaking long tokens inside each `minmax(0, 1fr)` side instead of adding horizontal scrolling.
- Existing tests assert non-wrapping classes -> Update them to assert wrapped source content and fixed gutter behavior.
