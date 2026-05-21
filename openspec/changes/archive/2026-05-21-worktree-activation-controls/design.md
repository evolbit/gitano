## Context

The Workspaces panel renders worktree rows in `src/features/worktrees/workspaces-panel.tsx`. Each row currently calls the shared `selectWorktree` helper from `onClick`, while the row three-dot button opens a context menu that only contains delete actions. This makes an accidental single click enough to switch the active repository tab to a different worktree.

## Goals / Non-Goals

**Goals:**

- Require double-click for direct row activation.
- Keep a panel-local blue row selection on single click without switching worktrees.
- Add an explicit context-menu action named `Use Worktree` for switching to a worktree.
- Keep delete actions and deletion guards unchanged.
- Keep activation using the existing `selectWorktree` helper so tab updates and recent-repository tracking remain centralized.

**Non-Goals:**

- Change Git worktree backend commands.
- Redesign the Workspaces panel layout, grouping, search, creation form, or delete confirmation modal.

## Decisions

### Decision: Move row activation from `onClick` to `onDoubleClick`

Rows will still support hover, focus, row action visibility, and panel-local selection, but single click will not call `selectWorktree`. The row activation path will move to `onDoubleClick`, which preserves fast direct switching while preventing accidental activation during list browsing.

Alternative considered: require only the context-menu action. That would be explicit, but it would make common worktree switching slower than expected in a desktop-style list.

### Decision: Track panel-local selected worktree rows

The Workspaces panel will keep `selectedWorktreePath` as local UI state. The selected row defaults to the current worktree, matching the branch panel's initial selection behavior. Single-click updates this local selection only, and the same blue selected-row treatment moves to the clicked row. Double-click and `Use Worktree` both set the local selected row and then activate through `selectWorktree`.

Alternative considered: keep the blue highlight tied to the current worktree and use a second neutral style for local selection. That exposes both concepts, but it diverges from the branch panel and makes the selected row feel inconsistent.

### Decision: Add `Use Worktree` to the existing row menu

The context menu already has a Worktree actions group and receives the target worktree. Add `Use Worktree` as the first menu item, wired to the same `selectWorktree` helper and followed by the existing delete actions. The action will be disabled when the target worktree is already current.

Alternative considered: label the action `Open Workspace`. The existing menu and code use worktree terminology for deletion, so `Use Worktree` is clearer and consistent.

## Risks / Trade-offs

- Users accustomed to single-click switching may initially click once and see no activation -> Mitigate with the explicit `Use Worktree` menu action and preserved double-click behavior.
- Double-click can be harder to discover than single-click -> Mitigate by placing `Use Worktree` first in the visible row context menu.
- Current-worktree menu could show a redundant action -> Mitigate by disabling `Use Worktree` for the current worktree.
