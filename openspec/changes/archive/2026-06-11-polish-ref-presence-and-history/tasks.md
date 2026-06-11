## 1. Commit Message Entry

- [x] 1.1 Add commit-message constants for the recommended subject limit and commit shortcut labels near the working-changes commit feature.
- [x] 1.2 Update the current changes commit textarea so plain Enter inserts a newline and modifier shortcuts trigger commit or commit-and-push actions.
- [x] 1.3 Add a non-blocking warning based only on the first commit-message line when it exceeds the recommended subject length.
- [x] 1.4 Ensure commit and amend calls preserve full multi-line message content, including body text after a blank line.
- [x] 1.5 Add frontend and Rust tests covering multiline commit submission, Enter editing behavior, and long-subject warnings.

## 2. Branch Ref Metadata

- [x] 2.1 Add typed Rust branch-ref structures for unified branch rows, presence status, optional local/origin tips, and ahead/behind counts.
- [x] 2.2 Implement a backend command that loads unified branch rows from local refs, origin refs, and local upstream metadata without per-row frontend Git calls.
- [x] 2.3 Compute ahead/behind counts only for rows with comparable local and origin tips, omitting zero-count badges.
- [x] 2.4 Add TypeScript API/types for the unified branch ref command and update adapter tests.
- [x] 2.5 Add Rust tests for local-only, origin-only, both-present, synchronized, behind, ahead, and diverged branch rows.

## 3. Branches Panel UI

- [x] 3.1 Preserve the branches panel's exclusive local/remote view selection while rendering from unified branch-ref rows.
- [x] 3.2 Render the unified branch tree from backend branch-ref rows while preserving branch grouping, search filtering, selection, and expansion behavior.
- [x] 3.3 Keep branch rows free of presence icons while retaining divergence badges before the row action menu.
- [x] 3.4 Render `N↑` and `N↓` divergence badges before the row action menu for comparable branch rows.
- [x] 3.5 Update branch context menu action availability to use row presence metadata instead of panel-wide local/remote mode.
- [x] 3.6 Update branch panel tests for local/remote mode, persisted state, divergence badges, and context menu availability.
- [x] 3.7 Add a force-delete branch context-menu action below safe delete, with explicit confirmation copy and backend `git branch -D` support.

## 4. Tags Panel UI

- [x] 4.1 Add persisted local/remote tag filter state that always keeps at least one location enabled and remains independent from branch filters.
- [x] 4.2 Replace tag text status chips with local computer and remote cloud icons using muted pending styling and resolved row-text coloring.
- [x] 4.3 Add tag icon tooltips and accessible labels for local, origin, unknown/loading, and conflict states.
- [x] 4.4 Apply tag location filters to the unified tag tree while preserving search, grouping, selection, and action behavior.
- [x] 4.5 Update tag panel tests for filters, independent persistence, icon states, tooltips, unknown origin state, and conflicts.

## 5. Persistence And Realtime Refresh

- [x] 5.1 Extend per-repository workspace UI state defaults and persistence handling with separate branch view and tag location filter fields.
- [x] 5.2 Route `remote-refs` repository-change events to commit-history refresh as well as repo-ref refresh.
- [x] 5.3 Add tests proving branch view and tag filters restore separately per repository, with missing persisted branch state defaulting to local view and tag filters defaulting to both locations active.
- [x] 5.4 Add frontend realtime-router tests proving remote-ref events refresh commit history without requiring head or local branch changes.
- [x] 5.5 Add a lightweight backend remote-tip check using `git ls-remote --heads origin` against local `refs/remotes/origin/*`.
- [x] 5.6 Add an active-repository poller that stops when the active tab changes, skips pending Git actions, fetches changed refs, and refreshes repo refs plus commit history.
- [x] 5.7 Add frontend and Rust tests for remote-tip polling, tab-change cleanup, pending-action suppression, and changed remote-tip detection.

## 6. Commit Search And Conversation Hunks

- [x] 6.1 Restyle the commit search toolbar input to match other explorer search boxes while preserving next/previous controls and match count.
- [x] 6.2 Add or update tests proving commit search remains backed by prepared local history, including fetched remote refs and tag refs.
- [x] 6.3 Add a read-only pull request conversation hunk renderer that colors added, deleted, context, and header lines consistently with Gitano diff views.
- [x] 6.4 Update pull request conversation tests for colored diff hunks and unchanged comment/reply rendering.

## 7. Verification

- [x] 7.1 Run focused frontend tests for working changes, branches, tags, history, repository realtime events, workspace UI persistence, and pull request history.
- [x] 7.2 Run focused Rust tests for branch ref metadata and commit message preservation.
- [x] 7.3 Run `pnpm run lint`, `pnpm test`, and `pnpm run build`.
- [x] 7.4 Run `cargo test` from `src-tauri`.
- [x] 7.5 Run OpenSpec validation/status checks for `polish-ref-presence-and-history`.
