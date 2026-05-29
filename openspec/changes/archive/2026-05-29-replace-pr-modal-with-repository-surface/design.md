## Context

The repository toolbar currently owns a `PullRequestModal` open flag and a separate `PrReviewModal` target. Both pull request list and pull request review render through portals above the repository workspace. The normal repository workspace already persists many per-repository UI choices through `workspace-ui-store`, including left pane section, selected inline diff targets, pane widths, explorer expansion, and explorer view mode.

The desired behavior is a repository-level toggle between the normal workspace and pull request workflows. Users should be able to switch away from either surface and return with the same repository-specific context, without keeping two complete workspace trees mounted at all times.

## Goals / Non-Goals

**Goals:**

- Present pull requests as an inline repository surface, not a modal overlay.
- Preserve main workspace state per repository while PRs are visible.
- Preserve PR list/review state per repository and PR number while the user toggles surfaces.
- Keep inactive surfaces unmounted and restore explicit state on remount.
- Make the top toolbar PR control reflect the active surface for the current repository.
- Preserve existing GitHub PR data loading, review submission, conversation, merge, and count refresh behavior.

**Non-Goals:**

- Changing backend GitHub/Tauri command payloads.
- Persisting temporary PR drafts, popovers, loading state, or modal-like transient state across app restarts.
- Reworking regular branch comparison behavior beyond any shared component boundaries needed for inline PR review.
- Keeping both the normal workspace and PR surface mounted permanently.

## Decisions

### Use a per-repository surface state

Add a repository surface concept owned near the repository workspace:

```ts
type RepositorySurface = "workspace" | "pull-requests";
type PullRequestsSurfaceMode = "list" | "review";
```

Each repository path tracks its active surface independently. Switching tabs between repositories must not force all repositories into the same surface.

Alternative considered: a single global `pullRequestViewOpen` flag. This would be simpler, but it would make repository tab switching surprising because one repo's PR state would affect another repo's workspace.

### Use a PR surface with internal list/review modes

The pull request surface owns navigation between list and review:

```text
Workspace <-> Pull requests surface
              Pull request list <-> Pull request review
```

The top toolbar only switches between workspace and pull requests. PR-specific navigation, such as going from review back to the PR list, stays inside the PR surface header.

Alternative considered: model `workspace`, `pull-request-list`, and `pull-request-review` as three top-level repository surfaces. That makes the toolbar state more complicated and couples global repository navigation to PR-internal navigation.

### Remount inactive surfaces and restore explicit state

When a repository switches from workspace to pull requests, the normal workspace can unmount. When switching back, it remounts from stored UI state. The same applies when returning to the PR surface.

This avoids keeping two large React trees alive, including diff surfaces, query hooks, effects, keyboard handlers, and scroll containers. TanStack Query should continue to cache server data; the UI store should own only UI restoration state.

Alternative considered: keep both surfaces mounted and hide the inactive one. This gives perfect React/DOM state retention, but it increases memory pressure and keeps hidden effects alive unless every expensive hook is manually paused.

### Separate durable preferences from in-session restoration

Durable repository preferences can continue to persist across restarts where they are already appropriate: pane widths, selected main workspace sections, explorer view modes, and durable navigation choices.

Exact toggle restoration can include in-session state that should not survive restart: scroll offsets, PR conversation composer drafts, open popovers, submission errors, and loading flags. These should either be kept out of the persisted portion of the store or reset during rehydration.

Alternative considered: persist all PR UI state by default because `workspace-ui-store` is already persisted. That would restore temporary PR review state after app relaunch, conflicting with the existing rule that transient UI state does not persist.

### Key PR review state by repository and pull request number

The PR review state should be nested under the repository state and keyed by pull request number:

```ts
type PullRequestReviewUiState = {
  selectedPath: string | null;
  displayMode: DiffDisplayMode;
  viewMode: ChangesExplorerViewMode;
  historyOpen: boolean;
  scroll: Record<string, number>;
};
```

This lets a repository remember separate UI context for PR #12 and PR #18 without mixing selected files or scroll offsets.

Alternative considered: one PR review state per repository. That would lose context when the user switches between multiple PRs in the same repository.

### Move modal shells out of the inline path

The existing `PrReview` core workflow is already separated from `PrReviewModal`, and the existing comparison composition spec allows rendering workflows outside modal wrappers. Implementation should reuse the core workflow and avoid modal portal/overlay behavior for inline PR presentation.

The existing modal wrappers may remain for unrelated flows until they are no longer used, but the repository PR entry point should render inline surfaces.

## Risks / Trade-offs

- Restored state is incomplete if a local `useState` remains hidden inside the PR workflow -> Audit PR list and review state, move user-visible restoration state to a repo/PR keyed UI state boundary, and cover toggling in tests.
- Scroll restoration can race with async content loading -> Restore scroll after the relevant content exists, and reapply when query data transitions from loading to loaded.
- Persisting too much PR UI state can reopen stale temporary UI after restart -> Keep transient restoration state out of persisted storage or explicitly strip it from `partialize`.
- The toolbar button may become ambiguous in PR review mode -> Use clear label/icon changes: `PRs` from workspace, `Workspace` from PR surface.
- PR count refresh should not be blocked by the PR surface state -> Keep count refresh logic tied to active repository eligibility, not to whether the PR surface is currently visible.

## Migration Plan

1. Extend repository UI state with active surface and PR surface state, preserving defaults for existing persisted repository state.
2. Extract the pull request list body from the modal shell so it can render inline.
3. Render the pull request surface from the repository layout instead of from toolbar-owned modals.
4. Update toolbar PR control to toggle the active repository surface.
5. Move PR review restoration state out of local-only state where needed.
6. Add tests for repository-specific toggling, PR list/review navigation, toolbar label changes, and state restoration.

Rollback is straightforward: restore toolbar-owned modal state and route PR list/review entry points back through the existing modal wrappers.

## Open Questions

- Should the PR surface default to restoring the last PR review mode for the repository, or always return to the PR list when opened from the toolbar after a long idle period? The current proposal assumes restoration while the app session is active and list as the fallback when no PR state exists.
