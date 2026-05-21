## Why

Branch comparison currently starts from one context menu action that locks the clicked branch as the source/head side and only lets the user change the base/target branch inside the modal. That makes direction easy to miss and forces users to close and reopen the modal when they want to inspect a different source branch.

The comparison direction matters for PR-style review: "show changes in feature against main" is different from "show changes in main against feature". Users need that direction to be explicit at entry and editable inside the modal.

## What Changes

- Replace the single `Compare to...` branch context menu action with two directional actions:
  - `Show changes in <selected branch> against <current branch>...`
  - `Show changes in <current branch> against <selected branch>...`
- Open the branch comparison modal with the selected action's source/head and base/target branches prefilled.
- Disable the two directional context menu actions when the selected branch and current branch are the same, or when a current branch is unavailable.
- Change the modal header to make both comparison endpoints editable: `Show changes in [source branch] against [target branch]`.
- Add a swap control between the two branch selectors so users can reverse the comparison without closing the modal.
- Allow empty branch selections in the modal so future entry points can open comparison without preselected branches.
- Allow selecting the same branch on both sides in the modal and show a no-changes empty state without making backend diff requests.
- Clear stale file, diff, draft review, and local AI output when the active comparison pair changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `branch-comparison-review`: Directional context menu actions, editable source and target branches, swap behavior, empty selections, and same-branch empty comparison handling.

## Impact

- Frontend branch workflow: `src/features/branches` context menu labels, branch compare modal state, dropdown reuse, and branch list behavior.
- Frontend diff workflow: branch comparison file and hunk loading must react to both comparison endpoints instead of only the base/target branch.
- Review comments and local AI: active comparison keys must include both editable endpoints so stale comments, analysis, and review findings are not shown for a different comparison.
- Tests: update context menu tests, modal branch-selection tests, diff reload tests, same-branch empty-state tests, and local AI invalidation tests.
