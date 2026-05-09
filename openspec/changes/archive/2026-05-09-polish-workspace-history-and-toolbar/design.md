## Context

This change refines the existing repo workspace rather than introducing a new feature area. The affected surfaces already exist in the frontend: `TopToolbar` manages repository and branch selectors plus action buttons, `CommitList` owns commit-table state and row selection, `RepoTabLayout` coordinates the visible workspace panels, and `TableVirtualResizable` defines column sizing and resize affordances.

The current implementation has three main issues. First, the commit table uses only fixed-width columns, so the message column cannot expand into the remaining horizontal space. Second, workspace interactions are slightly sticky because selecting a commit row opens the detail view but there is no symmetric deselect behavior. Third, visible workspace copy is inconsistent because several labels and empty states are still in Spanish. These are all frontend concerns and should be solved without changing the Tauri Git API that already matches `git log` semantics.

## Goals / Non-Goals

**Goals:**
- Make the commit message column absorb remaining table width while preserving fixed widths for the supporting columns.
- Reduce the visual weight of column resize handles without removing resize functionality.
- Make commit selection toggleable: clicking the selected row again or pressing `Esc` should clear selection and hide the detail view.
- Simplify the top toolbar by removing `Undo` and `Redo` and right-aligning the remaining actions.
- Normalize visible workspace copy to English on the repo workspace surfaces covered by this change.

**Non-Goals:**
- Redesigning the new-tab / launchpad experience.
- Changing Git history retrieval, pagination, or backend commit-list semantics.
- Introducing a full localization framework or translation layer in this change.
- Reworking unrelated workspace visuals such as branch graph rendering or diff content layout.

## Decisions

Keep the change frontend-only. The desired behavior is layout, copy, and interaction polish on top of existing history data, so no backend or shared data-contract changes are needed. This keeps the work low-risk and preserves the current `git log` / `first parent` behavior that was just stabilized.

Teach the table component to support one flexible column instead of faking it with larger fixed widths. The message column should be explicitly marked as the grow column, while SHA, date, author, history badges, and file count stay fixed-width. This is more predictable than hard-coding a larger message width because it adapts to wider and narrower layouts without repeated tuning.

Implement deselection at the `CommitList` level and let `RepoTabLayout` continue responding to selected-commit store state. `CommitList` already owns row click state and keyboard navigation, so it is the right place to interpret “click same row again” and `Esc` as “clear selected row and clear selected commit in the tab store.” This avoids duplicating selection logic across layout components.

Treat English copy as a visible-string cleanup, not as infrastructure work. The change should update hard-coded workspace strings directly where they are rendered. A broader i18n strategy can still happen later, but introducing one here would expand the scope far beyond the requested UI polish.

Right-align toolbar actions by changing the existing `TopToolbar` grouping instead of rebuilding the shell layout. The repository and branch selectors should stay on the left, while pull/push/branch/stash and related actions move into a trailing action group aligned with the commit workspace. Removing `Undo` and `Redo` should happen at the same time so the toolbar becomes simpler rather than merely rearranged.

## Risks / Trade-offs

- [Flexible column support may complicate the existing table sizing logic] -> Limit the change to a single explicit grow column and preserve current fixed-width behavior for all other columns.
- [Deselect-on-second-click may surprise users accustomed to sticky selection] -> Apply the same clear behavior on `Esc` so the interaction model stays consistent and easy to learn.
- [App-wide English wording could sprawl into unrelated screens] -> Scope this pass to workspace-facing text on the repo view and leave launchpad/new-tab copy for the separate redesign change.
- [Toolbar re-alignment could create spacing regressions on narrow widths] -> Keep the existing left-side selector footprint and only rebalance the action groups, preserving current top-level sizing constraints.
