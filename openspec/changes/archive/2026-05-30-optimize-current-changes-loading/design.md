## Context

The Current Changes flow currently uses one broad backend command to return every changed file with full working-tree hunks and staged selection details. That command walks `git status`, loads a working diff per file, then loads cached/index diffs per file to infer staged line state. The frontend then builds the explorer tree, folder checkbox state, staged-line store, and selected inline diff from the same full payload.

This works for small repositories but scales poorly when a working tree contains many changed files or large generated diffs. It also makes refresh events expensive: realtime watcher bursts, staging operations, commits, and stash actions can all request the same full snapshot, and older responses are not explicitly prevented from applying after newer ones.

Existing constraints still apply:
- React components must consume typed adapters rather than raw Tauri invokes.
- Backend Git work should remain behind mockable `src/shared/api` adapters.
- Immediate staging and external index synchronization must remain correct.
- The UI must remain dense and app-like; optimization should reduce work without changing the user-facing workflow.

## Goals / Non-Goals

**Goals:**
- Make the Current Changes sidebar summary-first so it can render without full hunk payloads for every file.
- Load full working-tree hunks and exact staged-line state only for files that need a diff surface or precise line selection.
- Reduce backend command/process fan-out by batching summary and staged-state work where practical.
- Coalesce overlapping refresh requests and prevent stale responses from replacing newer Current Changes state.
- Keep large changed-file lists and large selected diffs responsive through bounded rendering work.
- Preserve existing immediate staging, external staged-state sync, folder actions, and inline working-diff behavior.

**Non-Goals:**
- Replacing the diff renderer design or changing diff semantics.
- Changing commit history optimization behavior.
- Adding a new Git dependency.
- Changing the visual design of the Current Changes pane beyond what is necessary for virtualization or loading states.
- Removing the existing full-payload command until all callers are migrated and tests prove the replacement behavior.

## Decisions

### 1. Split summary data from file detail data

Introduce a summary-first backend contract for Current Changes:
- Summary response: file path, status, insertion/deletion counts when available, and lightweight staged summary for checkbox/folder state.
- Detail response: full hunks for one working-tree file plus exact staged-line selection for that file.

Rationale: The explorer usually needs only file metadata and staging summary. Full line content is only needed by the selected inline diff, context expansion, and line-level staging controls.

Alternative considered: Keep the existing full response and optimize React rendering only. That still leaves the dominant backend and serialization cost in place for large repositories.

### 2. Keep staged-state ownership in the backend

The backend remains responsible for deriving staged state from the Git index. The frontend should not compute staged Git diffs during render. Summary data can expose file-level states such as unchecked, partially staged, whole-file staged, or staged new file. Detail data exposes exact hunk/line selections for the selected file.

Rationale: This preserves external index staging sync while allowing the common file-list path to stay lightweight.

Alternative considered: Move staged-line inference entirely to frontend stores. That would duplicate Git semantics in UI code and make external staging harder to trust.

### 3. Batch backend summary and index work

Summary loading should avoid per-file Git process fan-out. The backend should prefer combined status/diff operations and parse grouped output once, or use libgit2 APIs where they produce equivalent behavior more simply. File-detail loading can remain targeted to one file.

Rationale: A 500-file working tree should not require hundreds of child process invocations before the sidebar can update.

Alternative considered: Parallelize existing per-file calls. Parallelization hides some latency but increases process churn and does not reduce total work.

### 4. Add request coalescing at the Current Changes hook boundary

`refreshChanges` should serialize active summary refreshes. If another refresh is requested while one is in flight, the hook should mark a pending rerun and execute at most one follow-up refresh after the current request settles. Each response should carry a local request id so stale responses cannot replace newer state.

Rationale: Realtime events and staging actions can arrive in bursts. Coalescing avoids duplicate backend work and prevents older snapshots from winning races.

Alternative considered: Debounce all refresh triggers. Debounce alone can delay user-visible staging feedback; coalescing preserves prompt first-load and post-action refreshes.

### 5. Store detail state separately from summary state

The working changes feature should keep summaries and per-file details as separate state:
- Summary list drives the explorer.
- Detail cache maps file paths to hunks and exact staged-line state.
- Selecting a file requests detail if missing or stale.
- Refreshing the summary invalidates or version-checks detail entries for affected files.

Rationale: This keeps the sidebar stable while allowing the selected diff to stay accurate.

Alternative considered: Embed optional hunks in summary rows as they are loaded. That makes row identity and cache invalidation harder to reason about and risks reintroducing large list updates.

### 6. Bound render work for large lists and diffs

The explorer should use a flattened visible-row model for virtualization in both flat and tree modes. Folder rows should carry precomputed descendant/aggregate data from tree building instead of repeatedly walking children during render. The diff surface should avoid mounting unbounded line counts at once, either through virtualization or a clear large-diff cap with targeted loading.

Rationale: Backend savings are not enough if the UI still mounts thousands of rows or repeatedly recomputes folder state.

Alternative considered: Rely on React memoization. Memoization helps unchanged rows, but initial large renders and recursive descendant walks remain expensive.

### 7. Batch multi-file staging operations

Folder and bulk staging should use backend batch commands when the operation is naturally a set of paths. Single-file and line-level staging keep targeted commands.

Rationale: Folder staging currently loops file-by-file from the frontend. A backend batch command reduces command overhead and keeps error handling centralized.

Alternative considered: Use `stageAll` for folder operations. That is not scoped enough and can stage unrelated changes.

## Risks / Trade-offs

- [Risk] Summary and detail responses can drift if files change between requests. -> Mitigation: include a summary version or file signature and make detail responses validate against the latest selected path/signature where practical.
- [Risk] Lazy detail loading may briefly show a loading state after selecting a file. -> Mitigation: keep the previous selected diff visible until the new detail request starts, then show a small inline loading state in the diff pane only.
- [Risk] Exact staged-line state is not available for all files immediately after summary load. -> Mitigation: summary must still provide enough file/folder staged state for checkbox correctness; exact line state loads before editable diff interaction.
- [Risk] Virtualization can break selection reveal, keyboard navigation, or context menu positioning. -> Mitigation: keep stable absolute row indexes and test selection reveal in flat and tree modes.
- [Risk] Batch staging can partially fail. -> Mitigation: backend batch responses should fail atomically where Git allows it, or return path-level failures that the UI surfaces without silently desynchronizing optimistic state.
- [Risk] Maintaining the legacy full changes command during migration can duplicate paths. -> Mitigation: migrate through typed adapters, keep tests around both behavior and command payload shapes, then remove legacy callers in a final cleanup task.
