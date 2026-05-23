## ADDED Requirements

### Requirement: External agent commit message generation is usable from the commit UI
The system SHALL allow users to generate a commit message from the commit UI when the selected analysis engine is an external agent.

#### Scenario: External agent commit message succeeds
- **WHEN** the user has staged changes and requests an AI commit message with an external agent selected
- **THEN** Gitano MUST run the commit-message action through the selected external agent path
- **AND** the commit message textarea MUST be filled with the structured message returned by the action

#### Scenario: Action-specific external agent overrides local global engine
- **WHEN** the global analysis engine is a local model and the commit-message action is configured to use an external agent
- **THEN** Gitano MUST use the external agent for commit message generation
- **AND** local model readiness MUST NOT block that action-specific external-agent run
