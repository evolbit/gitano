## Why

The working-tree diff modal currently opens from the current-changes sidebar with the correct initial file, but while it stays open it does not reliably track subsequent repository updates. New untracked files, index changes, and other working-tree refreshes appear in the main current-changes pane but can remain stale in the modal list.

That leaves the modal and the main current-changes explorer showing different realities of the same repository state, which is confusing and makes the modal feel detached from the live workspace.

## What Changes

- Make the working-tree diff modal follow the same live working-changes source as the main current-changes pane while it is open.
- Ensure newly added or newly detected untracked files appear in the modal file list without requiring the modal to be closed and reopened.
- Preserve modal selection by file path when the selected file still exists after a refresh.
- Close the modal only when the selected file truly disappears from the working changes.

## Capabilities

### Modified Capabilities
- `working-tree-diff-modal`: The modal file list and selected file state now follow live working-tree updates while open.

## Impact

- Affected code in `src/components/RepoTabLayout.tsx`, `src/components/DiffModal.tsx`, and related working-tree modal state handling.
- Working-tree diff modal behavior becomes consistent with the current-changes sidebar after repository refreshes and external index/working-tree changes.
