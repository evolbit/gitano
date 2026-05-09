## Why

The current workspace UI still has rough edges that make the main Git workflow feel less polished than it should. The commit table wastes horizontal space, toolbar actions are noisy, commit selection cannot be cleanly toggled off, and visible copy is inconsistent because many workspace surfaces still use Spanish text.

## What Changes

- Refine the workspace toolbar so actions are right-aligned and `Undo` / `Redo` are removed.
- Update commit-table layout so the message column uses the remaining available width and column resize handles feel lighter.
- Change commit selection behavior so clicking the selected commit again deselects it and hides the detail view, and pressing `Esc` does the same.
- Update workspace-facing UI copy from Spanish to English on the repo view surfaces touched by the main Git workflow.

## Capabilities

### New Capabilities
- `workspace-toolbar-polish`: Covers toolbar layout cleanup, action removal, and commit-detail selection toggling within the repo workspace.

### Modified Capabilities
- `branch-relative-history`: The commit table controls and selection behavior change within the existing branch-history workspace flow.
- `commit-table-columns`: The commit table column layout changes so message content can expand into the remaining space and resize affordances are adjusted.

## Impact

Affected code includes the repo workspace UI in `src/components/TopToolbar.tsx`, `src/components/CommitList.tsx`, `src/components/RepoTabLayout.tsx`, related diff/detail panels, and `src/components/tables/TableVirtualResizable.tsx`. No backend Git APIs are expected to change, but workspace interaction behavior and visible UI copy will be updated.
