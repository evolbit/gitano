## 1. Live Modal File List

- [x] 1.1 Update the working-tree modal flow so the modal file list always reflects the latest `changes` from the live working-changes source.
- [x] 1.2 Verify newly detected files, including untracked files, appear in the modal without closing and reopening it.

## 2. Selection Rebinding

- [x] 2.1 Preserve working-tree modal selection by file path across working-changes refreshes.
- [x] 2.2 Rebind the modal diff pane and file hunks to the refreshed file entry when the selected path still exists.
- [x] 2.3 Close or clear the modal only when the selected path no longer exists in the refreshed working changes.

## 3. Verification

- [x] 3.1 Verify repository changes made while the modal is open appear both in the main current-changes sidebar and in the modal file list.
- [x] 3.2 Verify staging or unstaging from the modal keeps the modal file list synchronized after refresh.
- [x] 3.3 Verify modal navigation still works correctly while the live working-changes list updates.
