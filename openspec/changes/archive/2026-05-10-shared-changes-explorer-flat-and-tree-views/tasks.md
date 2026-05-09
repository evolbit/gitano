## 1. Shared Explorer Foundation

- [x] 1.1 Create a shared changes explorer component that can be reused by the main workspace changes pane and the working-tree diff modal.
- [x] 1.2 Add a common `flat | tree` view mode model and keep file selection keyed by file path instead of visible row index.
- [x] 1.3 Add tracked and untracked grouping before rendering either presentation mode.

## 2. Flat And Tree Rendering

- [x] 2.1 Implement flat view rows with filename-first display, parent path text, and insertion/deletion counts.
- [x] 2.2 Implement tree view rendering with folder nodes derived from file paths and selectable file nodes.
- [x] 2.3 Define tree expansion behavior and search behavior so switching modes does not lose the selected file.

## 3. Surface-Specific Controls

- [x] 3.1 Use the shared explorer in the main workspace changes pane without file checkboxes.
- [x] 3.2 Use the shared explorer in the working-tree diff modal with file checkboxes preserved for editable diffs.
- [x] 3.3 Add a context menu to the main workspace changes pane with only `Flat View` and `Tree View`.
- [x] 3.4 Add a context menu to the working-tree diff modal pane with the full action list, while implementing functionality only for `Flat View` and `Tree View`.

## 4. Verification

- [x] 4.1 Verify the same file remains selected when switching between flat and tree views.
- [x] 4.2 Verify the main workspace changes pane and the working-tree modal show the same file structure for the same repo state.
- [x] 4.3 Verify file checkboxes appear only in the working-tree modal and not in the main workspace changes pane.
