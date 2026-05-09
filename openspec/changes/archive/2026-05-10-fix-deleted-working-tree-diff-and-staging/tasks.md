## 1. Deleted Working-Tree Diff Construction

- [x] 1.1 Update the working-tree diff builder to return deletion hunks for tracked files that are missing from the working directory.
- [x] 1.2 Reuse or mirror the existing deleted-file hunk construction pattern so deleted files render `Del` lines in the right pane.
- [x] 1.3 Verify deleted working-tree files no longer resolve to an empty hunk list when a deletion diff exists.

## 2. Deleted File Staging Rules

- [x] 2.1 Update the editable diff UI so deleted working-tree files do not render block-level staging controls.
- [x] 2.2 Update the editable diff UI so deleted working-tree files do not render line-level staging controls.
- [x] 2.3 Keep the file-level checkbox enabled for deleted working-tree files and ensure its checked state reflects file-level staging correctly.

## 3. Verification

- [x] 3.1 Verify selecting a deleted working-tree file shows its deleted content instead of `No changes.`.
- [x] 3.2 Verify deleted files are stageable only at the file level.
- [x] 3.3 Verify modified and added files keep their current block and line staging behavior unchanged.
