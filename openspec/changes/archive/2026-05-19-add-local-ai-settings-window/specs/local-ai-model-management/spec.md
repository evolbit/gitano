## MODIFIED Requirements

### Requirement: Local AI model registry is curated and inspectable
The system SHALL expose a curated registry of supported local coding models with metadata needed for user selection and compatibility checks.

#### Scenario: Model catalog is loaded
- **WHEN** the frontend requests the local AI model catalog
- **THEN** the backend MUST return supported model entries with id, display name, provider, quality tier, download size, context window, action suitability, minimum requirements, and recommended requirements

#### Scenario: Small coding models are available
- **WHEN** the frontend requests the local AI model catalog
- **THEN** the backend MUST include Qwen2.5 Coder 1.5B, DeepSeek Coder 1.3B, and Phi-4 Mini as supported local coding model choices

#### Scenario: Recommended model is displayed
- **WHEN** the frontend displays model choices
- **THEN** the catalog MUST identify `qwen2.5-coder:7b` as the recommended model option
- **AND** the system MUST NOT use the recommended model as an execution fallback when no supported model has been downloaded

#### Scenario: User wants a larger model
- **WHEN** the user opens model selection
- **THEN** the frontend MUST show larger quality-oriented choices separately from the recommended default
- **AND** the frontend MUST indicate that larger choices may require longer downloads and slower inference

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
- **THEN** the frontend MUST send a clear preference request for that action
- **AND** the backend MUST remove the persisted action-specific preference

#### Scenario: Selected model is not ready
- **WHEN** the user starts an AI action whose selected model is not installed
- **THEN** the frontend MUST route the user through model setup before running the action

## ADDED Requirements

### Requirement: Local AI settings are managed from a dedicated modal
The system SHALL provide a settings modal for local AI runtime, model, and action configuration.

#### Scenario: Settings are opened from the tab bar
- **WHEN** the user opens the tab-bar three-dot menu and chooses Settings
- **THEN** the system MUST open the settings modal
- **AND** the menu MUST visually match the existing context-menu style

#### Scenario: Settings modal is shown
- **WHEN** the settings modal is open
- **THEN** the modal MUST show an AI-only sidebar
- **AND** the sidebar MUST expose Runtime, Models, and Configuration panes

#### Scenario: Runtime pane is selected
- **WHEN** the user selects Runtime
- **THEN** the modal MUST show runtime status, endpoint, installed version, model storage path, and runtime install or upgrade controls

#### Scenario: Models pane is selected
- **WHEN** the user selects Models
- **THEN** the modal MUST show supported models, downloaded state, download actions, delete actions, and model usage information

#### Scenario: Configuration pane is selected
- **WHEN** the user selects Configuration
- **THEN** the modal MUST show global default and per-action model selectors
- **AND** unset action selectors MUST display a `---` placeholder

### Requirement: Local AI model preferences reconcile with downloaded models
The system SHALL keep local AI preferences compatible with the set of downloaded supported models.

#### Scenario: Preferences are loaded with downloaded models and no global default
- **WHEN** supported local AI models are downloaded and preferences have no global default
- **THEN** the backend MUST promote one downloaded supported model to global default

#### Scenario: Global default model is deleted
- **WHEN** the downloaded model used as global default is deleted and other supported models remain downloaded
- **THEN** the backend MUST choose a remaining downloaded supported model as global default

#### Scenario: Action-specific model is deleted
- **WHEN** a downloaded model used by an action-specific preference is deleted
- **THEN** the backend MUST remove that action-specific preference

#### Scenario: All models are deleted
- **WHEN** all downloaded supported local AI models have been deleted
- **THEN** the backend MUST clear the global default model
- **AND** the backend MUST clear all action-specific model preferences

### Requirement: Local AI settings errors stay in the settings modal
The system SHALL display settings-specific command failures inside the settings modal.

#### Scenario: Settings command fails
- **WHEN** a runtime, model download, model deletion, preference, or settings load command fails while the settings modal is open
- **THEN** the modal MUST show the error message in an inline alert
- **AND** the system MUST NOT route that settings-specific failure through the bottom Git action notice
