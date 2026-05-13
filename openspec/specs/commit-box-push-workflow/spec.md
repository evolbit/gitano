# commit-box-push-workflow Specification

## Purpose
Define commit-box keyboard and push workflow behavior for commit and commit+push actions, including commit-list refresh expectations.

## Requirements
### Requirement: Commit box keyboard shortcuts execute commit intents
The system SHALL support keyboard shortcuts in the current changes commit box for commit and commit+push actions.

#### Scenario: User presses Enter in commit box
- **WHEN** the commit message input is focused and the user presses `Enter`
- **THEN** the system MUST trigger a commit action using the current commit options

#### Scenario: User presses Shift+Enter in commit box
- **WHEN** the commit message input is focused and the user presses `Shift+Enter`
- **THEN** the system MUST trigger commit and push in a single action
- **THEN** the push behavior MUST execute even if the push checkbox is currently unchecked

### Requirement: Commit list refreshes after commit box actions
The system SHALL refresh commit history immediately after successful commit-box commit actions and rely on repository-change events for subsequent history updates.

#### Scenario: Commit succeeds from commit box
- **WHEN** a commit-box action completes successfully
- **THEN** the commit list MUST refresh immediately

#### Scenario: New commits appear after commit-box action
- **WHEN** commit history changes after a commit-box action
- **THEN** repository-change events MUST trigger commit-list refresh without requiring manual reload
- **THEN** the commit list MUST NOT depend on frontend periodic polling to surface newly added commits
