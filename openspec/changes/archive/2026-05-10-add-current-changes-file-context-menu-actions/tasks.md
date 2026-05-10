## 1. File-Scoped Context Menu

- [x] 1.1 Add file-row context-menu state to `ChangesExplorer` so the explorer can distinguish pane menus from file-row menus.
- [x] 1.2 Open the file-row menu on right-click of a current-changes file row without falling through to the pane menu.
- [x] 1.3 Render tracked and untracked file menus with the requested menu entries.

## 2. Implemented File Actions

- [x] 2.1 Reuse existing immediate staging logic for `Stage File` / `Unstage File`.
- [x] 2.2 Add tracked-file discard behavior for `Discard Changes`.
- [x] 2.3 Add untracked-file removal behavior for `Trash File`.

## 3. Deferred Actions and Verification

- [x] 3.1 Show `Stash File`, `Show in Finder` / platform equivalent, and `View File Blame` in disabled state where applicable.
- [x] 3.2 Verify tracked and untracked file menus show the correct action sets.
- [x] 3.3 Verify stage, discard, and trash actions update the current-changes modal correctly after execution.
