## Why

Gitano currently exposes branch actions but does not give users a focused way to inspect the file-level and line-level differences between two branches before deciding what to do next. Adding a branch comparison modal creates the foundation for PR-style review workflows while keeping the initial comment model lightweight and draft-only.

## What Changes

- Add a `Compare to...` action to branch context menus without appending a target branch name in the menu item label.
- Open a branch comparison modal from the clicked branch, treating that clicked branch as the head/source branch.
- Compare branches directly between the selected base/target branch tip and clicked head/source branch tip.
- Show changed files on the left and the selected file diff on the right.
- Reuse the shared diff presentation so branch comparisons support `Unified` and `Split` display modes.
- Add a performant branch selector inside the modal with a search field, `Local` and `Remote` sections, and virtualized results for repositories with hundreds of branches.
- Default the comparison target/base branch to the current branch when it is available and different from the clicked source branch.
- Support draft-only line comments in the modal, including add, edit, and delete interactions. Draft comments disappear when the modal closes.
- Introduce a scoped diff interaction provider so branch comparison and future PR review behaviors can add line-level UI without putting review-specific logic in the base diff renderer.

## Capabilities

### New Capabilities
- `branch-comparison-review`: Branch-to-branch comparison modal behavior, performant target branch selection, changed-file inspection, and draft line comments.

### Modified Capabilities
- None.

## Impact

- Frontend branch workflow: `src/features/branches` context menu, branch list behavior, and new branch comparison modal components.
- Frontend diff workflow: `src/features/diffs` will need a base diff renderer boundary and a scoped interaction provider for line-level extension points.
- Backend Git API: new Tauri commands for branch comparison file lists and per-file hunks with direct mode for this modal and merge-base mode for future PR-style review wrappers.
- Shared API/types: new branch comparison request/response types for changed files, file diffs, and line comment anchors.
- Performance: branch target selection must use virtualization and deferred filtering to remain responsive with large branch counts.
