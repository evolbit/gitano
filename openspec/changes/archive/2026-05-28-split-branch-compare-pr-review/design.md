## Context

The current branch comparison modal is the entry point for two different workflows:

- regular branch comparison, where the user selects source and target branches and inspects changed files;
- pull request review, where Gitano prepares PR refs, loads GitHub comments and history, lets the user draft line/file comments, submits reviews, merges PRs, and runs PR-style AI review.

Both workflows share the same basic comparison shape: a changed-file explorer on the left and a diff viewer on the right. The current implementation combines that shared shape with PR-specific review state and modal presentation in one large component. This makes the code harder to understand and makes future restorable PR review sessions harder because workflow state is coupled to a modal component lifecycle.

## Goals / Non-Goals

**Goals:**

- Separate regular branch comparison from pull request review while preserving existing behavior.
- Make modal presentation a thin wrapper around reusable workflow components.
- Keep pull request review logic owned by a PR review workflow, not by generic branch comparison or diff rendering.
- Keep the diff viewer generic by receiving focused interaction extension points from its parent workflow.
- Avoid global/session state for this refactor; use local workflow state, props, and focused context.
- Keep the resulting components easier to test in isolation.

**Non-Goals:**

- Add background, minimized, or restorable PR review sessions.
- Persist draft PR comments across app restart.
- Change GitHub provider APIs, backend commands, or local AI behavior.
- Redesign the PR review UI or branch comparison UI beyond the structural changes needed for decomposition.
- Move all existing shared diff or changes explorer infrastructure unless required to preserve dependency direction.

## Decisions

### Decision: Split workflow components from modal wrappers

Create core workflow components that can render without knowing whether they are inside a modal:

- `BranchCompare` owns regular branch comparison state and actions.
- `PrReview` owns pull request review state and actions.
- `BranchCompareModal` owns only modal presentation for `BranchCompare`.
- `PrReviewModal` owns only modal presentation for `PrReview`.

The wrapper components should handle portal/overlay/sizing/close behavior. They should not own selected file state, draft review state, PR comments, AI run state, or review submission logic.

Alternative considered: keep one modal component and extract helper hooks. That would reduce file length, but it would leave workflow ownership unclear and continue to tie PR review to branch comparison.

### Decision: Share comparison layout, not workflow ownership

Both workflows should reuse a comparison workspace shape for the left explorer and right diff/history area. The reusable layer should be generic enough to compose the existing `ChangesExplorer` and diff viewer, but it must not own PR review rules.

The implementation should prefer one of these dependency-safe shapes:

- a neutral layout component that receives explorer and content nodes as props; or
- small shared/pure comparison utilities that do not import feature-specific workflow code.

If implementation finds that existing feature-owned components need to be consumed by multiple workflows, the extraction should preserve the project's dependency rules rather than adding new feature-to-feature coupling.

Alternative considered: make `PrReview` wrap `BranchCompare` and inject PR controls. That keeps layout reuse high, but it makes PR review depend on regular branch comparison state and makes ownership harder to reason about.

### Decision: Keep PR review logic in `PrReview`

`PrReview` should own PR-specific behavior:

- loading and refreshing PR comments;
- draft review threads and replies;
- edits to submitted review comments;
- review summary body and selected review event;
- review submission and failure handling;
- PR conversation comments and history panel state;
- PR merge action state;
- PR-specific AI review apply/dismiss/copy behavior.

Regular `BranchCompare` should not know about GitHub comment IDs, PR numbers, review events, review thread resolution, or PR merge decisions.

Alternative considered: keep PR review state in a reusable branch review hook under the branch feature. That continues the current ownership problem by making PR review an extension of branch comparison instead of its own workflow.

### Decision: Use focused context for diff interactions

The diff viewer should remain a generic rendering surface. PR review can provide line and file interaction behavior through focused context or explicit render callbacks, such as line accessories, below-line review content, or file-header review content.

The diff viewer may call upward through these extension points, but it must not own or understand:

- GitHub pull request numbers;
- GitHub review comment IDs;
- `APPROVE`, `REQUEST_CHANGES`, or `COMMENT` review submission semantics;
- draft vs submitted review lifecycle rules;
- AI review finding application.

Alternative considered: pass all diff interaction props through every intermediate component. That is explicit, but noisy through deeply nested diff rendering. A focused context keeps the generic diff rendering boundary clean while avoiding a broad workflow context.

### Decision: Do not introduce global PR review state in this refactor

The refactor should keep state local to `BranchCompare` and `PrReview` unless the state already belongs in TanStack Query or an existing store. A global/session store is appropriate for the later background/restore feature, where PR review state must outlive the mounted view and be observed by unrelated UI such as a background process list.

Alternative considered: introduce a global PR review store now. That would anticipate future work, but it adds lifecycle complexity before the workflow boundary is clean.

## Risks / Trade-offs

- Behavior regressions during extraction -> Keep the first implementation behavior-preserving, move code in small slices, and cover current PR review and branch compare interactions with focused tests.
- New shared layout could violate dependency rules if it imports feature-owned components -> Keep the shared layer generic, or promote reusable pieces deliberately rather than importing across feature ownership boundaries.
- Splitting files could create shallow wrappers without reducing complexity -> Move ownership with the workflow, not just JSX blocks.
- PR review and branch comparison could duplicate small pieces of comparison wiring -> Accept limited duplication when it keeps ownership clearer than a leaky abstraction.
- Modal wrappers may still need close/escape behavior used by inner workflows -> Pass close commands as props; avoid broad modal context.

## Migration Plan

1. Extract modal shell/presentation from the existing branch comparison modal without changing runtime behavior.
2. Extract a reusable comparison workspace boundary for explorer/diff composition.
3. Move regular branch comparison state into `BranchCompare`.
4. Move PR-specific review state and actions into `PrReview`.
5. Update toolbar entry points so regular branch comparison opens `BranchCompareModal` and pull request review opens `PrReviewModal`.
6. Keep existing behavior and tests passing after each step.

Rollback is straightforward because the change is frontend-only: revert the extracted components back to the existing modal implementation if behavior parity cannot be maintained.

## Open Questions

- The exact folder for the neutral comparison workspace should be chosen during implementation after checking which pieces can be shared without violating dependency direction.
- If existing feature-owned diff or changes explorer components need promotion to shared ownership, that promotion should be kept minimal and behavior-preserving.
