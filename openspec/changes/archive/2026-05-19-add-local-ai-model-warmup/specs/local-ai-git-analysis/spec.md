## ADDED Requirements

### Requirement: Local AI actions keep selected models alive
The system SHALL refresh the selected local model's keep-alive lifetime when executing a local AI action.

#### Scenario: Local AI action generates a response
- **WHEN** a local AI action sends an inference request to the local runtime
- **THEN** the request MUST include the configured keep-alive duration
- **AND** the selected model SHOULD remain loaded for subsequent requests while the runtime honors that duration

#### Scenario: Keep-alive is not explicitly configured
- **WHEN** no custom keep-alive duration is persisted
- **THEN** Gitano MUST use a 30 minute keep-alive duration for local AI generate requests

#### Scenario: Action model is not selected
- **WHEN** a local AI action fails because no model is selected for the action
- **THEN** Gitano MUST NOT send a warmup or generation request for that action
