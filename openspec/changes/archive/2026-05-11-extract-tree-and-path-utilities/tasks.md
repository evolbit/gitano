## 1. Shared utilities

- [x] 1.1 Create reusable path helpers for file name, parent path, and ancestor path lookup
- [x] 1.2 Create reusable tree helpers for branch grouping and compressed file tree construction
- [x] 1.3 Create reusable tree traversal helpers for folder path and file collection

## 2. Component migration

- [x] 2.1 Update `BranchList` to use the shared branch tree helper
- [x] 2.2 Update `ChangesExplorer` to use the shared path and tree helpers
- [x] 2.3 Update `FileListItem` to use the shared path helpers for file path display

## 3. Verification

- [x] 3.1 Verify branch grouping, file tree rendering, and file path display remain unchanged
- [x] 3.2 Verify the refactor does not alter selection, sorting, or tree expansion behavior
