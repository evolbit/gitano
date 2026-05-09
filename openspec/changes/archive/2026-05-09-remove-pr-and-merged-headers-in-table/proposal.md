## Why

The commit list currently exposes `PR`, `Mergeado en`, and `CI` fields even though that functionality does not work yet. Removing those traces for now avoids presenting incomplete behavior in the UI and simplifies the commit list data flow until the feature is ready to be implemented properly.

## What Changes

- Remove the `PR` column from the commit list table header and rows.
- Remove the `Mergeado en` column from the commit list table header and rows.
- Remove the `CI` column from the commit list table header and rows.
- Remove `pr`, `merged_in`, and `ci` from the commit list payload and shared frontend/backend types for this workflow.
- Keep commit loading, keyboard navigation, and the rest of the table behavior unchanged.

## Capabilities

### New Capabilities
- `commit-table-columns`: Defines which commit metadata columns are rendered in the commit list table and which ones are intentionally hidden from the UI.

### Modified Capabilities

## Impact

- Affected frontend code includes `src/components/CommitList.tsx` and `src/types/git.ts`.
- Affected Tauri/backend code includes the commit list types and payload assembly in `src-tauri/src/git/types.rs` and `src-tauri/src/git/commits.rs`.
- The reusable table component in `src/components/tables/TableVirtualResizable.tsx` is expected to remain behaviorally unchanged.
- No new dependencies are expected.
