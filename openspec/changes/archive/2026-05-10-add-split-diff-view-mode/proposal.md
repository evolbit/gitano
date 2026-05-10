## Why

The diff viewer currently renders changes only in a unified layout, which makes it harder to compare old and new content side by side in larger edits. Users also need the split presentation to preserve the existing staging workflow instead of creating a separate interaction model.

## What Changes

- Add a split diff display mode alongside the existing unified diff display mode.
- Keep unified mode as the current single-stream layout, including its existing selection gutter placement.
- Render split mode with old content on the left, new content on the right, and the block and line selection gutters in the center seam between both sides.
- Preserve the current block and line staging behavior across both display modes so selection still targets the same logical changed lines.
- Extend the diff display controls so users can switch between unified and split presentation without losing the current file or selection context.

## Capabilities

### New Capabilities
- `diff-display-modes`: Defines unified and split diff presentation modes and how users switch between them in the diff viewer.

### Modified Capabilities
- `edit-diff-selection-gutters`: Update editable diff gutter requirements so unified mode keeps left-side gutters while split mode moves block and line selection gutters into the center seam and keeps block selection targeting both sides of the logical change.

## Impact

- Affected code: `src/components/DiffViewer.tsx`, `src/components/DiffHunk.tsx`, and any diff settings UI that owns display mode controls.
- Affected behavior: working-tree and committed-file diff inspection surfaces that use the shared diff viewer.
- No new backend Git commands are expected; the change is primarily a frontend rendering and interaction expansion.
