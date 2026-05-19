## Why

The current commit area has visual misalignment: the AI action sits outside the commit message field, the text field can visually run under the action controls, and file count numbers in the changes panel do not align with the view buttons. Commit-message AI generation also needs the same visible loading affordance used by other toolbar actions.

## What Changes

- Move the commit message action bar inside the commit message box while keeping the editable field width ending before the commit and dropdown buttons begin.
- Add right-side padding to commit changes file count numbers so additions/deletions visually align with the panel action buttons.
- Show a loading indicator on the AI commit-message button while generation is in progress, matching the push button loading treatment.
- Keep long diff lines from soft-wrapping so line-number gutters do not develop visual gaps.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `commit-box-push-workflow`: Clarify commit box layout and AI commit-message loading behavior.
- `commit-changes-explorer`: Clarify right-side file count alignment in the commit changes panel.
- `diff-display-modes`: Clarify that diff code rows do not soft-wrap by default.

## Impact

- Current changes commit bar layout and loading state styling.
- Changes explorer row spacing/count alignment when rendered in the commit changes panel.
- Shared diff hunk code-line wrapping behavior in unified and split display modes.
- Frontend tests or visual assertions for the commit box and commit changes panel.
