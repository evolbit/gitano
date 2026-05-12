## 1. Backend stash commands

- [x] 1.1 Add backend commands to create a full-repository stash and pop the latest stash for the active repository
- [x] 1.2 Add backend commands to list stash entries and list the files contained in a selected stash
- [x] 1.3 Add backend commands to apply a full stash, apply selected files from a stash, delete a stash, and update a stash message
- [x] 1.4 Add backend diff support for viewing a stash file in the shared inline diff viewer

## 2. Toolbar and current-changes stash actions

- [x] 2.1 Replace the toolbar stash and pop placeholders with executable actions and shared success/error feedback
- [x] 2.2 Add `Stash` to the current changes commit action menu and disable it when no files or folders are selected for stashing
- [x] 2.3 Refresh working changes and stash data after toolbar or current-changes stash operations complete

## 3. Left-pane stashes section

- [x] 3.1 Replace the `Folders` bottom-navigation section and persisted state with `Stashes`
- [x] 3.2 Build the stashes pane with a top stash list, bottom selected-stash file list, and a vertical resizer between them
- [x] 3.3 Add default-select-all, `Select All`, and `Unselect All` behavior for the selected stash file list
- [x] 3.4 Add the footer `Apply` action for selected stash files and disable it when no stash files are checked

## 4. Stash row actions and inline diff

- [x] 4.1 Add hover-only three-dot actions on stash rows with `Apply Stash`, `Pop Stash`, `Delete Stash`, and `Edit Stash Message`
- [x] 4.2 Implement inline stash message editing on a single stash row and refresh the list after save
- [x] 4.3 Open stash files in the existing inline diff workspace in read-only mode and preserve stash selection when the diff closes
