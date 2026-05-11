## Why

The current left pane uses an accordion that spends vertical space on stacked section headers and encourages a structure that does not match how the pane is actually used. Replacing it with bottom navigation makes the primary workspace feel cleaner, gives more room to the active content, and better matches the intended reference layout.

## What Changes

- Replace the left-pane accordion with a single active section area and a bottom navigation bar.
- Add bottom icon navigation for `Changes`, `Branches`, and `Folders`.
- Show only one left-pane section at a time, with a contextual header for the active section.
- Persist the active left-pane section per repository instead of persisting accordion open state.
- Reuse the existing `ChangesExplorer` and `BranchList` content bodies inside the new shell layout.

## Capabilities

### New Capabilities
- `left-pane-bottom-navigation`: Defines the left workspace pane as a single-section view with bottom navigation and contextual section rendering.

### Modified Capabilities
- `workspace-ui-persistence`: Replace persisted left accordion section state with persisted active left-pane section state per repository.

## Impact

- Affected code: `src/components/repo-tab-layout/RepoTabLayout.tsx`, `src/store/workspaceUi.ts`, and the pane shell styling around `ChangesExplorer` and `BranchList`.
- Affected UX: left-pane navigation, section switching, and repository-scoped workspace restoration.
- No backend or external API changes are expected.
