## Why

The commit list currently shows a raw branch-tip history that can diverge significantly from what users expect when they select a branch. The table controls are also not aligned with that workflow, so the UI should focus on branch-relative history and expose a clear mode selector instead of unrelated action buttons.

## What Changes

- Change branch history retrieval to show commits relative to an inferred base branch instead of walking the entire selected branch ancestry.
- Infer a base branch for the selected branch, compute the merge-base, and use that divergence point as the default commit scope.
- Add a view-mode selector in the commit table controls so users can switch between `First parent` and `Everything`.
- Show the inferred base branch in the commit table UI so users can understand the comparison context.
- Keep the search box at the top of the commit table and remove the `Añadir manualmente` and `Filtros` buttons.
- Reload the commit list from the backend when branch selection or history mode changes.

## Capabilities

### New Capabilities
- `branch-relative-history`: Defines branch-relative commit history based on an inferred base branch, merge-base calculation, and selectable history modes in the commit table UI.

### Modified Capabilities

## Impact

- Affected frontend code includes `src/components/CommitList.tsx` and branch-selection flows that trigger commit reloads.
- Affected backend code includes `src-tauri/src/git/commits.rs` and any supporting Git utilities needed for base-branch inference and merge-base-based history filtering.
- The commit table controls will be simplified to search plus history controls, removing the `Añadir manualmente` and `Filtros` buttons.
