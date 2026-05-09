## 1. Reuse The Diff Modal For Working-Tree Files

- [x] 1.1 Update `src/components/DiffModal.tsx` so it cleanly accepts working-tree file entries as well as committed-file entries without duplicating modal logic.
- [x] 1.2 Verify the modal continues to render the selected file diff in the right pane and the changed file list in the left pane when `sha` is omitted for working-tree files.
- [x] 1.3 Ensure the modal keeps `Esc` dismissal behavior for working-tree usage.

## 2. Replace The Inline Working-Tree Diff Flow

- [x] 2.1 Update `src/components/RepoTabLayout.tsx` so opening a working-tree file launches `DiffModal` instead of replacing the main workspace with an inline `DiffViewer`.
- [x] 2.2 Remove the user-facing inline working-tree diff presentation path from the repo workspace while keeping the underlying commit workspace unchanged beneath the modal.
- [x] 2.3 Ensure modal navigation uses the current working-tree changed-file list and opens on the user-selected file.

## 3. Verification

- [x] 3.1 Verify committed-file diff behavior still uses the same modal pattern after the shared modal changes.
- [x] 3.2 Verify working-tree file diffs can be opened, browsed between files, and dismissed with `Esc` without disturbing the underlying workspace layout.
