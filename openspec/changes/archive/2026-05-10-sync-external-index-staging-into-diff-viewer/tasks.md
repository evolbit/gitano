## 1. Backend Staged Diff Reconstruction

- [x] 1.1 Add or expose a backend diff path that reports staged changes from `HEAD` to the Git index for a file.
- [x] 1.2 Ensure the staged diff shape can be aligned with the existing editable working diff for line/block reconstruction.
- [x] 1.3 Keep staged diff reconstruction scoped to the current working-changes file set rather than unconditional whole-repo work.

## 2. Frontend Staged-State Synchronization

- [x] 2.1 Rebuild current-changes staged selection state from the live Git index after working-changes refreshes.
- [x] 2.2 Preserve whole-file staged baselines when the staged diff covers the full editable file.
- [x] 2.3 Update file checkbox state and diff viewer selections so they reflect externally staged and externally unstaged changes.
- [x] 2.4 Ensure synchronization runs at refresh/rebind boundaries and does not introduce Git/index work into `DiffViewer` or `DiffHunk` render paths.

## 3. Verification

- [x] 3.1 Verify lines staged outside Gitano appear selected in the current-changes diff viewer after refresh.
- [x] 3.2 Verify whole-file external staging appears as a checked file and fully selected diff.
- [x] 3.3 Verify external unstage operations clear the corresponding staged visuals after refresh.
- [x] 3.4 Verify current-changes click and drag selection responsiveness does not regress after adding external-index synchronization.
