## Why

The current changes lists in the main workspace and working-tree diff modal use a flat file list that does not scale well for nested repositories and creates two different navigation experiences. Gitano needs a shared changes explorer that can switch between flat and tree presentations while keeping the main window simpler than the editable modal.

## What Changes

- Introduce a shared changes explorer UI that can render changed files in both flat and tree views.
- Reuse that explorer in the main workspace changes pane and the working-tree diff modal so both surfaces present the same file structure.
- Group changed files into tracked and untracked sections in both views.
- Add a right-click context menu to the main workspace changes pane with only `Flat View` and `Tree View`.
- Add a right-click context menu to the working-tree diff modal pane with the full GitHub-style action list, but only make `Flat View` and `Tree View` functional for now.
- Keep file staging checkboxes exclusive to the working-tree diff modal and omit them from the main workspace changes pane.

## Capabilities

### New Capabilities
- `changes-explorer-views`: Shared flat and tree changes explorer behavior across the main workspace and working-tree diff modal.

### Modified Capabilities
- `working-tree-diff-modal`: The working-tree diff modal file pane now uses the shared changes explorer and supports view switching from a context menu.

## Impact

- Affected frontend components in `src/components/`, especially the changes list and diff modal surfaces.
- Likely introduces a new shared explorer component and tree-building helpers.
- Reuses existing staged-line state in the modal, without changing backend staging APIs.
