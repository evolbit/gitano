## Why

Working-tree file diffs and committed-file diffs currently use different presentation models, which makes the workspace feel inconsistent and causes unnecessary layout switching in the main view. Reusing the existing diff modal pattern for working-tree files would make diff inspection more focused and keep the commit workspace stable underneath.

## What Changes

- Open working-tree file diffs in a modal instead of replacing the main workspace with an inline diff view.
- Reuse the same modal structure already used for committed files:
  - left panel with the changed file list
  - right panel with the selected file diff and hunks
- Support `Esc` to close the working-tree diff modal.
- Remove the inline working-tree diff presentation path from the repo workspace once the modal flow is in place.

## Capabilities

### New Capabilities
- `working-tree-diff-modal`: Defines how working-tree file diffs are presented in a modal with file navigation and keyboard dismissal.

### Modified Capabilities

## Impact

- Affected code in `src/components/RepoTabLayout.tsx`, `src/components/DiffModal.tsx`, `src/components/DiffViewer.tsx`, and related working-tree diff state handling
- Repo workspace interaction flow for non-committed file inspection
