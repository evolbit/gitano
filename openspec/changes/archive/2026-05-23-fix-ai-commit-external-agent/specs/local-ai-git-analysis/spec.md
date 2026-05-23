## ADDED Requirements

### Requirement: Commit message generation gates local setup by engine type
The system SHALL only require local model readiness before commit message generation when the effective selected engine for the commit-message action is a local model.

#### Scenario: Commit message uses local model setup gate
- **WHEN** the user requests an AI commit message and the effective selected engine is a local model
- **THEN** the frontend MUST verify that the selected local model is available before starting the action
- **AND** the frontend MUST keep the existing local setup path when the selected local model is unavailable

#### Scenario: Commit message skips local setup gate for external agent
- **WHEN** the user requests an AI commit message and the effective selected engine is an external agent
- **THEN** the frontend MUST start the AI action without requiring an action-specific local model
- **AND** the frontend MUST NOT query local model status solely to permit that external-agent action

#### Scenario: Action engine inherits global external agent
- **WHEN** the commit-message action has no explicit selected engine and the global analysis engine is an external agent
- **THEN** commit message generation MUST use the global external agent selection
- **AND** the frontend MUST NOT block the action because `actionModelIds.commitMessage` is empty or absent
