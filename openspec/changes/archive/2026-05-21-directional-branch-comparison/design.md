## Context

The existing branch comparison modal receives a required `sourceBranch` prop and stores only `baseBranch` as editable state. All comparison calls use `baseRef: baseBranch` and `headRef: sourceBranch`, so the clicked branch remains locked as the source/head side for the lifetime of the modal.

That model is too narrow for branch review. Users often need to inspect both directions, and they should be able to change either endpoint from the modal without closing it. The future window-level entry point also needs to open the modal without a selected branch pair.

## Goals / Non-Goals

**Goals:**
- Make comparison direction explicit in the branch context menu.
- Represent branch comparison as an editable source/head and base/target pair.
- Let users change either branch endpoint in the modal.
- Let users swap the endpoints with one control.
- Support empty endpoint selections for future entry points.
- Support same-branch selections inside the modal with a no-changes state and no backend diff request.
- Prevent stale files, hunks, comments, analysis, or review findings from appearing as current after the comparison pair changes.

**Non-Goals:**
- Adding the future window-level compare menu.
- Changing backend diff semantics away from direct branch comparison.
- Persisting draft comments or submitting PR review feedback.
- Adding new branch filtering rules beyond reusable search and grouping.

## Decisions

### Represent comparison as a pair

Use a comparison pair instead of a single source branch:

```ts
type BranchComparisonSelection = {
  sourceBranch: string | null;
  targetBranch: string | null;
};
```

`sourceBranch` is the head side whose changes are being inspected. `targetBranch` is the base/reference side used for comparison. Backend requests should continue to map this pair to:

```ts
baseRef: targetBranch
headRef: sourceBranch
```

The modal should load comparison data only when both values are present and different.

### Use directional context menu actions

Replace `Compare to...` with two actions under the existing `Compare` section:

- `Show changes in <selected branch> against <current branch>...`
- `Show changes in <current branch> against <selected branch>...`

The first action opens `{ sourceBranch: selectedBranch, targetBranch: currentBranch }`.
The second action opens `{ sourceBranch: currentBranch, targetBranch: selectedBranch }`.

If the selected branch is the current branch, show both actions disabled. If there is no current branch available, also disable both actions because the context menu cannot build the directional pair.

### Make both modal endpoints editable

The modal header should read as an action, not as a static title:

```text
Show changes in [source branch dropdown] [swap] against [target branch dropdown]
```

Both dropdowns should use the same branch selector behavior: local and remote sections, search, loading, error, empty state, and virtualized results. The selector should not exclude the opposite branch, because selecting the same branch on both sides is allowed inside the modal.

The selector should support a placeholder for empty values:

- source placeholder: `Select source branch`
- target placeholder: `Select target branch`

### Swap endpoints in place

The swap control swaps `sourceBranch` and `targetBranch`. After swap, the modal should treat the result as a normal comparison pair change:

- clear selected file and hunks
- reload changed files when both endpoints are present and different
- show the same-branch empty state when both endpoints match
- prevent stale AI or review output from appearing as current

### Handle empty and same-branch states explicitly

When either endpoint is missing, the modal should not call comparison APIs. It should clear stale files and hunks and show a specific empty state:

- missing source: `Select a source branch`
- missing target: `Select a target branch`

When both endpoints are present but equal, the modal should also avoid backend diff calls, clear stale files and hunks, and show `No changes between these branches`.

### Scope review and AI state to the active pair

Draft review threads, dismissed AI findings, branch analysis, branch review, loaded review hunks, and selected file state must be keyed by or invalidated against the full comparison pair. Existing output for one pair must not appear as current output after either endpoint changes.

It is acceptable to keep draft review threads in memory for the current modal session when a user switches away from a pair and later returns to it, but they must only render for the active pair.

## Risks / Trade-offs

- [Directional labels can become long] -> Keep menu width stable enough for branch names and rely on truncation where existing context menu styling already truncates branch names.
- [Two selectors increase modal header complexity] -> Use compact labels and icon-only swap with a tooltip.
- [Allowing same branch on both sides may look like an error] -> Treat it as a valid no-op comparison with a clear empty state.
- [Changing either endpoint can leave stale async responses in flight] -> Continue using request ids and include both endpoints in request dependencies.
- [Review and AI output can be misleading if not invalidated] -> Scope output by pair key or clear it whenever the active pair changes.

## Migration Plan

1. Update branch comparison state from a single `compareSourceBranch` to an optional comparison pair.
2. Replace context menu compare action rendering with two directional actions and disabled states.
3. Generalize the branch dropdown component so it works for both source and target endpoint selection.
4. Update the modal header and loading logic to use editable source/head and target/base values.
5. Add swap behavior and explicit empty/same-branch states.
6. Update draft review and local AI state invalidation for pair changes.
7. Update tests for the new labels, endpoint changes, swap behavior, and no-op comparison states.

## Open Questions

- None. Current decisions: use `Show changes in ... against ...` wording, disable both context menu actions when selected and current branches match, allow same-branch selections inside the modal, and include a swap control.
