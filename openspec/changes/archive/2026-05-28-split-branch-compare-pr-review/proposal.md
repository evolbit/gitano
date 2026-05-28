## Why

`BranchCompareModal` currently owns regular branch comparison, pull request review workflow, PR comments, review submission, merge actions, pull request history, AI run state, and modal presentation. This makes the component difficult to reason about and blocks future work such as restorable PR review sessions because workflow state and presentation state are tightly coupled.

## What Changes

- Split the regular branch comparison workflow from the pull request review workflow while preserving current user-facing behavior.
- Introduce core workflow components that are independent from modal presentation:
  - `BranchCompare` for regular branch comparison.
  - `PrReview` for pull request review, PR comments, draft review threads, review submission, conversation, merge, and PR-specific AI behavior.
- Keep modal wrappers thin:
  - `BranchCompareModal` presents `BranchCompare` in the existing modal shell.
  - `PrReviewModal` presents `PrReview` in the existing modal shell.
- Extract reusable comparison layout pieces so both workflows share the changes explorer and diff viewer composition without sharing PR-specific logic.
- Keep `DiffViewer` generic. It may expose focused diff interaction extension points, but it must not own GitHub pull request review state, review submission logic, or AI review business logic.
- Use props for workflow inputs and commands, focused context for deeply nested diff interaction plumbing, and avoid global/session state for this refactor.
- Defer background/restorable PR review sessions to a later change.

## Capabilities

### New Capabilities

- `comparison-workflow-composition`: Defines the separation between branch comparison, pull request review, reusable comparison surfaces, and modal presentation wrappers.

### Modified Capabilities

- None.

## Impact

- Affected frontend areas:
  - `src/features/branches/components/branch-compare-modal`
  - `src/features/pull-requests`
  - shared or neutral comparison layout/rendering components selected during implementation.
- Existing GitHub PR review behavior, branch comparison behavior, AI review behavior, and modal entry points should remain unchanged.
- No backend, Tauri command, provider API, or persisted data format changes are expected.
