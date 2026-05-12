## 1. Inline diff workspace extraction

- [x] 1.1 Extract a reusable inline diff surface from the current modal diff flow
- [x] 1.2 Keep shared diff interactions intact across working-tree and commit-file usage, including close, `Esc`, and split/unified modes

## 2. Working-tree pane replacement

- [x] 2.1 Replace working-tree modal opening with top-level right-workspace replacement in `RepoTabLayout`
- [x] 2.2 Enable current changes pane file checkboxes for the inline working-tree diff workflow
- [x] 2.3 Ensure live working changes refresh rebinds the inline working-tree diff by file path

## 3. Commit history pane replacement

- [x] 3.1 Replace commit-file modal opening with middle-pane diff replacement while keeping commit details visible
- [x] 3.2 Preserve selected commit state so remounting the history workspace restores commit details naturally

## 4. Repo-scoped workspace restoration

- [x] 4.1 Persist repo-scoped inline diff workspace modes and selected diff targets
- [x] 4.2 Restore the correct pane layout when repositories are reopened or when inline diffs are closed
