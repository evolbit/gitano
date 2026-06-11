## Context

The shared diff viewer consumes backend-parsed `DiffHunk` data and renders it in unified and split modes. The current React renderer owns row layout, old/new line numbers, staging gutters, drag selection, context expansion, inline changed-text highlights, and review-thread anchors. Monaco is already available in the app for conflict resolution and has a shared Ayu Dark theme registry under `src/shared/lib/monaco`.

The requested change is primarily presentation quality: source code inside diff rows should receive editor-grade syntax coloring while preserving Gitano's existing diff behavior.

## Goals / Non-Goals

**Goals:**

- Use Monaco for syntax-colored, read-only source rendering in the shared diff viewer.
- Keep `DiffHunk` and `DiffLine` as the authoritative data model for staging, review anchors, context expansion, and display-mode transforms.
- Preserve unified and split display modes, existing add/delete row tones, exact inline changed-text highlights, and current staging drag behavior.
- Preserve file and line review/comment accessories rendered through `DiffInteractionProvider`.
- Reuse the existing shared Monaco theme registration and language inference infrastructure where possible.

**Non-Goals:**

- Use Monaco's built-in diff editor or diff algorithm.
- Change backend diff parsing, Tauri commands, staging payloads, or index sync behavior.
- Introduce range/block review comments beyond the existing line/file review anchor behavior.
- Replace the merge conflict editor implementation.

## Decisions

### Decision: Monaco renders source content, Gitano owns diff structure

Monaco should be embedded as the code presentation surface inside the existing diff row model. The current `hunkIdx + lineIdx` identity remains the source of truth for staging, drag selection, inline review anchors, and split-row pairing.

Alternative considered: use Monaco's diff editor. That would require translating Gitano's parsed hunks into Monaco models and then translating Monaco's computed ranges back into `hunkIdx + lineIdx`, which risks breaking staging and review behavior.

### Decision: Build Monaco line models from existing hunk rows

Each rendered Monaco-backed surface should expose a deterministic mapping from Monaco model line numbers back to the existing diff line identity. Unified mode can use one model stream for the hunk content; split mode can use separate old/new side streams derived from the existing `buildSplitRows` output.

The renderer should keep line numbers and staging/comment gutters in React where that is simpler and less fragile. Monaco decorations provide syntax and inline source styling, while React continues to place Git workflow controls.

Alternative considered: move line numbers and staging controls into Monaco glyph margins. That would be closer to an editor surface, but it complicates split mode, wrapped rows, review widgets, and tests without changing the underlying behavior.

### Decision: Inline changed-text highlights layer over Monaco tokens

The existing `buildInlineDiffHighlightRanges` algorithm should remain the source of truth for exact changed ranges. Monaco rendering must preserve those ranges by decorating the corresponding source columns with the stronger green/red inline highlight colors while keeping the row-level add/delete tone visible.

Alternative considered: ask Monaco to compute token or diff ranges. Monaco tokenization is not a semantic diff and should not replace the existing conservative add/delete pairing logic.

### Decision: Lazy-load Monaco and provide a non-editor fallback

The diff viewer should lazy-load Monaco similarly to conflict editors so normal app startup is not forced to pay the editor cost. If Monaco fails to load, the viewer should continue to render readable plain source content with existing row colors and interactions.

Alternative considered: eagerly import Monaco for every diff surface. That simplifies component code but worsens bundle and startup behavior for users who do not open diffs immediately.

## Risks / Trade-offs

- [Monaco row height may diverge from React gutters] -> Keep fixed font family, font size, and line height aligned with existing diff constants; verify unified and split modes visually and through focused tests.
- [Multiple Monaco instances could be expensive on large diffs] -> Prefer hunk-level or side-level editor surfaces rather than one editor per line, keep minimap and editor chrome disabled, and continue respecting the existing rendered line cap.
- [Language inference may be imperfect] -> Use shared extension-based inference and fall back to plaintext rather than blocking diff rendering.
- [Review/comment widgets could drift from source rows] -> Keep review accessories and below-line content in React, attached to existing `DiffLineAnchor` values.
