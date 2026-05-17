## Context

The branches panel already has a branch context menu with a placeholder compare section, but the current item does not open a useful branch-to-branch comparison workflow. The existing diff viewer supports unified and split presentations, but it mixes data loading, working-tree staging state, and rendering in one component. It can load working-tree, commit, and stash diffs, but it cannot compare arbitrary branch refs.

This change adds a branch comparison modal. The clicked branch is the head/source branch, the modal lets the user choose a base/target branch, and the modal compares the two selected branch tips directly so users see the files changed between those branches. The backend also keeps a merge-base comparison mode so future PR review wrappers can request `base...head` semantics without changing the base renderer. Draft comments are needed now only as modal-session state, but the line anchoring should be compatible with future PR review comments.

## Goals / Non-Goals

**Goals:**
- Add a `Compare to...` branch context menu action for branch nodes.
- Open a modal that compares the clicked source branch against a selectable base branch.
- Use direct branch-to-branch comparison semantics in the modal so the result shows files changed between the selected branch tips.
- Show changed files and lazy-load the selected file diff.
- Keep the branch selector responsive with hundreds of branches by using search, `Local` and `Remote` sections, and virtualized rows.
- Preserve the existing unified and split diff presentations for the branch comparison diff.
- Add draft-only line comments with add, edit, and delete interactions.
- Introduce a base diff renderer boundary with a narrow scoped interaction provider for line-level and block-level extensions.

**Non-Goals:**
- Persisting draft comments after the modal closes.
- Creating, updating, or submitting pull requests.
- Syncing comments with a remote provider.
- Adding intraline highlighting, syntax highlighting, or whitespace display modes.
- Changing working-tree staging semantics.

## Decisions

### Use direct branch comparison in the modal

The branch comparison modal will compare the selected base/target branch tip directly against the clicked head/source branch tip. This matches the menu action wording: users are comparing one branch to another and should see file differences even when the selected target is another feature branch.

The backend still supports a merge-base mode that compares `merge-base(base, head)` against `head`. Future PR-specific wrappers can choose that mode while reusing the same diff renderer and comment extension points.

### Add stateless branch comparison Git commands

Add backend commands for:
- loading changed files for a branch comparison
- loading hunks for one file in a branch comparison

The backend should resolve refs, select the requested comparison mode, and run the relevant diff operation. The frontend should not calculate merge-base state or infer Git object ids. The file list command returns file paths, statuses, insertions, and deletions. The file diff command returns the same `DiffHunk` shape used by the existing diff renderer.

The commands should remain stateless instead of creating a comparison session object. This keeps the Tauri API simple and avoids invalidation complexity. The modal can ignore stale responses with request ids when the user changes the selected base branch or file quickly.

### Keep core diff data explicit and move optional interactions into a provider

Introduce a base diff renderer that receives core inputs explicitly:
- `filePath`
- `hunks`
- `displayMode`
- loading and error state from its wrapper, if needed

The base renderer should be responsible for unified/split layout and for creating stable line anchors. It should not own branch comparison, staging, or comment behavior.

Add a scoped diff interaction provider for optional behavior around rendered lines and blocks. Working-tree wrappers can provide staging interactions. Branch comparison wrappers can provide draft comment actions and thread rendering. Commit and stash wrappers can use no provider or an empty provider.

The provider should stay narrow. It should expose optional line/block interaction hooks and render extension points, not core data such as hunks, selected file, branches, or display mode. This keeps the base renderer clean while avoiding long prop chains through hunk and row components.

### Represent comments with stable line anchors

Draft comments should be keyed by a stable anchor rather than by DOM position. A line anchor should include:
- `filePath`
- `side`: old/new/context as appropriate for the rendered line
- `oldLine`
- `newLine`
- `baseRef`
- `headRef`

The same anchor must resolve across unified and split display modes. Draft comments live in the branch comparison modal state and are keyed by comparison pair so switching the base branch does not show stale comments for a different diff. All draft state is discarded when the modal closes.

### Use a virtualized grouped branch selector

The modal branch selector should fetch local and remote branches in parallel when opened, exclude the source branch, and render a single virtualized result list containing section rows and item rows. Search filters both sections. Empty sections should be hidden when filtering leaves no matches.

Default base selection:
- use the current checked-out branch when it exists and is different from the source branch
- otherwise use the first available local branch excluding the source branch
- otherwise use the first available remote branch excluding the source branch

The selector should use deferred filtering and memoized row models so typing remains responsive.

### Place the modal in the branch feature and reuse shared diff pieces

The user-facing workflow starts from branches, so the modal orchestration belongs under `src/features/branches`. Shared renderer pieces, diff interaction context, and generic diff wrappers belong under `src/features/diffs`. Branch comparison API functions can live in the shared Git API layer and be re-exported through the branch feature API when useful.

## Risks / Trade-offs

- [Diff renderer refactor could regress working-tree staging] -> Keep staging behavior in a wrapper/provider and add focused tests around existing working-tree line/block interactions.
- [React context can cause broad rerenders when comments change] -> Memoize provider values, use stable callbacks, and keep comment lookups keyed by file/line anchors.
- [Large repositories can produce large branch lists and large diffs] -> Virtualize the branch selector, fetch changed files once per comparison, and lazy-load hunks only for the selected file.
- [Remote branch names and local branch names can overlap] -> Preserve section identity in the selector and pass the exact ref string returned by the backend/API.
- [Renamed or deleted files can produce tricky anchors] -> Use the diff line numbers returned by the backend as the source of truth and keep comments attached only to currently rendered lines.
- [Draft comments can become stale when the comparison target changes] -> Scope draft comments by base/head pair and show only comments for the active pair.

## Migration Plan

1. Add branch comparison backend commands and TypeScript API wrappers without changing existing diff callers.
2. Extract the current diff rendering path into a base renderer while preserving existing working-tree, commit, and stash wrappers.
3. Add the branch comparison modal and wire the branch context menu action to open it.
4. Add draft comment interactions through the scoped diff interaction provider.
5. Verify existing working-tree, commit, and stash diff flows still render and interact correctly.

Rollback is straightforward because the new modal and backend commands are additive. If the renderer refactor causes a regression, the branch comparison modal can remain unwired while existing wrappers are restored.

## Open Questions

- None. Current decisions: comments are draft-only, the clicked branch is the head/source, the dropdown branch is the base/target, the modal uses direct branch comparison, merge-base mode remains available for future PR wrappers, and the branch selector is grouped into local and remote sections with search and virtualization.
