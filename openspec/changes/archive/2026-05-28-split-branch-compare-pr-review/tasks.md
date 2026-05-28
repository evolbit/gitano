## 1. Component Boundaries

- [x] 1.1 Inventory the current `BranchCompareModal` state, handlers, effects, and render blocks, grouping each item as regular compare, PR review, shared comparison surface, or modal presentation.
- [x] 1.2 Define the final file and folder locations for `BranchCompare`, `BranchCompareModal`, `PrReview`, `PrReviewModal`, and any reusable comparison composition pieces while preserving project dependency direction.
- [x] 1.3 Add or update component exports so app composition can import modal wrappers without depending on workflow internals.

## 2. Shared Comparison Composition

- [x] 2.1 Extract the reusable comparison workspace boundary for the changed-file explorer and right-side diff/history content without moving PR-specific review logic into it.
- [x] 2.2 Keep diff interaction extension points generic by passing focused context or callbacks from the owning workflow to the diff rendering surface.
- [x] 2.3 Add focused tests for the reusable comparison composition if it contains behavior beyond static layout.

## 3. Regular Branch Compare Workflow

- [x] 3.1 Create `BranchCompare` and move regular branch comparison state, branch selection, file selection, diff loading, display mode, and generic AI comparison behavior into it.
- [x] 3.2 Refactor `BranchCompareModal` into a thin modal wrapper around `BranchCompare`.
- [x] 3.3 Update regular branch comparison tests to cover the extracted workflow and modal wrapper behavior.

## 4. Pull Request Review Workflow

- [x] 4.1 Create `PrReview` and move pull request context, PR comments, draft review threads, pending submitted-comment edits, finish-review state, conversation state, merge state, and PR-specific AI review behavior into it.
- [x] 4.2 Create `PrReviewModal` as a thin modal wrapper around `PrReview`.
- [x] 4.3 Update pull request entry points so selecting review from the PR list opens `PrReviewModal` instead of routing PR review through the regular branch comparison modal.
- [x] 4.4 Update PR review tests to cover comment drafting, comment editing, review submission, conversation display, merge action wiring, and AI finding actions after extraction.

## 5. Behavior Parity And Cleanup

- [x] 5.1 Remove PR-specific state and handlers from regular branch comparison modules.
- [x] 5.2 Remove modal presentation responsibility from core workflow components.
- [x] 5.3 Confirm no new global/session store was introduced for this refactor and document any state that should move later for background/restorable PR sessions.
- [x] 5.4 Confirm the refactor does not introduce new feature-to-feature imports that violate the project dependency direction.

## 6. Verification

- [x] 6.1 Run focused frontend tests for branch comparison, pull request review, diff interactions, and affected toolbar entry points.
- [x] 6.2 Run `pnpm run lint`.
- [x] 6.3 Run `pnpm test`.
- [x] 6.4 Run `pnpm run build`.
- [x] 6.5 Run OpenSpec validation for `split-branch-compare-pr-review`.
