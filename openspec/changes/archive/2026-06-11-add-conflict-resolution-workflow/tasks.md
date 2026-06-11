## 1. Backend Conflict Domain

- [x] 1.1 Add Rust conflict domain types for summaries, file detail, content kinds, conflict kinds, conflict regions, size metadata, line-ending metadata, and validation signatures.
- [x] 1.2 Add a `src-tauri/src/git/conflicts` module split into list, detail, resolve, and types files.
- [x] 1.3 Implement conflict summary loading from unmerged index entries with stable path ordering, conflict counts, conflict kinds where available, and file signatures.
- [x] 1.4 Implement conflict detail loading from Git stages 1/2/3 plus current worktree result content, including missing-stage and non-text metadata.
- [x] 1.5 Implement line-range loading for very large read-only conflict panes.
- [x] 1.6 Implement result write, accept-side, and mark-resolved commands with expected-signature validation.
- [x] 1.7 Register conflict commands with Tauri and add Rust tests for normal text, add/add, modify/delete, missing base, binary, stale signature, and mark-resolved cases.

## 2. Shared Frontend Contracts

- [x] 2.1 Add shared conflict types under `src/shared/types` for summaries, details, content ranges, AI candidate scopes, and stale errors.
- [x] 2.2 Add typed conflict API adapters under `src/shared/api/git/conflicts.ts`.
- [x] 2.3 Extend working-change status typing to include a named `conflicted` state without normalizing it to `modified`.
- [x] 2.4 Add adapter and type tests for command names, payload shapes, stale errors, and conflict size metadata.

## 3. Current Changes Conflict Listing

- [x] 3.1 Update Current Changes summary loading to include conflict summaries without loading full conflict content.
- [x] 3.2 Render a `Conflicts` section before tracked and untracked sections in flat and tree explorer modes.
- [x] 3.3 Add conflict row status icon, labels, selection behavior, and disabled normal staging controls.
- [x] 3.4 Preserve existing tracked/untracked explorer behavior when no conflicts are present.
- [x] 3.5 Add frontend tests for conflict grouping, tree rendering, row selection, disabled staging controls, search, and refresh behavior.

## 4. Conflict Resolution Workspace

- [x] 4.1 Add repository workspace state for a conflict resolution right-workspace mode and selected conflicted path.
- [x] 4.2 Add a conflict resolution surface shell under `src/features/working-changes/components/conflict-resolution-surface`.
- [x] 4.3 Add hooks for conflict file detail loading, stale detail invalidation, refresh, and selected conflict navigation.
- [x] 4.4 Add close/restore behavior so conflict resolution does not discard normal history or working-diff state.
- [x] 4.5 Add tests for selecting conflicts, switching between conflict and normal working diff files, closing the surface, and resolving selected-file disappearance.

## 5. Conflict Panes And Result Editing

- [x] 5.1 Add read-only incoming/current pane components with full-file context, conflict highlighting, scroll-to-conflict behavior, and virtualized rows for large files.
- [x] 5.2 Add range-loaded read-only pane behavior for very large files.
- [x] 5.3 Add `@monaco-editor/react` and lazy-load Monaco only inside the result editor component.
- [x] 5.4 Add result editor dirty-state tracking, language inference, save behavior, and unsupported-content fallback UI.
- [x] 5.5 Add accept-current and accept-incoming actions for supported conflict regions and whole-file cases.
- [x] 5.6 Add mark-resolved behavior that saves or blocks unsaved edits, validates signatures, and refreshes Current Changes after success.
- [x] 5.7 Add component and hook tests for rendering, dirty state, save, stale errors, side acceptance, mark-resolved, and unsupported content.

## 6. Scoped AI Conflict Fixes

- [x] 6.1 Extend local AI request/result types to represent per-conflict and per-file conflict candidate scopes.
- [x] 6.2 Add backend AI context building for selected conflict-region and selected-file scopes with context-budget handling for large files.
- [x] 6.3 Update local model prompt/output parsing to return reviewable candidate replacements or full-file result candidates.
- [x] 6.4 Update external-agent conflict prompts to include scoped task metadata and preserve read-only instructions.
- [x] 6.5 Add conflict-surface AI controls for per-conflict and per-file fix actions with setup, loading, error, and refresh states.
- [x] 6.6 Add explicit AI candidate review/apply behavior with signature validation and no automatic mark-resolved.
- [x] 6.7 Add backend and frontend tests for scoped AI context, candidate rendering, stale candidate rejection, very-large-file limits, and engine selection.

## 7. Edge Cases And Polish

- [x] 7.1 Add tailored UI states for add/add, modify/delete, deleted-side, binary, symlink, submodule, and missing-stage conflicts.
- [x] 7.2 Preserve line endings and final-newline behavior when writing result content.
- [x] 7.3 Add external-editor guidance for unsupported or too-large editable result files.
- [x] 7.4 Add conflict count and previous/next unresolved conflict indicators in the surface toolbar.
- [x] 7.5 Review whether the existing repository-wide `Suggest conflicts` commit-menu action should remain, move, or be removed after scoped AI is available.
- [x] 7.6 Add VS Code-style result base projection, pending-region tracking, and display-only alignment padding rows.
- [x] 7.7 Add a result reset action that restores the initially loaded conflict projection and preserves current write signatures.
- [x] 7.8 Constrain conflict surface content so pane/editor overflow stays inside the merge workspace.
- [x] 7.9 Add inline accepted-region remove actions and keep opposite-side replacement actions available.
- [x] 7.10 Avoid showing `1 conflict` in conflict rows when the count only means the path is conflicted.
- [x] 7.11 Move file-level accept actions into the matching incoming/current pane headers and widen conflict action spacing.
- [x] 7.12 Show region actions for all unresolved side-pane conflict blocks and remove per-line highlight borders.
- [x] 7.13 Add a shared Monaco theme registry with Ayu Dark as the default editor theme.

## 8. Verification

- [x] 8.1 Run focused Rust tests for conflict list/detail/resolve and AI conflict context.
- [x] 8.2 Run focused frontend tests for working changes conflict listing, conflict resolution surface, shared adapters, and local AI integration.
- [x] 8.3 Run `pnpm run lint`, `pnpm test`, and `pnpm run build`.
- [x] 8.4 Run `cargo test` from `src-tauri`.
- [x] 8.5 Run OpenSpec validation/status checks for `add-conflict-resolution-workflow`.
