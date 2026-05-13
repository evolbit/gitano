## ADDED Requirements

### Requirement: Stash surfaces synchronize with repository-change events
The system SHALL refresh stash data when backend repository-change events indicate stash-related updates.

#### Scenario: Stash is created, dropped, or popped externally
- **WHEN** stash entries change outside the app for the active repository
- **THEN** the backend MUST emit a repository-change event containing the `stashes` kind
- **THEN** the stash list UI MUST refresh to reflect the updated stash entries without manual reload

#### Scenario: Stash metadata remains unchanged
- **WHEN** a repository-change event does not include the `stashes` kind
- **THEN** stash list refresh MUST NOT run solely because unrelated repository-change kinds were emitted
