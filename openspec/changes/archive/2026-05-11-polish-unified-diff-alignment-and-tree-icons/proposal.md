## Why

Several workspace surfaces still feel visually inconsistent under normal use. The toolbar selectors do not stay coupled to the live left sidebar width, unified diff rows do not align as cleanly as split rows, and the commit changes tree compresses folder affordances too aggressively when the panel gets narrow.

## What Changes

- Make the repository and branch selector region in the toolbar follow the live left sidebar width so both surfaces feel like one continuous layout.
- Add visible flat/tree toggle buttons to the current changes panel and commit changes panel instead of relying only on the pane context menu.
- Align unified diff rows with the same top-aligned number/content treatment already used in split view.
- Preserve fixed chevron and folder icon slots in narrow tree rows so commit changed-files icons do not collapse under width pressure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-toolbar-polish`: toolbar selectors must stay visually coupled to the live left sidebar width.
- `changes-explorer-views`: current changes and commit changes must expose visible flat/tree toggle controls.
- `diff-display-modes`: unified rows must align line numbers and content consistently with split view.
- `commit-changes-explorer`: narrow tree rows must preserve stable icon affordances instead of shrinking folder icons.

## Impact

- Affected code: `src/components/TopToolbar.tsx`, `src/components/RepoTabLayout.tsx`, `src/components/ChangesExplorer.tsx`, `src/components/ChangesPanel.tsx`, `src/components/DiffHunk.tsx`
- No backend or API changes.
- No new dependencies.
