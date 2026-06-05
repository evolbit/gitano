## Why

Merge conflicts currently surface as ordinary working-tree changes or AI-only suggestions, which leaves users without a guided way to inspect, edit, and mark conflicted files as resolved inside Gitano. Current Changes should make unresolved conflicts explicit, provide a focused split/result workflow, and support AI-assisted candidates without silently modifying repository files.

## What Changes

- Add first-class conflict file discovery to Current Changes, including a dedicated `Conflicts` section and a `conflicted` file state that is not normalized to `modified`.
- Add a conflict resolution surface in the repository right workspace when a conflicted file is selected.
- Render read-only `Incoming` and `Current` full-file context panes above an editable `Result` panel.
- Use lazy-loaded `@monaco-editor/react` only for the editable result panel for supported text conflicts.
- Virtualize full-file conflict context panes for large text files, and use range-loaded virtualization for very large text files.
- Add conflict-specific backend APIs for listing conflicts, loading staged base/current/incoming content, reading/writing result content, accepting sides, and marking a file resolved.
- Add per-conflict and per-file AI fix actions that return reviewable candidate content or replacements without auto-writing files.
- Add stale-write protection through conflict signatures before applying user edits or AI candidates.
- Provide explicit fallback behavior for binary, symlink, submodule, add/add, modify/delete, missing-stage, and externally edited conflicts.

## Capabilities

### New Capabilities

- `merge-conflict-resolution`: Current Changes conflict listing, conflict file detail loading, split/result conflict resolution UI, result editing, mark-resolved actions, large-file behavior, and conflict edge-case handling.

### Modified Capabilities

- `changes-explorer-views`: Current Changes adds a `Conflicts` section and disables normal staging controls for unresolved conflict rows.
- `inline-pane-diff-workspace`: Selecting a conflicted file replaces the right workspace with the conflict resolution surface instead of the normal working-tree diff.
- `current-changes-loading-performance`: Conflict summaries load cheaply, conflict details load lazily, and large conflict files use virtualized or range-loaded content.
- `local-ai-git-analysis`: Merge-conflict AI becomes scope-aware for per-conflict and per-file fix candidates while preserving no-auto-modification safety.

## Impact

- Working changes frontend feature: conflict list presentation, selected conflict state, conflict resolution surface, result editor, AI controls, and colocated tests under `src/features/working-changes`.
- Shared frontend API/types: typed Git conflict adapters and conflict domain types under `src/shared/api/git` and `src/shared/types`.
- Repository workspace state: a new right-workspace mode for conflict resolution and persistence/selection behavior.
- Diff/editor UI: read-only virtualized conflict panes and lazy-loaded Monaco result editor for supported text files.
- Local AI frontend/backend contracts: scoped conflict AI request/result types and stale candidate handling.
- Rust/Tauri Git backend: conflict list/detail/resolve commands, command registration, index-stage reads, worktree writes, signature validation, and Rust tests under `src-tauri/src/git`.
- New dependency: `@monaco-editor/react`, loaded only when the conflict result editor is needed.
