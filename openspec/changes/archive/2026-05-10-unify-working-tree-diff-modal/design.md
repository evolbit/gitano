## Context

The repo workspace currently handles committed-file diffs and working-tree-file diffs differently. Committed files open in `DiffModal`, which provides a focused two-pane experience with the changed file list on the left and the selected diff on the right. Working-tree files instead replace the main workspace content with an inline `DiffViewer`, which causes a different interaction model and unnecessary layout switching.

The codebase already has most of the reusable pieces:

- `ChangesPanel` opens committed-file diffs through `DiffModal`
- `DiffModal` already supports both committed and non-committed diffs because `sha` is optional
- `DiffViewer` already switches between commit and working-tree behavior based on the presence of `sha`

The main inconsistency is in `RepoTabLayout`, which still treats working-tree file inspection as a full inline mode.

## Goals / Non-Goals

**Goals:**
- Reuse `DiffModal` for working-tree file diffs so committed and non-committed files share the same presentation pattern.
- Keep the main repo workspace stable underneath the modal instead of replacing it with an inline diff view.
- Preserve keyboard dismissal with `Esc`.
- Keep file navigation inside the modal so users can move between changed working-tree files without closing it.

**Non-Goals:**
- Redesigning the committed-file modal flow
- Changing diff-generation logic or hunk-loading behavior
- Introducing a second modal implementation just for working-tree files
- Changing staging semantics beyond moving the presentation into the modal

## Decisions

### Reuse `DiffModal` for working-tree files
The modal already matches the desired UX and already renders `DiffViewer` with an optional `sha`. Reusing it is simpler than building a second working-tree modal and keeps the diff experience visually consistent.

Alternative considered:
- Keep the inline working-tree diff and only restyle it to look more modal-like.
  - Rejected because it preserves the workspace swap and still leaves two different interaction models.

### Remove the inline working-tree diff presentation path from `RepoTabLayout`
`RepoTabLayout` should stop switching the main content to an inline diff view when a working-tree file is selected. Instead, the file selection should control modal open state and chosen initial file while leaving the underlying workspace unchanged.

Alternative considered:
- Keep both inline and modal flows.
  - Rejected because it adds complexity without product value and makes behavior harder to reason about.

### Let the modal accept working-tree file data directly
The modal should accept the working-tree changed-file list and the clicked file as its initial selection. Any current type mismatch between committed-file entries and working-tree entries should be resolved at the modal boundary with a shared compatible shape rather than duplicating modal logic.

Alternative considered:
- Transform working-tree data into a separate modal-specific type before opening.
  - Rejected unless type constraints force it, because the shapes are already close and extra mapping would add avoidable indirection.

### Keep `Esc` dismissal in the modal as the close mechanism
The existing committed-file modal already closes on `Esc`. Working-tree modal usage should follow the same rule so the interaction stays predictable.

## Risks / Trade-offs

- [State coupling between sidebar selection and modal open state] -> Keep modal state local and derive only the initial file from the click, so closing the modal does not destabilize the main workspace.
- [Type friction between `FileChange` and `FileChangeWithHunks`] -> Normalize the modal input shape at one boundary instead of scattering ad hoc casts across the repo workspace.
- [Loss of inline staging context] -> Keep `DiffViewer` behavior unchanged inside the modal so users retain the same hunk-level actions, only in a different presentation shell.
- [Potential modal-state reset when working-tree changes refresh] -> Ensure the selected file remains valid across polling updates, and close only when the chosen file truly disappears from the working tree.
