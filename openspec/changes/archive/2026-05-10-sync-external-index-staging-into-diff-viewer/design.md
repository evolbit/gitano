## Context

The current working-changes experience is based on two different truths:

- the file list and hunks come from live Git state
- selected line and file staging visuals come from the local Zustand staged-state store

That split is acceptable for optimistic local interactions, but it fails when the index is changed outside Gitano. The refresh picks up changed files, but the selected state is not rebuilt from the index, so the diff viewer cannot show which lines are already staged.

## Goals / Non-Goals

**Goals:**
- Make current-changes selection visuals reflect the real Git index after refresh.
- Support external staging tools without requiring the user to restage inside Gitano.
- Preserve the current immediate staging UX for interactions performed inside Gitano.

**Non-Goals:**
- Changing committed-file diff behavior
- Redesigning the working-changes polling mechanism
- Replacing the current staging UI model completely

## Decisions

### Treat the Git index as authoritative after refresh
The diff viewer should continue to use the local staged-state store for immediate optimistic interactions, but after the working changes are refreshed, staged selections should be reconciled from the actual index.

This reconciliation must happen at refresh or rebind boundaries, not during row rendering or interactive paint paths.

### Build staged selections by comparing `HEAD -> index` against `HEAD -> working tree`
Gitano already renders editable current changes from the full working diff. To know which parts are staged, it also needs the staged diff from `HEAD` to `index`. The frontend can then derive:

```text
working diff lines
∩
index diff lines
= selected/staged lines
```

This keeps the existing editable diff model and adds a second authoritative diff input for staged reconstruction.

### Preserve file-level staged baselines where possible
If the staged diff shows the whole editable file is staged, the store can keep using the lightweight whole-file baseline instead of eagerly materializing every selected line.

Only partially staged files should require explicit per-line selection maps.

### Reconcile on refresh, not on every render
The reconstruction should happen when working changes are refreshed or rebound, not continuously inside row rendering. That keeps the diff viewer responsive.

### Limit reconciliation to the current working-changes file set
The synchronization step should only consider files that are part of the current working changes, and it should skip unnecessary recomputation where the working diff and staged diff inputs for a file have not meaningfully changed.

## Risks / Trade-offs

- [Line matching between working diff and staged diff can be tricky] -> Reuse shared hunk/line identity rules so staged reconstruction aligns with the editable diff structure.
- [Store reconciliation may overwrite in-flight optimistic interactions] -> Apply authoritative sync after refresh boundaries, not during active local drag/click gestures.
- [Whole-file staged baseline and explicit line exceptions can drift] -> Normalize reconstructed file state into either whole-file staged or explicit selections, not both arbitrarily.
- [External-index synchronization could regress diff responsiveness] -> Keep all Git/index reconstruction work out of `DiffViewer`/`DiffHunk` render paths and perform it in one bounded reconciliation step after refresh.
