## 1. State Granularity

- [x] 1.1 Narrow diff selection subscriptions so a single line toggle does not invalidate the whole file view.
- [x] 1.2 Keep staged selection reads compatible with the existing staging store behavior.

## 2. Hunk Rendering

- [x] 2.1 Memoize static hunk-derived structures such as stageable blocks and split rows.
- [x] 2.2 Ensure unified and split renderers only rerender affected hunks when selection changes.

## 3. Interaction Path

- [x] 3.1 Keep click selection visually immediate.
- [x] 3.2 Keep drag selection visually immediate while preserving the existing sync-on-mouseup behavior.

## 4. Verification

- [x] 4.1 Verify single-line clicks feel responsive in large working-tree diffs.
- [x] 4.2 Verify block selection remains responsive in both unified and split modes.
- [x] 4.3 Verify drag selection remains correct and responsive after the optimizations.
