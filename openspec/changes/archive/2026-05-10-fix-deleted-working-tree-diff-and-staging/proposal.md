## Why

Deleted working-tree files currently break two parts of the editable diff experience: the right pane can show `No changes.` instead of the deleted content, and the staging UI implies block and line selection where only whole-file staging makes sense. This should be corrected now because deleted files are a common Git operation and the current behavior is misleading.

## What Changes

- Fix working-tree deleted files so the diff modal shows their deleted content instead of an empty diff.
- Restrict deleted working-tree files to file-level staging only.
- Disable block-level and line-level staging controls for deleted working-tree files while keeping the file checkbox functional.
- Ensure deleted files still participate correctly in file-level checked and unchecked staging state.

## Capabilities

### New Capabilities

### Modified Capabilities
- `working-tree-diff-modal`: deleted working-tree files must render deletion hunks in the modal diff view instead of appearing empty.
- `edit-diff-selection-gutters`: deleted working-tree files must be stageable only at the file level, with block and line staging disabled.

## Impact

- Affected Rust diff-building logic in `src-tauri/src/git/diff.rs` and potentially working-directory change assembly in `src-tauri/src/git/staging.rs`.
- Affected editable diff UI logic in `src/components/DiffViewer.tsx`, `src/components/DiffHunk.tsx`, and file-level selection state in the shared explorer.
- No new backend API surface is expected; this corrects existing working-tree diff semantics.
