## Why

The current diff flow splits the experience between the main workspace and a modal inspector, which makes file review and line staging feel detached from the pane structure the user is already working in. Moving diff inspection into inline pane replacements simplifies the interaction model and lets diff viewing follow the hierarchy of the existing layout.

## What Changes

- Replace working-tree file diff opening from a modal with an inline diff view that takes over the entire right workspace.
- Replace commit-file diff opening from a modal with an inline diff view that replaces only the middle history pane while keeping commit details visible.
- Reuse the same diff-viewer surface for both inline hosts, preserving close controls, `Esc` dismissal, split/unified display modes, and working-tree line selection behavior.
- Persist repo-scoped inline diff workspace state so remounting restores the user context through selection state rather than hidden mounted components.

## Capabilities

### New Capabilities
- `inline-pane-diff-workspace`: Defines how inline diff viewers replace the appropriate workspace panes for working-tree and commit-file inspection.

### Modified Capabilities
- `working-tree-diff-modal`: Replace modal-only working-tree diff opening requirements with inline right-workspace diff behavior.
- `workspace-ui-persistence`: Persist repo-scoped diff workspace modes and selected diff targets needed to restore inline diff context.

## Impact

- Affected code: `src/components/repo-tab-layout/RepoTabLayout.tsx`, `src/components/changes-panel/ChangesPanel.tsx`, `src/components/diff-viewer/*`, and repository-scoped state in `src/store/repo.ts` and/or `src/store/workspaceUi.ts`.
- Affected UX: file click behavior in current changes and commit changes, right-pane replacement rules, and diff close/restore behavior.
- No backend API changes are expected; the work is primarily state and layout orchestration around the existing diff viewer.
