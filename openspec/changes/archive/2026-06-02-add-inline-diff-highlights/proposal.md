## Why

Gitano currently colors added and deleted diff rows, but it does not identify the exact text that changed inside a modified line. That makes small edits, dependency version changes, and typo fixes harder to scan than in mature Git diff tools.

## What Changes

- Add darker inline emphasis inside paired deleted and added diff lines to show the changed text range within the line.
- Apply the inline emphasis in both unified and split diff display modes.
- Keep existing row colors, line-number gutters, wrapping behavior, staging controls, and review-thread anchors unchanged.
- Leave context rows and unmatched added/deleted rows with the existing whole-row tone only.

## Capabilities

### New Capabilities

### Modified Capabilities
- `diff-display-modes`: Diff rows show intra-line changed text emphasis for comparable add/delete pairs in unified and split modes.

## Impact

- Affected frontend code: `src/features/diffs/components/diff-hunk`.
- No backend, Tauri command, Git adapter, or dependency changes are expected.
- Tests should cover range calculation and rendering in both unified and split modes.
