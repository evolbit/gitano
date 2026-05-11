## 1. Local helper extraction

- [x] 1.1 Move `ChangesExplorer`-specific pure transforms into `changes-explorer/utils.ts` without changing their behavior
- [x] 1.2 Keep any helpers that are not reused by other components local to the `changes-explorer` folder rather than promoting them to shared utilities
- [x] 1.3 Preserve the existing file normalization, partitioning, checkbox, and selection behavior after the helper split

## 2. Render boundary extraction

- [x] 2.1 Extract the file row and folder row renderers into memoizable module-level components
- [x] 2.2 Extract the explorer menu rendering into a separate module while keeping the parent as the state and subscription owner
- [x] 2.3 Ensure the extracted row and menu modules receive derived props only and do not introduce new independent subscriptions

## 3. Hook separation and wiring

- [x] 3.1 Move only stateful or effect-driven explorer behavior into `changes-explorer/hooks.ts` when it improves readability
- [x] 3.2 Keep scroll reveal, menu positioning, and refresh-related timing behavior working exactly as before
- [x] 3.3 Preserve flat/tree view switching, folder expansion, staging behavior, and modal rebinding after the split

## 4. Performance validation

- [x] 4.1 Verify that scroll responsiveness remains stable on large change lists after the module split
- [x] 4.2 Verify that the refactor does not introduce visible rerender regressions or change explorer ordering/grouping
- [x] 4.3 Confirm the refactored explorer still behaves the same in both the main workspace and working-tree modal surfaces
