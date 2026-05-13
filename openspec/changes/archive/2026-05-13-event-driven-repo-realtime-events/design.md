## Context

Current repository freshness behavior is split between action-triggered frontend refresh events and independent periodic polling loops (notably commit-list polling). This causes two issues: delayed updates for externally triggered Git changes, and avoidable rerender churn that can appear as UI flicker. The codebase already has a frontend refresh-event pattern (`APP_EVENTS`) and Tauri command/event plumbing, but it does not yet have a backend-originated repository change stream.

This change introduces a cross-cutting architecture: backend repository observation plus a centralized frontend event router. It affects Rust backend modules, frontend hooks, and multiple UI surfaces (commits, changes, stashes, toolbar branch/tag metadata).

## Goals / Non-Goals

**Goals:**
- Deliver near real-time repository updates for commits, working tree, branch refs, tags, and stashes.
- Remove periodic commit-list polling and replace it with backend event-driven refresh.
- Keep frontend subscriptions centralized so components stay simple and data-driven.
- Coalesce bursty filesystem activity into stable, deduplicated refresh signals.

**Non-Goals:**
- Redesign commit table, stash pane, or toolbar visual UI.
- Introduce remote PR API integrations in this change.
- Implement a full Git daemon or long-running indexer.
- Guarantee zero-latency delivery for every filesystem event across all filesystems.

## Decisions

### 1. Emit one typed backend event channel with `kinds[]`
Use a single Tauri event name (e.g., `gitano:repo-changed`) with payload:
- `repoPath: string`
- `kinds: RepoChangeKind[]`
- `timestampMs: number`

`RepoChangeKind` will include at least:
- `working-tree`
- `index`
- `head`
- `branches`
- `tags`
- `stashes`
- `remote-refs`
- `config`

Why: a single channel reduces listener sprawl and lets frontend route refreshes deterministically.

Alternative considered: one event name per domain. Rejected due to higher subscription complexity and duplicated filtering logic.

### 2. Backend watcher observes both `.git` internals and worktree paths
The backend watcher must detect:
- ref-level changes (`HEAD`, `refs/heads`, `refs/tags`, `refs/stash`, `packed-refs`)
- index changes (`.git/index`)
- worktree content changes (tracked/untracked file add/delete/modify)

Why: `.git`-only watching cannot detect unstaged tracked edits or untracked file changes.

Alternative considered: periodic backend `git status` / `git log` hashing only. Rejected as primary mechanism due to avoidable background cost and slower responsiveness under idle-but-changing worktrees.

### 3. Debounce and diff snapshots before emitting
Each repo watcher keeps an in-memory `RepoSnapshot` with signatures:
- `headRef`
- `headOid`
- `branchesSig`
- `tagsSig`
- `stashOid`
- optional `remoteRefsSig`

On filesystem bursts, backend debounces (e.g., 100-300ms), recomputes snapshot, and emits only changed kinds. Worktree events can set `working-tree` eagerly and dedupe repeated bursts in the same debounce window.

Why: prevents event storms and unnecessary frontend refetches.

Alternative considered: emit for every raw fs notification. Rejected because it creates unstable UI and redundant refresh work.

### 4. Frontend uses one centralized subscription hook
Add a top-level hook (e.g., `useRepoRealtimeEvents`) that:
- subscribes once to backend repo-change events
- filters events by `repoPath` for relevant tabs/active workspace
- routes `kinds[]` into existing refresh pathways (`APP_EVENTS` or shared loaders)
- applies a short dedupe window per `repoPath+kind`

Why: keeps components stateless about transport and reduces listener lifecycle bugs.

Alternative considered: component-level subscriptions. Rejected due to duplicated logic and cleanup risk.

### 5. Remove commit-list interval polling; keep action-triggered immediate refresh
`CommitList` no longer owns a periodic `setInterval` refresh loop. Immediate refresh after local actions remains, but all refresh entry points converge on the same event-driven contract.

Why: removes known periodic churn while preserving responsiveness after user actions.

Alternative considered: keep polling as primary and add watcher as secondary. Rejected because it preserves the same periodic repaint pressure this change is intended to remove.

## Risks / Trade-offs

- [Watcher behavior varies across filesystems/platforms] -> Use debounced reconciliation + signature diff as source of truth, not raw event count.
- [Recursive worktree watch can be noisy in large repos] -> Exclude `.git` from worktree stream, coalesce events, and emit only typed deltas.
- [Event/routing bugs may cause missed refresh in a surface] -> Keep targeted integration tests for commits, stashes, branch/tag selector, and working changes.
- [Multi-repo tab lifecycle complexity] -> Scope watcher registration/unregistration to repo-open lifecycle with explicit cleanup.

## Migration Plan

1. Add backend repo-watch manager and typed event payload structs.
2. Add frontend centralized realtime hook and routing integration.
3. Wire commit list, working changes, stash pane, and toolbar branch/tag refresh to routed events.
4. Remove commit-list periodic polling loop and validate no regression in post-commit visibility.
5. Validate behavior for external Git operations (`git commit`, `git stash`, branch/tag create/delete, checkout) performed outside the app.

Rollback strategy:
- Feature-flag the watcher path and keep old interval path behind a temporary fallback switch until validation is complete.

## Open Questions

- Should branch and tag refresh route to only active repo tab or all opened tabs for the same repo path?
- Should `remote-refs` be emitted only after local `fetch/pull/push`, or also from direct `.git/refs/remotes` changes detected externally?
- Do we keep a backend low-frequency self-heal snapshot check (disabled by default) for edge filesystem watcher misses?
