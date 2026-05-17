## Why

Branch context menus currently contain commit-specific placeholder actions that only close the menu, which makes the UI misleading. Commit actions need to live on commit rows where the target commit is explicit and the action labels can reflect Git semantics accurately.

## What Changes

- Remove unimplemented commit-specific actions from the branch context menu: `Cherry pick commit`, `Reset ... to this commit`, and `Revert commit`.
- Add a row-specific context menu to commit rows in the history table.
- Group commit actions by intent: commit copy actions, explicit comparison modals, creation from commit, applying a commit to the current branch, remote commit links, and future rewrite-history actions.
- Implement the safe first-pass commit actions and keep rewrite-history actions out of scope for this change.
- Add confirmation UX for operations that change repository state, such as cherry-pick and revert.

## Capabilities

### New Capabilities
- `commit-row-context-menu`: Defines the commit-row context menu, its action groups, enabled behavior, confirmation requirements, remote URL behavior, and branch-menu cleanup for commit-only actions.

### Modified Capabilities
- None.

## Impact

- Frontend commit history table row interaction and context-menu state.
- Branch context menu presentation.
- Frontend Git API wrappers for commit actions and patch/URL helpers.
- Tauri Git command surface for cherry-pick, revert, patch generation, and commit URL support where existing commands are insufficient.
- Tests for menu rendering, command payloads, and action availability.
