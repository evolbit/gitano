## MODIFIED Requirements

### Requirement: Commit list refreshes after commit box actions
The system SHALL refresh commit history immediately after successful commit-box commit actions and rely on repository-change events for subsequent history updates.

#### Scenario: Commit succeeds from commit box
- **WHEN** a commit-box action completes successfully
- **THEN** the commit list MUST refresh immediately

#### Scenario: New commits appear after commit-box action
- **WHEN** commit history changes after a commit-box action
- **THEN** repository-change events MUST trigger commit-list refresh without requiring manual reload
- **THEN** the commit list MUST NOT depend on frontend periodic polling to surface newly added commits
