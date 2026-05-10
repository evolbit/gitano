## Why

The app already persists some repo-session data such as open tabs and recent repositories, but most workspace UI state is still lost on restart. Users expect a desktop Git client to reopen in the same window size, restore the same open repositories, preserve pane sizes, remember flat/tree preferences, and keep stable workspace structure choices like sidebar expansion.

## What Changes

- Persist window size and position with safe restore behavior.
- Persist per-repository workspace UI preferences keyed by `repoPath`.
- Persist shared workspace layout settings such as pane widths and left sidebar accordion sections.
- Persist independent `flat | tree` view modes for current changes and commit changes.
- Persist durable tree expansion state for the main workspace sidebar and changes explorer where appropriate.
- Keep transient interaction state out of persistence.

## Capabilities

### New Capabilities
- `workspace-ui-persistence`: The app restores durable window and workspace UI state across relaunches.

### Modified Capabilities
- `repo-layout-sizing`: Window startup should restore persisted bounds while still respecting layout minimums.
- `changes-explorer-views`: Explorer mode and durable expansion state can persist per repository.
- `commit-changes-explorer`: Commit changes view mode can persist per repository independently from working-tree changes.

## Impact

- Affected frontend areas:
  - Zustand persistence/store structure
  - app bootstrap and window initialization
  - repo workspace layout
  - branch tree and changes explorer state ownership
  - commit changes and working-tree changes pane preferences
- Affected persistence boundary:
  - Tauri store file contents and schema
- No Git backend behavior changes are required.
