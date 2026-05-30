## ADDED Requirements

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
