## 1. Worktree Activation

- [x] 1.1 Change Workspaces panel row activation from single-click to double-click while preserving hover, focus, and current-worktree styling.
- [x] 1.2 Keep `selectWorktree` as the single activation helper for tab updates, selected commit clearing, and recent-repository tracking.
- [x] 1.3 Track panel-local selected worktree rows with the same blue selection treatment as the branch panel, without activating a worktree on single click.

## 2. Worktree Context Menu

- [x] 2.1 Add `Use Worktree` as the first action in the worktree row three-dot menu.
- [x] 2.2 Wire `Use Worktree` to activate non-current worktrees and close the menu.
- [x] 2.3 Disable `Use Worktree` for the current worktree while preserving existing delete action enablement rules.

## 3. Verification

- [x] 3.1 Add or update Workspaces panel tests covering single-click selection, double-click activation, and menu activation behavior.
- [x] 3.2 Run focused worktree tests and the relevant frontend test command.
