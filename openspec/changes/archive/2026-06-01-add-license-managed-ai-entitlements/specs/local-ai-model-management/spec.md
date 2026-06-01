## ADDED Requirements

### Requirement: Local AI setup and execution controls require premium AI entitlement
The system SHALL require a valid premium AI entitlement before users can enable local AI execution through model setup, runtime preparation, or AI-specific preferences.

#### Scenario: Entitled user opens local AI setup
- **WHEN** the user has a valid license that entitles premium AI features
- **THEN** Gitano MUST allow local AI setup, model selection, runtime preparation, model preparation, and AI execution preferences to operate normally

#### Scenario: Free user opens local AI setup
- **WHEN** the user does not have a valid premium AI entitlement
- **THEN** Gitano MUST show that local AI requires a premium license
- **AND** Gitano MUST NOT allow runtime or model preparation actions that exist solely to enable premium AI execution

#### Scenario: Backend receives local AI setup command without entitlement
- **WHEN** a backend command that prepares local AI runtime, prepares a local AI model, deletes a local AI model for AI management, warms configured models, or changes AI execution preferences is called without premium AI entitlement
- **THEN** the backend MUST reject the command through the centralized license guard
- **AND** the command MUST return a user-facing license-required reason

#### Scenario: License status changes while settings are open
- **WHEN** the license status changes while the settings or local AI setup UI is open
- **THEN** local AI controls MUST update to reflect the new locked or unlocked state
