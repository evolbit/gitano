## Why

The app now uses the shared changes explorer in multiple surfaces, but the view-mode behavior is still inconsistent. The working-tree changes pane and its modal share one mode, while the commit changes pane still diverges conceptually. Users should be able to choose `Tree View` or `Flat View` independently for working changes and commit changes, and any modal opened from a pane should inherit that pane's current mode.

## What Changes

- Add an independent `flat | tree` view state for the working-tree changes pane and its modal flow.
- Add an independent `flat | tree` view state for the commit changes pane and its modal flow.
- Ensure each diff modal opens using the current view mode of the pane that launched it.
- Keep the shared changes explorer rendering model across surfaces while decoupling the mode state between working changes and commit changes.

## Capabilities

### New Capabilities
- `independent-changes-view-modes`: Working changes and commit changes maintain separate explorer view preferences, and modal navigation inherits the caller pane's active mode.

### Modified Capabilities
- `changes-explorer-views`: View mode state is no longer treated as a single shared preference across all change-list surfaces.
- `working-tree-diff-modal`: The working-tree modal continues to mirror its caller pane, but only the working-tree pane's own view state should influence it.

## Impact

- Affected frontend areas:
  - shared changes explorer state ownership
  - repo workspace current changes pane
  - commit changes pane
  - diff modal invocation from both panes
- No backend or Git command changes are required.
