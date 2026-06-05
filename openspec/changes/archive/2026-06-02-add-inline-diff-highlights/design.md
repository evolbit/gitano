## Context

The shared diff viewer renders parsed `DiffHunk` data in unified and split modes. Diff line content is already stripped of the raw Git `+`/`-` prefix by the backend parser, and the frontend owns row tone, wrapping, staging gutters, and review-line anchors. The requested behavior is presentation-only: emphasize the changed portion inside comparable deleted/added line pairs.

## Goals / Non-Goals

**Goals:**
- Highlight the changed text range inside paired `Del` and `Add` lines.
- Reuse the same computed ranges for unified and split mode rendering.
- Preserve current wrapping, line-number gutters, staging interactions, and review-thread anchoring.
- Keep the implementation dependency-free and local to the diff feature.

**Non-Goals:**
- Change the backend diff format or Git/Tauri adapters.
- Add a user setting or new display mode.
- Perform full token-aware semantic diffing across moved or reordered lines.

## Decisions

### Compute inline ranges from contiguous changed blocks

Use the existing stageable block grouping to find contiguous add/delete regions. For each block, pair deleted lines and added lines by their order inside the block, up to the shorter side. For each pair, compute the common prefix and common suffix and mark the remaining middle range on each side as the inline highlight.

Alternative considered: add a dependency such as a general text diff package. That would handle more complex edits but adds bundle weight and complexity for a simple visual cue. Prefix/suffix ranges match common Git client behavior for small line edits and dependency-version changes.

### Leave unmatched rows unhighlighted

When a block has only additions, only deletions, or uneven line counts, rows without a paired counterpart keep the existing whole-row tone. This avoids misleading users by marking the whole unmatched line as an intra-line edit when there is no comparable line.

Alternative considered: highlight entire unmatched changed rows. The row color already communicates addition/deletion, and whole-line inline emphasis would make actual replacements harder to distinguish.

### Render highlights inside existing source cells

Render highlighted ranges as nested spans inside the current source-content span. Keep the source cell's `white-space`, wrapping, and overflow styles unchanged so long lines continue to wrap inside the code column.

Alternative considered: split rows into separate positioned overlays. That would complicate wrapping and gutter alignment without adding value.

## Risks / Trade-offs

- [Complex replacements are approximate] -> Use conservative order-based pairing; unmatched rows remain unhighlighted rather than overclaiming precision.
- [Whitespace-only changes may be subtle] -> The highlight span still receives a darker background, but whitespace visibility remains constrained by normal diff rendering.
- [Very large diffs add computation] -> Range calculation is linear in rendered hunk content and runs inside existing memoized hunk rendering.
