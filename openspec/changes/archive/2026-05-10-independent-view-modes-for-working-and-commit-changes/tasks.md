## 1. Independent View State

- [x] 1.1 Add a dedicated `flat | tree` view mode state for the working-tree changes pane and keep its modal bound to that state.
- [x] 1.2 Add a dedicated `flat | tree` view mode state for the commit changes pane and keep its modal bound to that state.

## 2. Commit Changes Explorer

- [x] 2.1 Replace the commit changes pane's legacy flat file list with the shared changes explorer.
- [x] 2.2 Keep commit changes pane behavior read-only: no file checkboxes, same modal-open behavior as today.

## 3. Modal Inheritance

- [x] 3.1 Ensure opening a working-tree modal inherits the working-tree pane's active mode.
- [x] 3.2 Ensure opening a commit diff modal inherits the commit changes pane's active mode.
- [x] 3.3 Ensure changing mode inside one modal updates only its originating pane family.

## 4. Verification

- [x] 4.1 Verify working-tree pane and modal can switch between flat/tree without affecting commit changes.
- [x] 4.2 Verify commit changes pane and modal can switch between flat/tree without affecting working-tree changes.
- [x] 4.3 Verify both pane families default to `Tree View` when first rendered.
