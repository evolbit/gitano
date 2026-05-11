## Why

Several components currently repeat the same pure path and tree-shaping logic inline, which makes the files longer than they need to be and makes future refactors harder. Extracting those helpers into shared utilities now keeps the codebase easier to maintain without changing behavior.

## What Changes

- Extract shared pure helpers for path and tree manipulation into reusable utility modules.
- Reuse those helpers from the branch explorer, changes explorer, and file list rendering paths.
- Keep the visible UI, behavior, and data flow unchanged.
- Prepare the codebase for a later folder-based component split by separating utilities from component rendering concerns.

## Capabilities

### New Capabilities
- `shared-tree-and-path-utilities`: reusable helpers for path splitting, ancestor lookup, tree building, and tree traversal used by component renderers.

### Modified Capabilities
- None

## Impact

- Affected code: `src/components/BranchList.tsx`, `src/components/ChangesExplorer.tsx`, `src/components/FileListItem.tsx`, and new utility modules under `src/components/utils/`.
- No API or backend changes.
- No behavior changes are expected for users; this is a code organization and reuse improvement.
