## 1. Commit Box Layout

- [x] 1.1 Refactor the current changes commit box so the textarea and lower action bar share one bordered frame.
- [x] 1.2 Constrain the editable message field so it ends before the commit/dropdown button group and does not underlap controls.
- [x] 1.3 Keep push checkbox and commit/menu buttons aligned inside the commit box footer across narrow widths.

## 2. AI Loading State

- [x] 2.1 Update the AI commit-message button to show a spinner/loading affordance while `aiLoading` is true.
- [x] 2.2 Preserve disabled behavior and accessible labels for AI generation.

## 3. Commit Changes Count Alignment

- [x] 3.1 Add scoped right-side padding/alignment for insertion/deletion counts in the commit changes panel.
- [x] 3.2 Verify narrow pane truncation still preserves status icons, file names, count column, and optional checkboxes.

## 4. Verification

- [x] 4.1 Add or update focused frontend tests for commit-box AI loading and layout-relevant states where practical.
- [x] 4.2 Run focused tests for the changed working-changes components.
- [x] 4.3 Run a frontend build or typecheck.

## 5. Diff Viewer Line Number Wrapping

- [x] 5.1 Disable soft wrapping for unified, split, and context diff code rows so wrapped long lines do not create line-number gutter gaps.
- [x] 5.2 Add focused diff-hunk tests for non-wrapping code rows.
