## Why

The editable diff viewer still does not match the GitHub Desktop interaction model it was inspired by. The current implementation treats whole hunks as the selection unit in the diff gutter and does not expose the file-level checkbox in the left panel, so users cannot stage work with the expected file / block / line hierarchy.

## What Changes

- Refactor the editable diff viewer to use hierarchical staging selection with three visible layers:
  - file-level checkbox in the left file list
  - block-level checkbox in the far-left diff gutter
  - line-level checkbox in the next diff gutter
- Replace the current whole-hunk gutter toggle with block-level toggles for contiguous changed blocks inside a hunk.
- Show file-level indeterminate state in the left panel when only part of a file is selected.
- Align the diff presentation more closely with the GitHub Desktop staging layout.

## Capabilities

### New Capabilities
- `edit-diff-selection-gutters`: Defines hierarchical file / block / line staging controls in the editable diff viewer.

### Modified Capabilities

## Impact

- Affected code in `src/components/DiffHunk.tsx`, `src/components/DiffViewer.tsx`, and `src/components/DiffFileList.tsx`
- Working-tree diff editing UI, file-list selection state, and staging affordance layout
