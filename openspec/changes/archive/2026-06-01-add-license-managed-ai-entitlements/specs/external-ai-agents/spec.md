## ADDED Requirements

### Requirement: External AI agents require premium AI entitlement
The system SHALL require a valid premium AI entitlement before external AI agents can be installed, configured, authenticated through Gitano, selected as analysis engines, or used for Git AI actions.

#### Scenario: Entitled user manages external agents
- **WHEN** the user has a valid license that entitles premium AI features
- **THEN** Gitano MUST allow external agent catalog loading, installation, removal, authentication status refresh, configuration, selection, and execution according to existing external agent requirements

#### Scenario: Free user manages external agents
- **WHEN** the user does not have a valid premium AI entitlement
- **THEN** Gitano MUST show that external AI agents require a premium license
- **AND** Gitano MUST NOT allow installation, selection, configuration changes, or execution of external agents through Gitano

#### Scenario: Backend receives external agent command without entitlement
- **WHEN** an external agent install, remove, authenticate, logout, session configuration, selection, preference, or run command is called without premium AI entitlement
- **THEN** the backend MUST reject the command through the centralized license guard
- **AND** the command MUST return a user-facing license-required reason

#### Scenario: External agent was selected before license became invalid
- **WHEN** an external agent is the selected analysis engine
- **AND** the premium AI entitlement becomes invalid
- **THEN** Gitano MUST keep the preference data but block execution until entitlement is restored
- **AND** Gitano MUST NOT send repository context to the selected external agent while blocked
