## 1. Branch Comparison State

- [x] 1.1 Replace modal-open state that stores only a source branch with a nullable comparison pair containing source/head and target/base branches.
- [x] 1.2 Ensure branch comparison can be opened with either a complete pair or empty selections.
- [x] 1.3 Preserve initial-commit and unavailable-current-branch guardrails with clear disabled states or error notices.

## 2. Directional Context Menu

- [x] 2.1 Replace `Compare to...` with `Show changes in <selected branch> against <current branch>...`.
- [x] 2.2 Add `Show changes in <current branch> against <selected branch>...`.
- [x] 2.3 Open the modal with the correct source/head and target/base pair for each action.
- [x] 2.4 Disable both directional actions when the selected branch is the current branch.
- [x] 2.5 Disable both directional actions when no current branch is available.
- [x] 2.6 Keep branch group nodes from starting branch comparison.

## 3. Editable Modal Endpoints

- [x] 3.1 Generalize the target branch dropdown into a reusable branch endpoint selector.
- [x] 3.2 Render source/head and target/base selectors in the modal header using `Show changes in [source] against [target]` wording.
- [x] 3.3 Allow either selector to be empty and show endpoint-specific placeholders.
- [x] 3.4 Allow the same branch to be selected in both selectors.
- [x] 3.5 Keep selector search, local/remote grouping, loading, error, empty, and virtualization behavior.

## 4. Comparison Loading And Empty States

- [x] 4.1 Load changed files using `baseRef: targetBranch` and `headRef: sourceBranch` when both endpoints are selected and different.
- [x] 4.2 Reload changed files and selected file diff when either endpoint changes.
- [x] 4.3 Clear stale files, selected file, and hunks when either endpoint is missing.
- [x] 4.4 Clear stale files, selected file, and hunks when both endpoints are the same.
- [x] 4.5 Show `Select a source branch`, `Select a target branch`, or `No changes between these branches` as appropriate.
- [x] 4.6 Ignore stale file and hunk responses from previous comparison pairs.

## 5. Swap And Scoped State

- [x] 5.1 Add an icon-only swap button between the two branch selectors with accessible labeling.
- [x] 5.2 Swap source/head and target/base selections in place.
- [x] 5.3 Scope draft review threads and line anchors to the active source/target pair.
- [x] 5.4 Clear or key dismissed AI findings, branch analysis, branch review, and review hunk caches by the active source/target pair.
- [x] 5.5 Disable local AI analysis and review while either endpoint is missing or both endpoints are the same.

## 6. Verification

- [x] 6.1 Update context menu tests for the two directional labels and disabled states.
- [x] 6.2 Add modal tests for changing the source branch and changing the target branch.
- [x] 6.3 Add modal tests for empty endpoint selections and same-branch no-op comparisons.
- [x] 6.4 Add modal tests for the swap button request payload direction.
- [x] 6.5 Add or update local AI tests to verify pair changes do not show stale analysis or review output.
- [x] 6.6 Run the relevant frontend test suite.
- [x] 6.7 Run the frontend build.
