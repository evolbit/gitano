## Why

`ChangesExplorer` has grown into a large mixed-responsibility component, and the current working-changes refresh path rebuilds too much state too often. In practice, that makes the file harder to maintain and causes visible scroll stutter when the repository has many changed files.

## What Changes

- Split the current changes explorer into smaller modules so rendering, local state, pure helpers, and menu actions are easier to read and maintain.
- Keep the existing explorer behavior and surfaces intact, including flat/tree modes, staging controls, context menus, and working-tree modal behavior.
- Make the working-changes refresh path less disruptive by avoiding visible list replacement when the underlying snapshot has not meaningfully changed.
- Preserve all current Git and UI functionality while improving responsiveness during scrolling and periodic refreshes.

## Capabilities

### New Capabilities
- `changes-explorer-refresh-responsiveness`: the changes explorer maintains smooth scrolling and interaction while refreshing live working changes, without forcing unnecessary full-list invalidation.

### Modified Capabilities
- None

## Impact

- Affected code: `src/components/changes-explorer/*`, `src/hooks/useWorkingDirectoryChanges.ts`, and supporting utilities used by the changes explorer refresh path.
- No backend/API changes are expected.
- No user-facing feature changes are intended; this is a maintainability and responsiveness refactor.
