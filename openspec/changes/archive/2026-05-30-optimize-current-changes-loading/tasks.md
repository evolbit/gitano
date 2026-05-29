## 1. Backend Contracts

- [x] 1.1 Add Rust response/request types for Current Changes summaries, file detail, staged summaries, and batch path staging operations near the owning Git adapter types.
- [x] 1.2 Implement a summary-first Tauri command that returns changed-file metadata and lightweight staged state without full hunks for every file.
- [x] 1.3 Replace per-file index diff fan-out in the summary path with combined or libgit2-backed staged summary work where practical.
- [x] 1.4 Implement a targeted working-file detail command that returns full hunks and exact staged-line state for one file.
- [x] 1.5 Implement scoped batch stage and unstage commands for path sets or folders used by Current Changes bulk actions.
- [x] 1.6 Register new Tauri commands and add Rust tests for summary loading, detail loading, staged-state inference, stale/missing files, and batch staging failures.

## 2. Frontend API Layer

- [x] 2.1 Add TypeScript request/response types for Current Changes summary, file detail, staged summary, and batch staging in `src/shared/types` or the owning adapter files.
- [x] 2.2 Add typed `src/shared/api/git` adapter functions for the new Tauri commands and keep command names centralized.
- [x] 2.3 Add adapter tests that assert command names, payload shapes, and returned typed contracts.
- [x] 2.4 Keep legacy adapter behavior available only where still required during migration, with tests preventing mixed summary/detail payload assumptions.

## 3. Working Changes State And Refresh Lifecycle

- [x] 3.1 Split working changes state so summaries drive the explorer while per-file detail is cached separately by file path and freshness signature.
- [x] 3.2 Update `useWorkingDirectoryChanges` or its replacement to coalesce in-flight refreshes, queue at most one pending rerun, and ignore stale responses.
- [x] 3.3 Preserve staged file and folder checkbox state from summary data without requiring exact staged-line maps for every file.
- [x] 3.4 Load selected-file detail on demand and invalidate or refresh cached detail when the latest summary indicates that file changed.
- [x] 3.5 Add hook/store tests for initial summary load, overlapping refreshes, stale response rejection, staged summary updates, and selected-file detail invalidation.

## 4. Explorer Rendering And Bulk Actions

- [x] 4.1 Introduce a flattened visible-row model for Current Changes flat and tree views that supports virtualization, selection reveal, context menus, and scroll restoration.
- [x] 4.2 Precompute or memoize folder descendant lists and aggregate staged state outside folder row rendering.
- [x] 4.3 Update folder and bulk stage/unstage handlers to call the new batch adapters and reconcile state from a refresh after the backend operation settles.
- [x] 4.4 Add component and utility tests for virtualized flat rows, virtualized tree rows, folder aggregate state, selection reveal, and batch operation error recovery.

## 5. Inline Working Diff Detail Flow

- [x] 5.1 Update repo workspace composition so opening a Current Changes file requests working-file detail rather than reading hunks from the summary row.
- [x] 5.2 Show a scoped loading/error state in the inline working diff pane while selected-file detail loads without blocking the sidebar.
- [x] 5.3 Ensure lazy-loaded detail populates exact staged-line state before editable line or block staging interactions are enabled.
- [x] 5.4 Add bounded rendering behavior for very large selected diffs through virtualization or a clear large-diff cap with supported staged interactions.
- [x] 5.5 Add tests for opening a summary-only file, switching selected files, refreshing while inline diff is open, disappeared selected files, and large-diff rendering boundaries.

## 6. Verification And Cleanup

- [x] 6.1 Remove or narrow legacy full working-directory changes usage after all Current Changes callers are migrated.
- [x] 6.2 Verify existing specs for immediate staging, external index sync, working-tree inline diff, and changes explorer refresh responsiveness still pass.
- [x] 6.3 Run `pnpm run lint`, `pnpm test`, and `pnpm run build` for frontend changes.
- [x] 6.4 Run `cargo test` from `src-tauri` for backend changes.
- [ ] 6.5 Manually verify Current Changes behavior in a repository with many changed files, partial external staging, folder staging, and a large selected diff.
