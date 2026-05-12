## Context

The application currently has two push entry points with overlapping behavior:

- Top toolbar push control (already includes loading and snack feedback).
- Current changes commit box (recently introduced, supports commit options and keyboard submission).

Commit operations run through `useStageAndCommit`, while push UI feedback is still centered in toolbar behavior. The commit list currently loads and paginates commits but does not have a clear shared trigger for immediate post-commit refresh across all commit entry points.

## Goals / Non-Goals

**Goals:**
- Define deterministic commit-box shortcut behavior: `Enter` for commit, `Shift+Enter` for commit+push.
- Ensure commit-box push reuses top-toolbar push feedback semantics (same success/error snack behavior).
- Restrict push loading indication to explicit push actions only.
- Ensure commit list refreshes immediately after commit/push and continues periodic refresh.

**Non-Goals:**
- Redesign commit list table, search, or pagination UX.
- Introduce new backend push/commit APIs.
- Change branch selection or repository switching behavior.

## Decisions

### Route explicit push actions through a shared push-feedback path
Commit-box initiated push should use the same push result handling contract as toolbar push, not a separate notification implementation. This keeps success/error messaging and loading semantics consistent.

Alternative considered:
- Keep independent commit-box push feedback. Rejected due to behavior drift risk and duplicated UI logic.

### Keep keyboard shortcuts explicit and non-ambiguous
The commit box keyboard contract is:
- `Enter` => commit using current checkbox/dropdown push mode
- `Shift+Enter` => force commit+push regardless of checkbox state

Alternative considered:
- Make `Shift+Enter` depend on checkbox state. Rejected because shortcut intent should be explicit and predictable.

### Trigger commit history refresh from commit completion events
Post-commit refresh should be event-driven: successful commit (with or without push) triggers immediate commit list reload, then periodic polling continues independently.

Alternative considered:
- Only rely on periodic polling. Rejected because immediate user confirmation is required after commit.

### Scope push loading to explicit push lifecycle
Push loading in top toolbar should only appear during actual user-initiated push operations, including push initiated from commit box, and should not be conflated with unrelated refresh activity.

Alternative considered:
- Reuse generic “remote sync” loading. Rejected because it overstates push activity and reduces trust in status affordances.

## Risks / Trade-offs

- [Cross-component coupling between commit box and toolbar feedback] -> Use a minimal shared action/notification pathway rather than direct component-to-component calls.
- [Duplicate refresh triggers causing excess reloads] -> Debounce or gate immediate refresh trigger and keep periodic loop unchanged.
- [Shortcut conflicts with multiline message entry expectations] -> Keep current single-line commit intent and document `Shift+Enter` as commit+push behavior.
