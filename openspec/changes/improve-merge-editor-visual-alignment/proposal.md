## Why

The merge editor now exposes the right conflict data, but the visual model still makes some regions hard to inspect: side/result identity is mostly implicit, inline accept actions can obscure source lines, and synchronized scrolling follows raw pixel offsets even when the two sides have different line counts. These issues make complex conflicts harder to compare and increase the chance that users accept a side without seeing the affected code clearly.

## What Changes

- Add consistent visual identity for `Incoming`, `Current`, and `Result` across pane headers, conflict highlights, overview markers, action widgets, and accepted-region UI.
- Reserve display-only, non-numbered vertical space for side-pane conflict action rows so actions such as `Accept Incoming | Accept Combination | Ignore` never cover source text.
- Improve linked scrolling so the read-only `Incoming` and `Current` panes stay visually aligned around matching conflict regions, including regions where one side has inserted, removed, or expanded lines.
- Preserve the existing result-editor synchronization behavior unless implementation evidence shows it creates worse review ergonomics; the primary alignment requirement is for the two side panes.
- Keep all visual alignment rows display-only and ensure they are never written to the worktree result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `merge-conflict-resolution`: Clarifies merge-editor visual identity, side-pane action spacing, and linked side-pane scroll alignment requirements.

## Impact

- Working changes frontend feature: conflict resolution surface, read-only side panes, result editor, side/result headers, conflict action widgets, and colocated tests under `src/features/working-changes`.
- Shared frontend constants/types may be added near the conflict feature for side/result visual identity.
- Monaco integration: read-only side panes will likely need Monaco view zones or equivalent display-only spacing for action rows and alignment rows.
- Range-loaded large-file side panes may need parallel spacing/alignment treatment where feasible without loading full files.
- No backend API or persisted data changes are expected.
