## Why

The current-changes diff viewer shows staged line and block selection from Gitano's local staged-state store. That works for staging actions performed inside Gitano, but if the user stages lines or files externally through GitKraken, the Git CLI, or another tool, the working changes refresh while the diff selection visuals stay stale.

That makes the diff viewer disagree with the actual Git index and breaks the expectation that staged lines should appear selected regardless of where the staging action came from.

## What Changes

- Reconstruct current-changes staged selection visuals from the real Git index after working-changes refreshes.
- Ensure externally staged lines and whole-file staged states appear selected in the diff viewer and file checkboxes.
- Keep Gitano's immediate staging interactions, but treat the local staged-state store as a synchronization layer instead of the only source of truth.

## Capabilities

### New Capabilities
- `external-index-staging-sync`: Defines how current-changes staged selections are synchronized from the live Git index.

## Impact

- Affected code in `src/components/DiffViewer.tsx`, `src/components/ChangesExplorer.tsx`, `src/store/staging.ts`, and backend diff/staging helpers in `src-tauri/src/git/`.
- Current-changes selection visuals become consistent with external staging tools.
