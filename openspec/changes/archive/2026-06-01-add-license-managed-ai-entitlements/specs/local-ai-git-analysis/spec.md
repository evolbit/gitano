## ADDED Requirements

### Requirement: Git AI actions require premium AI entitlement
The system SHALL require a valid premium AI entitlement before any Git AI action processes repository context or starts an AI engine.

#### Scenario: Entitled user starts a Git AI action
- **WHEN** the user has a valid license that entitles premium AI features
- **AND** the user starts a commit message, commit analysis, branch analysis, branch review, or merge conflict suggestion action
- **THEN** Gitano MUST allow the action to continue through the existing selected analysis engine flow

#### Scenario: Free user starts a Git AI action
- **WHEN** the user does not have a valid premium AI entitlement
- **AND** the user starts a commit message, commit analysis, branch analysis, branch review, or merge conflict suggestion action
- **THEN** the backend MUST reject the action before building repository AI context
- **AND** the frontend MUST present a license-required message instead of showing an AI runtime failure

#### Scenario: License becomes invalid before an AI action
- **WHEN** a previously imported license is expired, revoked, outside its validation grace period, or assigned to another machine
- **AND** the user starts a Git AI action
- **THEN** the backend MUST reject the action before invoking a local model or external agent
- **AND** no repository content MUST be sent to an AI engine for that action
