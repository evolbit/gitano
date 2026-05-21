## Why

The Workspaces panel currently switches to a worktree on a single row click, which makes browsing the list and using row actions too easy to trigger accidentally. Users need an explicit, predictable way to activate a worktree while preserving lightweight selection and menu interactions.

## What Changes

- Change worktree row activation so switching to another worktree happens on double-click instead of single-click.
- Keep single-click as a panel-local blue row selection, matching the branch panel, that does not change the active worktree.
- Add an explicit `Use Worktree` action to the row three-dot context menu.
- Default the local selection to the current worktree and keep delete actions in the same menu.
- Preserve existing worktree creation, deletion, refresh, and recent-repository behavior.

## Capabilities

### New Capabilities

- `worktree-activation-controls`: Defines Workspaces panel activation behavior, double-click switching, and explicit context-menu activation.

### Modified Capabilities

None.

## Impact

- Frontend Workspaces panel row interaction and context-menu rendering in `src/features/worktrees/workspaces-panel.tsx`.
- Tests for worktree row activation and context-menu actions.
- No backend command or data-model changes.
