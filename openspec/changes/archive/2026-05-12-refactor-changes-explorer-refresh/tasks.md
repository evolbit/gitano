## 1. Explorer decomposition

- [x] 1.1 Split `ChangesExplorer` into smaller modules for state orchestration, row rendering, and menu rendering
- [x] 1.2 Move component-specific pure helpers into local utility modules or shared utilities as appropriate
- [x] 1.3 Keep `ChangesExplorer` focused on composition and wiring rather than inline helper logic

## 2. Refresh responsiveness

- [x] 2.1 Compare incoming working-changes snapshots against the previous snapshot before publishing state updates
- [x] 2.2 Avoid replacing the visible explorer state when a refresh produces no meaningful file or staged-state change
- [x] 2.3 Keep staged-selection reconciliation bounded to real refresh changes so unchanged polls do not trigger unnecessary rebuilds

## 3. Behavior preservation

- [x] 3.1 Preserve flat/tree view behavior, folder expansion, and context menu actions during the refactor
- [x] 3.2 Preserve working-tree modal rebinding and current-changes staging behavior during refresh changes
- [x] 3.3 Verify scrolling stays smooth and the explorer remains stable when periodic refreshes return unchanged data
