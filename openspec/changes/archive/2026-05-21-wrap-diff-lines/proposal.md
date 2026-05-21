## Why

Long diff lines can currently run beyond the visible diff pane without wrapping or an obvious horizontal scroll affordance, making parts of the change unreadable in constrained layouts. We should make the default diff view readable without asking users to manage synchronized horizontal scrolling.

## What Changes

- Wrap long diff source lines within the visible unified or split diff pane.
- Keep line-number and staging gutters outside the wrapped content area so wrapping does not create blank gutter columns or misaligned row backgrounds.
- Preserve the existing unified and split display modes without adding a user-facing wrapping preference or synchronized horizontal scroll behavior.
- Update tests that currently assert non-wrapping diff rows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `diff-display-modes`: Change long-line behavior from non-wrapping rows to wrapped source content that respects existing gutters in unified and split diff modes.

## Impact

- Shared diff hunk rendering in `src/features/diffs/diff-hunk.tsx`.
- Diff viewer tests in `src/features/diffs/diff-hunk.test.tsx`.
- Unified and split diff surfaces that consume `DiffViewer` or `DiffViewerBase`.
