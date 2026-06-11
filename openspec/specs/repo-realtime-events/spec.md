## Purpose

Define backend-driven repository realtime change detection and frontend event routing so repository surfaces refresh near real-time without periodic commit polling.

## Requirements

### Requirement: Backend emits typed repository-change events
The system SHALL detect local repository state changes and emit a typed backend event payload for the affected repository.

#### Scenario: Repository refs change
- **WHEN** `HEAD`, branch refs, tag refs, stash refs, or packed refs change for a watched repository
- **THEN** the backend MUST emit a repository-change event for that `repoPath`
- **THEN** the payload MUST include one or more matching change kinds from `head`, `branches`, `tags`, or `stashes`

#### Scenario: Index changes
- **WHEN** the repository index changes
- **THEN** the backend MUST emit a repository-change event containing the `index` change kind

### Requirement: Working-tree updates are detected for tracked and untracked files
The system SHALL detect working-tree changes that affect repository file state, including tracked and untracked files.

#### Scenario: Tracked file is modified
- **WHEN** a tracked working-tree file is added, deleted, or modified outside or inside the app
- **THEN** the backend MUST emit a repository-change event containing the `working-tree` change kind

#### Scenario: Untracked file set changes
- **WHEN** an untracked file is created, removed, or renamed in the working tree
- **THEN** the backend MUST emit a repository-change event containing the `working-tree` change kind

### Requirement: Realtime events are coalesced and deduplicated before dispatch
The system SHALL debounce bursty watcher activity and emit only meaningful repository-change events.

#### Scenario: Burst of file watcher notifications
- **WHEN** multiple filesystem notifications occur within the debounce window for the same repository
- **THEN** the backend MUST coalesce them into a bounded number of emitted repository-change events
- **THEN** emitted events MUST contain only the change kinds that differ from the previous repository snapshot

### Requirement: Frontend consumes repository-change events through a centralized subscription router
The system SHALL process backend repository-change events through a shared frontend subscription hook instead of per-component transport listeners.

#### Scenario: Relevant repository event arrives
- **WHEN** a repository-change event arrives for a repository currently represented in the frontend workspace
- **THEN** the centralized router MUST dispatch targeted refresh triggers for each affected change kind
- **THEN** UI surfaces bound to those data sources MUST update without requiring manual reload

#### Scenario: Irrelevant repository event arrives
- **WHEN** a repository-change event arrives for a `repoPath` not currently represented in active workspace state
- **THEN** the frontend router MUST ignore it for view refresh purposes

### Requirement: Remote-ref changes refresh commit history surfaces
The system SHALL refresh commit history and graph surfaces when watched remote refs change.

#### Scenario: Fetched remote branch advances
- **WHEN** a watched repository receives a repository-change event containing `remote-refs`
- **THEN** the frontend router MUST dispatch a commit-history refresh for that repository
- **THEN** commit graph and commit list surfaces MUST be refreshed before presenting stale history as current

#### Scenario: Remote refs change without local branch movement
- **WHEN** only refs under `refs/remotes/` change for a watched repository
- **AND** local branch refs and `HEAD` do not change
- **THEN** the system MUST still refresh commit history and graph data
- **THEN** the system MUST NOT require manual reload or periodic polling to show newly fetched remote commits

#### Scenario: Remote-ref event burst occurs
- **WHEN** multiple remote-ref filesystem notifications arrive during one fetch operation
- **THEN** the existing realtime dedupe and request guards MUST prevent older refresh responses from replacing newer commit history state

### Requirement: Active repository polls remote tips
The system SHALL detect server-side origin branch tip changes for the active repository without requiring the user to press Fetch manually.

#### Scenario: Active repository remote tip changes
- **WHEN** the active repository poller observes an `origin` branch tip whose server SHA differs from the local `refs/remotes/origin/*` SHA
- **THEN** the system MUST fetch the active repository
- **AND** dispatch repo-ref and commit-history refresh events after the fetch succeeds

#### Scenario: Active tab changes to another repository
- **WHEN** the user changes the active tab from one repository to another repository
- **THEN** the system MUST stop polling the previous repository
- **AND** poll only the new active repository

#### Scenario: Foreground Git action is running
- **WHEN** a commit, push, pull, branch, stash, or other Git action is pending
- **THEN** the active remote poller MUST skip background remote checks until a later poll interval
