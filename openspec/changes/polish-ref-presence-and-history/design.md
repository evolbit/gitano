## Context

Gitano already has separate local/remote branch lists, split local/origin tag queries, backend-prepared commit history, and a centralized repository realtime event router. The current UI still exposes several Git concepts as disconnected pieces: branches are shown as either local or remote modes, tags show text state chips, commit search styling differs from other explorer searches, and remote-ref updates do not always refresh the graph/list even though the backend detects them.

The change should make Git state explicit without making the frontend reimplement Git. Presence, divergence, and commit-history scope belong in backend adapters; React components should mostly render typed data, apply local UI filters, and persist view preferences.

## Goals / Non-Goals

**Goals:**

- Preserve full multi-line commit messages from the commit box and warn on long subject lines.
- Show one unified branch tree with local/remote metadata and ahead/behind counts.
- Show tag local/remote state with icon indicators instead of text chips.
- Preserve the branches panel's exclusive local/remote view selection and add non-empty local/remote presence filters to tags, persisted separately.
- Detect active-repository remote branch tip changes automatically, fetch changed refs, and refresh history/ref surfaces.
- Refresh commit history when fetched remote refs change, using existing repo events.
- Keep commit search local to the prepared repository history while matching the shared search-control style.
- Color pull request conversation diff hunks consistently with existing diff line tones.

**Non-Goals:**

- Add live remote commit search that queries hosting providers or runs network fetches.
- Support arbitrary remote selection beyond the existing `origin`-oriented tag and branch workflows.
- Change branch operation semantics such as checkout, push, pull, merge, rebase, or set-upstream beyond adapting them to unified branch rows.
- Rebuild the main diff viewer or review-thread model.
- Enforce Git commit subject length as a hard validation error.

## Decisions

### Decision: Backend owns branch presence and divergence metadata

Introduce a typed branch-ref query that returns unified branch rows rather than composing string arrays in the branches UI. Each row should include the logical branch name, optional local ref/tip, optional origin ref/tip, a presence status, and optional divergence counts.

For a local branch, the remote counterpart should resolve from its configured upstream when that upstream is under `origin`; otherwise fall back to `origin/<local-name>`. Remote-only `origin/*` refs should appear as rows using their branch name without the `origin/` prefix. This keeps the UI dumb and aligns with the existing product assumption that remote actions target `origin`.

Alternative considered: continue loading `get_branches` and `get_remote_branches` separately and compute presence/divergence in the frontend. That would scatter Git semantics across React and require many per-row backend calls for ahead/behind counts, which is both slower and harder to test.

### Decision: Divergence badges are counts, not state chips

Render `N↓` when the origin counterpart has commits missing locally, and `N↑` when the local branch has commits not present on origin. Show both for diverged branches. Do not render zero-count badges. Do not render ahead/behind counts for local-only or remote-only rows because there is no counterpart to compare.

Alternative considered: always show `0/0` or a combined `ahead/behind` chip. That makes the tree noisier and competes with the requested compact arrow notation.

### Decision: Branch mode and tag filters are independent persisted panel state

Branches keep the cleaner exclusive local/remote mode control, but the rows inside each mode come from the unified backend branch-ref data. The local mode shows rows with a local ref; the remote mode shows rows with an origin ref. Branch rows do not render separate local/cloud presence icons.

Tags use two independent toggle buttons: local/computer and remote/cloud. At least one toggle must remain active. Both toggles enabled means union view. One toggle enabled means rows with that location, including rows also present at the other location.

Persist the branch view selection and tag filter state separately in the existing per-repository workspace UI state. Default missing branch state to local view and missing tag filters to both locations enabled.

Alternative considered: use one global ref filter shared by branches and tags. That would be surprising because users can want different views in each panel.

### Decision: Commit entry prioritizes editing over shortcut submission

Plain `Enter` in the current changes commit textarea should insert a newline. Commits remain available through the visible buttons, and modifier shortcuts can submit actions without blocking multiline editing. The first line is treated as the subject for warning purposes, but the backend should receive the full message exactly as entered after normal edge trimming.

Alternative considered: keep plain `Enter` as commit and use `Shift+Enter` for newlines. That conflicts with normal multiline textarea behavior and caused the user-reported body-entry failure.

### Decision: Commit search remains local prepared-history search

Commit search should continue to run against Gitano's prepared local repository history, which already includes local branches, remote refs, tags, and `HEAD` after fetch. Remote search would require network/provider behavior and would make match counts dependent on connectivity. The UI should preserve match count and next/previous navigation controls while adopting the same search input style used by other explorer panels.

Alternative considered: query the remote provider when searching. That is unnecessary for fetched refs, slower, unavailable for non-GitHub remotes, and would not support offline repository review.

### Decision: Remote-ref events refresh history

The backend watcher already classifies changes under `refs/remotes/*` as `remote-refs`. The frontend event router should dispatch commit-history refresh for `remote-refs`, not only for `head` or local `branches`, because fetched remote commits can change the graph even when local branch refs did not move.

Alternative considered: periodically poll commit history. The existing event model is more performant and already observes the relevant filesystem changes.

### Decision: Active repositories poll remote tips before fetching

Server-only remote commits are not visible to local divergence counts or the commit graph until the local remote-tracking refs are fetched. Add an active-repository poller that uses a lightweight `git ls-remote --heads origin` check to compare server branch tips with local `refs/remotes/origin/*`. When a mismatch is detected, run a normal fetch for the active repository and dispatch the same repo-ref and commit-history refresh events as manual fetch.

The poller runs only for the active tab's repository, starts after a short delay, repeats on an interval, and is torn down when the active tab changes to another repository. It must skip checks while another Git action is pending so it does not compete with foreground operations.

Alternative considered: run full background fetches every few seconds. That is simpler but heavier, can prompt for credentials more often, and does unnecessary network/object work when remote tips are unchanged. Another alternative was a server-side webhook channel; that requires hosted identity, provider app installation, and notification routing that is disproportionate for the desktop client baseline.

### Decision: Conversation hunk coloring is a lightweight renderer

Pull request conversation hunks should be parsed line-by-line for display and colored using the same add/delete tones as existing diff rows. This does not need to reuse the full interactive diff viewer because conversation hunks are compact, read-only context snippets.

Alternative considered: mount the full diff viewer inside each comment card. That would add heavy interaction surface and layout complexity where a static hunk preview is enough.

## Risks / Trade-offs

- Backend branch divergence can be expensive in very large repositories -> Compute divergence only for rows with both local and origin tips, and load it as part of one typed command using libgit2 ancestry operations instead of per-row frontend commands.
- Existing persisted workspace state lacks newer view/filter fields -> Default branches to local view, default tags to `{ local: true, remote: true }`, and keep old state readable.
- Branch context menus currently depend on local/remote mode -> Pass row presence metadata into menu availability decisions so local-only, remote-only, and both-present rows expose only executable actions.
- Multi-line commit entry changes keyboard muscle memory -> Keep buttons visible and add accessible modifier shortcuts rather than hiding commit behind Enter.
- Remote-ref refresh can reload history after fetch bursts -> Existing event dedupe and commit-history force-refresh request guards should prevent stale responses from replacing newer ones.
- Active remote polling can add network traffic or credential prompts -> Poll only the active repository, use `ls-remote` before fetching, skip during pending Git actions, and ignore background failures.
- Icon-only presence can be ambiguous -> Add tooltips and accessible labels for local, remote, unknown/loading, and conflict-like tag states.
