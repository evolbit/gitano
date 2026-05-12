## Why

Gitano already exposes placeholder stash affordances, but stash is not yet a coherent workflow in the workspace. Users need a first-class way to create, inspect, apply, pop, delete, and rename stashes without leaving the main UI or losing the existing inline diff experience.

## What Changes

- Add executable toolbar `Stash` and `Pop` actions for repository-wide stash creation and last-stash pop.
- Add a `Stash` action to the current changes commit action menu to stash the currently selected files and folders.
- Replace the left-pane `Folders` section with a `Stashes` section that lists repository stashes and the files contained in the selected stash.
- Add stash file selection controls in the stashes section, including default-select-all behavior and explicit `Select All` / `Unselect All` actions.
- Add stash entry actions through a hover-only three-dot menu with `Apply Stash`, `Pop Stash`, `Delete Stash`, and `Edit Stash Message`.
- Reuse the inline diff viewer to inspect files from a selected stash in read-only mode without staging controls.

## Capabilities

### New Capabilities
- `stash-workflow`: Toolbar stash actions, current-changes stash creation, stash list management, stash file application, inline stash diff inspection, and stash message editing.

### Modified Capabilities
- `left-pane-bottom-navigation`: Replace the `Folders` section with `Stashes` and define the stash-specific pane framing.
- `inline-pane-diff-workspace`: Extend inline diff replacement behavior to support stash-file inspection from the stashes section.

## Impact

- Frontend: toolbar actions, current changes commit action menu, left pane navigation, new stashes panel UI, inline diff host wiring, and shared feedback handling.
- Backend: new Git stash commands for list/create/apply/pop/delete/rename flows and stash file diff/file-list retrieval.
- State: per-repository workspace state for the selected stash, selected stash file, and stash-pane sizing/selection behavior.
