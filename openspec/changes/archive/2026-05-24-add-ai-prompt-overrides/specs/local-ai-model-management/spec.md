## ADDED Requirements

### Requirement: AI settings expose per-action prompt overrides
The system SHALL let users configure a prompt override for each Git AI action from Settings.

#### Scenario: Prompt controls are shown for every AI action
- **WHEN** the user opens the AI Configuration pane in Settings
- **THEN** the system MUST show prompt controls for commit message generation, commit review, branch analysis, branch review, and merge conflict suggestions
- **AND** each control MUST identify the action it affects

#### Scenario: User saves a prompt override
- **WHEN** the user edits and saves a prompt override for an AI action
- **THEN** the backend MUST persist that prompt override for only that action
- **AND** subsequent settings loads MUST show the saved override for that action

#### Scenario: User returns to the app default prompt
- **WHEN** the user chooses `Use default value` for an AI action prompt
- **THEN** the backend MUST clear the persisted prompt override for that action
- **AND** subsequent AI runs for that action MUST use Gitano's app-provided default prompt instruction

#### Scenario: Empty prompt override is saved
- **WHEN** the user saves an empty or whitespace-only prompt override
- **THEN** the backend MUST treat it the same as `Use default value`
- **AND** no blank override MUST be persisted for that action

#### Scenario: Prompt overrides coexist with engine settings
- **WHEN** the user changes local model, external agent, warmup, or external agent option settings
- **THEN** existing per-action prompt overrides MUST remain unchanged
