## 1. State Model

- [x] 1.1 Add named repository surface and pull request surface mode constants/types near the repository workspace UI state owner.
- [x] 1.2 Extend per-repository workspace UI state with active surface, pull request surface mode, active pull request number, and PR review state keyed by pull request number.
- [x] 1.3 Add store actions for switching repository surfaces, entering PR list mode, entering PR review mode, updating PR review UI state, and restoring defaults for legacy persisted state.
- [x] 1.4 Keep transient PR restoration state out of durable persistence or strip it during persisted-store partialization.
- [x] 1.5 Add workspace UI store tests for per-repository surface isolation, default surface state, PR-number-scoped review state, and transient-state persistence boundaries.

## 2. Pull Request Surface Composition

- [x] 2.1 Extract the pull request list content from `PullRequestModal` into a reusable inline component that does not own portal, overlay, or modal sizing.
- [x] 2.2 Add a repository pull requests surface component that renders list mode and review mode using repository/PR state from the workspace UI store.
- [x] 2.3 Route pull request `Review` actions to PR review mode inside the pull requests surface instead of opening `PrReviewModal`.
- [x] 2.4 Add PR-surface navigation for returning from review mode to the pull request list while preserving review state for the current session.
- [x] 2.5 Keep request-changes and merge confirmation dialogs as focused dialogs where required by the existing PR action workflow.

## 3. Repository Layout Integration

- [x] 3.1 Update `RepoTabLayout` to render either the normal workspace body or the pull requests surface based on the current repository's active surface.
- [x] 3.2 Preserve normal workspace selected pane, inline diff target, pane sizes, tree expansion, explorer modes, and relevant scroll positions when switching to and from the pull requests surface.
- [x] 3.3 Restore pull request list/review selected state, selected file, diff display mode, explorer mode, conversation visibility, and relevant scroll positions when returning to the pull requests surface.
- [x] 3.4 Keep the active repository's workspace and pull request surfaces mounted when needed so toolbar toggles preserve state and avoid first-toggle remount cost.

## 4. Toolbar Behavior

- [x] 4.1 Replace toolbar-owned PR modal open state with repository surface toggle actions.
- [x] 4.2 Change the toolbar PR control label, icon intent, tooltip, and action according to the active surface for the current repository.
- [x] 4.3 Preserve existing pull request count loading, cached count display, disabled state, and failure behavior while the control toggles surfaces.
- [x] 4.4 Add toolbar tests for workspace-to-PR toggle, PR-to-workspace toggle, per-repository label updates, and PR count display.

## 5. Pull Request Review State

- [x] 5.1 Move user-visible PR review restoration state out of local-only state where needed and bind it to repository/PR scoped UI state.
- [x] 5.2 Keep PR review server state in TanStack Query and avoid duplicating fetched GitHub data in workspace UI state.
- [x] 5.3 Restore scroll offsets after list/review content has loaded and avoid racing async query rendering.
- [x] 5.4 Ensure PR review close/back controls use inline surface navigation instead of modal close behavior.

## 6. Verification

- [x] 6.1 Add or update component tests for pull request surface list mode, review mode, and review-to-list navigation.
- [x] 6.2 Add or update repository layout tests proving per-repository surface state is isolated across tabs.
- [x] 6.3 Add or update PR workflow tests proving pull request list/review no longer render through modal portals from the repository toolbar.
- [x] 6.4 Run `pnpm run lint`.
- [x] 6.5 Run `pnpm test`.
- [x] 6.6 Run `pnpm run build`.
