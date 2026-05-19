## MODIFIED Requirements

### Requirement: Local AI actions use selected local models
The system SHALL resolve the model for each local AI action from an explicit request model or a persisted action-specific preference before execution.

#### Scenario: Action-specific model exists
- **WHEN** a local AI action has a persisted action-specific model preference
- **THEN** the backend MUST use that model for the action

#### Scenario: Explicit model is provided
- **WHEN** a local AI action request includes an explicit non-empty model id
- **THEN** the backend MUST use the explicit model id for that action request

#### Scenario: No downloaded models exist
- **WHEN** a local AI action starts and no supported local AI models are downloaded
- **THEN** the backend MUST reject the action with `No AI models available`

#### Scenario: No action-specific model exists
- **WHEN** a local AI action starts without an explicit model id and without a persisted action-specific model preference
- **THEN** the backend MUST reject the action with `No AI model selected for [action]`

#### Scenario: Deleted action-specific model was selected
- **WHEN** a previously selected action-specific model has been deleted
- **THEN** the backend MUST treat the action as having no selected model
- **AND** the action MUST fail with `No AI model selected for [action]`

## ADDED Requirements

### Requirement: Local AI action errors use the Git action notice
The system SHALL show local AI action execution errors through the existing bottom Git action notice surface.

#### Scenario: No downloaded models error is returned
- **WHEN** a local AI action fails with `No AI models available`
- **THEN** the frontend MUST show that error in the bottom Git action notice

#### Scenario: No action model selected error is returned
- **WHEN** a local AI action fails with `No AI model selected for [action]`
- **THEN** the frontend MUST show that error in the bottom Git action notice
