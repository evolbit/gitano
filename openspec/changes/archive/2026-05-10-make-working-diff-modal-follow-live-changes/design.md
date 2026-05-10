## Context

The current changes sidebar in `RepoTabLayout` is backed by `useWorkingDirectoryChanges(repoPath)`, which refreshes live repository changes on an interval and also after immediate staging actions. The working-tree diff modal is opened from that sidebar, but its lifecycle still depends on a selected file object and a prop-fed file list mirror instead of being treated as a live projection of the same current-changes source.

In practice, this creates two classes of state:

- **Live current changes** in the sidebar
- **Modal-local selection and file list state** derived from a snapshot-like handoff

That architecture is fragile when the repository changes while the modal is open.

## Goals / Non-Goals

**Goals:**
- Keep the working-tree diff modal synchronized with the current live working changes while open.
- Preserve the current selected file by path across refreshes whenever possible.
- Update the modal file list when new working changes appear, including new untracked files.
- Close the modal only when the selected path no longer exists in the working changes.

**Non-Goals:**
- Changing committed-file modal behavior
- Changing diff generation or staging semantics
- Reworking polling strategy or refresh cadence
- Introducing a separate fetch path inside the modal itself

## Decisions

### Keep `RepoTabLayout` as the live source of working changes
The main sidebar already owns the live `changes` list through `useWorkingDirectoryChanges`. The modal should continue to consume that same live list via props rather than introducing a second working-changes fetch inside `DiffModal`.

Alternative considered:
- Make `DiffModal` fetch working changes directly.
  - Rejected because it duplicates the current-changes source and risks drift between two polling loops.

### Track modal selection by path, not by stale file object identity
The modal and parent should preserve working-tree selection using the file path as the stable key. When `changes` refresh, the selected file object should be rebound from the fresh list by matching path.

Alternative considered:
- Keep object-reference selection and patch around stale props.
  - Rejected because working-tree refreshes naturally replace file objects, making object identity unreliable.

### Keep the modal open while the selected path still exists
If the selected file is still present in the refreshed working changes, the modal must remain open and rebind to that refreshed file entry. If the selected file disappears, the modal should close or clear selection the same way the main working-tree selection already does.

Alternative considered:
- Close the modal on any working changes refresh.
  - Rejected because it would make the modal unusable during active editing or staging.

### Let the modal list be fully driven by refreshed `changes`
The left pane file list inside the working-tree modal should always render from the latest `changes` passed down from `RepoTabLayout`. New files and removed files should therefore appear or disappear naturally from the same source of truth as the main current-changes pane.

## Risks / Trade-offs

- [Selection bounce during refresh] -> Selection must be keyed by path and rebound deterministically after each refresh.
- [Modal closes unexpectedly on temporary list churn] -> Only close when the selected path is truly absent from the refreshed changes list.
- [Parent/modal coupling remains a little tighter] -> This is acceptable because the parent already owns the authoritative working-changes source.
- [Hunk store drift after selection rebind] -> Refresh-driven file rebinds must continue to update the current file hunks store for the selected path.
