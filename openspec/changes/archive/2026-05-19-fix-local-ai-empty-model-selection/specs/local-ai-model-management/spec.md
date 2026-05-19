## MODIFIED Requirements

### Requirement: Users can switch local AI models
The system SHALL let users choose a global default model and per-action model preferences for local AI actions while preserving explicit unset states for action-specific selections.

#### Scenario: First model is downloaded
- **WHEN** a supported local AI model download succeeds and no supported local AI models were previously downloaded
- **THEN** the backend MUST persist that model as the global default

#### Scenario: User changes global default model
- **WHEN** the user selects a new global local AI model
- **THEN** the system MUST persist the preference locally
- **AND** the global default MUST remain set while at least one supported local AI model is downloaded

#### Scenario: User tries to unset global default model
- **WHEN** the user attempts to clear the global default while supported local AI models remain downloaded
- **THEN** the system MUST reject the change
- **AND** the frontend MUST keep a concrete global model selected

#### Scenario: User changes an action-specific model
- **WHEN** the user selects a model for a specific AI action
- **THEN** the system MUST persist that action-specific preference locally
- **AND** only that action MUST use the action-specific model by default

#### Scenario: User clears an action-specific model
- **WHEN** the user selects the unset placeholder for a specific AI action
- **THEN** the frontend MUST send a string-compatible clear preference request for that action
- **AND** the backend MUST remove the persisted action-specific preference

#### Scenario: Selected model is not ready
- **WHEN** the user starts an AI action whose selected model is not installed
- **THEN** the frontend MUST route the user through model setup before running the action
