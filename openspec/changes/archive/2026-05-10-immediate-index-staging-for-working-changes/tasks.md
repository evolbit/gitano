## 1. Backend Stage/Unstage Operations

- [x] 1.1 Review the current partial staging backend and define the missing immediate unstage operations needed for modified, untracked, and deleted working-tree changes.
- [x] 1.2 Add backend commands for the required immediate unstage behavior and ensure existing stage commands can be used incrementally from UI interactions.

## 2. Frontend Source of Truth Shift

- [x] 2.1 Update working-changes selection flows so line/block/file interactions call backend stage/unstage commands immediately.
- [x] 2.2 Refresh working changes and diff state after immediate stage/unstage operations so the UI reflects the real Git index.
- [x] 2.3 Reduce or reshape the local staged selection store so it no longer behaves like an independent deferred staging plan.

## 3. Commit Flow Simplification

- [x] 3.1 Simplify commit behavior so it commits already-staged content instead of staging deferred UI selections at commit time.
- [x] 3.2 Ensure commit validates that staged content exists before committing.

## 4. Verification

- [x] 4.1 Verify tracked modified line/block selection stages and unstages immediately.
- [x] 4.2 Verify untracked and deleted file checkboxes stage and unstage immediately at file level.
- [x] 4.3 Verify commit consumes already-staged content without reapplying deferred staging logic.
