## 1. Commit Table Layout

- [x] 1.1 Update the table sizing model in `src/components/tables/TableVirtualResizable.tsx` so one column can grow into the remaining available width while the other columns keep explicit widths.
- [x] 1.2 Update `src/components/CommitList.tsx` to make the commit message column the flexible column and keep supporting columns constrained.
- [x] 1.3 Adjust the visible resize-handle styling in the shared table component so column separators feel thinner while remaining draggable.

## 2. Commit Selection Behavior

- [x] 2.1 Update `src/components/CommitList.tsx` so clicking the already selected commit row clears selection and closes the commit detail view.
- [x] 2.2 Add `Esc` handling in `src/components/CommitList.tsx` to clear commit selection and hide the detail view when a commit is selected.
- [x] 2.3 Verify that row toggling, keyboard navigation, and commit-detail rendering still behave correctly after the selection changes.

## 3. Workspace Toolbar And Copy

- [x] 3.1 Update `src/components/TopToolbar.tsx` to remove `Undo` and `Redo` and right-align the remaining toolbar actions.
- [x] 3.2 Translate visible workspace copy on touched repo-view surfaces to English, including commit table labels, toolbar labels, accordion labels, and relevant empty states.
- [x] 3.3 Update any related workspace components whose labels or helper text still remain in Spanish after the main toolbar and commit-view pass.

## 4. Verification

- [x] 4.1 Verify that the workspace still matches existing `git log` / `first parent` history behavior after the UI-only changes.
- [x] 4.2 Verify that the flexible message column, thinner resize handles, selection toggle behavior, `Esc` dismissal, toolbar alignment, and English copy all behave correctly together in the repo workspace.
