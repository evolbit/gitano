## 1. Hierarchical Selection Layout

- [x] 1.1 Update `src/components/DiffHunk.tsx` so the far-left gutter selects contiguous changed blocks inside a hunk instead of selecting the whole hunk.
- [x] 1.2 Keep a separate line-selection gutter for individual changed rows.
- [x] 1.3 Ensure line numbers and code content remain aligned after the block/line gutter restructuring.

## 2. File-Level Selection State

- [x] 2.1 Update `src/components/DiffFileList.tsx` so the file checkbox in the left panel becomes the primary file-level staging control in editable mode.
- [x] 2.2 Render checked, unchecked, and indeterminate file states based on the currently selected changes within each file.
- [x] 2.3 Keep the file-level checkbox wired to the existing staged-line model instead of introducing separate selection state.

## 3. Preserve Existing Behavior

- [x] 3.1 Keep current line staging behavior working through the new block/file hierarchy.
- [x] 3.2 Ensure block toggles, file toggles, and line toggles remain mutually consistent without changing backend staging semantics.

## 4. Verification

- [x] 4.1 Verify the editable diff now reads as a file / block / line hierarchy similar to GitHub Desktop.
- [x] 4.2 Verify a partially selected file shows an indeterminate checkbox in the left panel.
- [x] 4.3 Verify selecting a block in the far-left gutter toggles only that contiguous changed block, not the entire hunk.
