## Why

The current `Branches` panel uses a standalone visual style that diverges from the shared left-pane panel language used by changes and other explorers. This inconsistency increases visual friction and also makes high-signal branches (`develop/main/stage` families) harder to scan quickly in large branch sets.

## What Changes

- Align the branch panel top controls with shared panel framing by adding a search-first top bar and icon-based local/remote mode controls.
- Align branch tree row styling with shared explorer visual language (hover/selection treatment and color consistency).
- Remove vertical connector rails between tree levels in the branch tree view.
- Add explicit branch priority ordering so key branch families appear at the top:
  - `develop` family (`develop`, `dev`, `development`, etc.)
  - `main` family (`main`, `master`, `production`, etc.)
  - `stage` family (`stage`, `staging`, `uat`, etc.)
  - remaining branches ordered alphabetically.

## Capabilities

### New Capabilities
- `branches-panel-design-parity`: Define shared panel framing and branch-tree visual behavior for the left-pane branches section.

### Modified Capabilities
- `shared-tree-and-path-utilities`: Update branch tree grouping expectations to include deterministic priority ordering for core branch families.

## Impact

- Affected frontend components:
  - `src/components/branch-list/BranchList.tsx`
- Affected shared utilities:
  - `src/utils/branchTree.ts`
- No backend API or git command contract changes.
