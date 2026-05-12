## Context

The current repository workspace has one top-level left pane and one top-level right workspace. The right workspace is itself split into a middle history pane (`CommitList`) and a right details pane (`ChangesPanel`). Working-tree file clicks currently open `DiffModal` above the workspace, while commit-file clicks inside `ChangesPanel` also open `DiffModal`. This change replaces those modal flows with inline pane replacement, but the replacement scope differs by source:

- Working-tree file click: replace the entire right workspace
- Commit-file click: replace only the middle history pane

The user explicitly does not want state preservation through hidden mounted components. Instead, the appropriate panes should mount and unmount normally, while repo-scoped selection and workspace mode state restore the prior context on remount.

## Goals / Non-Goals

**Goals:**
- Reuse a common inline diff surface for both working-tree and commit-file inspection.
- Preserve `selectedCommit` and other meaningful repo-scoped selection state when pane replacement occurs.
- Restore prior workspace context by persisted repo state, not by keeping replaced components mounted but hidden.
- Keep working-tree diff functionality intact, including split/unified switching, close button, `Esc`, and line selection/staging behavior.

**Non-Goals:**
- Redesign commit details editing or commit metadata layout.
- Change backend diff retrieval APIs.
- Persist low-value transient UI state such as focus, scroll position, or temporary searches unless already covered elsewhere.

## Decisions

### Represent pane replacement as explicit workspace modes
The workspace should model diff presentation as pane modes, not as modal booleans tied to individual components.

At minimum, the design needs:
- a top-level right-workspace mode: normal history workspace vs working-tree inline diff
- a nested history-middle mode: commit list vs commit-file inline diff

This keeps the return path explicit:
- closing a working-tree diff restores the normal history workspace
- closing a commit-file diff restores the commit list pane

Alternative considered:
- Keep local boolean modal state in `RepoTabLayout` and `ChangesPanel` and swap rendering opportunistically. Rejected because it preserves the current fragmented ownership model and makes restoration logic harder to reason about.

### Restore workspace context from persisted repo-scoped state
The selected commit already lives in repo-tab state and naturally reopens commit details on remount. The new inline diff workflow should follow the same principle: persist only the minimal repo-scoped mode and selection needed to restore the pane structure.

This avoids relying on hidden mounted components while still preserving context after pane replacement, repository switching, or remount.

Alternative considered:
- Keep replaced panes mounted but hidden so their local state survives. Rejected because it obscures lifecycle behavior, makes the UI tree harder to reason about, and was explicitly ruled out by the desired UX.

### Extract a reusable inline diff surface from the modal flow
The current `DiffModal` mixes portal/modal shell responsibilities with actual diff-viewer behavior. The reusable unit for this change is the inline diff surface: header, close action, `Esc` handling, split/unified mode, file binding, and working-tree staging integration.

The modal wrapper can remain temporarily if needed, but the new inline host should be the primary abstraction.

Alternative considered:
- Embed the full modal component inline and toggle off the overlay. Rejected because it carries modal-specific structure and duplicates file-navigation UI where the workspace already provides the navigator.

### Keep replacement ownership aligned with the source pane
The file list that the user interacts with should determine which pane gets replaced:

- Current changes list drives top-level right-workspace replacement
- Commit changes list drives middle-pane replacement inside the history workspace

This aligns the behavior with the existing layout hierarchy and matches the mental model the user described.

Alternative considered:
- Always render inline diffs in the far-right details pane. Rejected because it breaks the requested hierarchy and would collapse two distinct replacement rules into one misleading host.

## Risks / Trade-offs

- [Fragmented state between repo tab state and workspace UI state] -> Keep the persisted mode model small and clearly separate selection state from presentation state.
- [Refactor churn in `RepoTabLayout` and `ChangesPanel`] -> Extract the reusable diff surface first so pane replacement wiring does not duplicate viewer behavior.
- [Unexpected remount resets in commit history workflow] -> Treat `selectedCommit` as the authoritative restore signal for commit details and only persist additional pane modes where they change user-visible behavior.
- [Users losing orientation when panes swap] -> Keep explicit close affordances and `Esc` support in both inline hosts, and preserve split/unified mode continuity.
