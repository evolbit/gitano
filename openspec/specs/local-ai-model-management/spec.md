## Purpose

Define premium local AI entitlement, model selection, managed runtime setup, model storage, download progress, and machine compatibility behavior.
## Requirements
### Requirement: Local AI commands are premium gated
The system SHALL enforce premium local AI access at the backend command boundary before downloading models, changing model preferences, or running local AI analysis.

#### Scenario: User has local AI entitlement
- **WHEN** a premium-entitled user starts a local AI setup or analysis action
- **THEN** the backend MUST allow the requested command to continue

#### Scenario: User lacks local AI entitlement
- **WHEN** a user without local AI entitlement starts a local AI setup or analysis action
- **THEN** the backend MUST reject the command with a premium-required response
- **AND** the frontend MUST show the premium requirement without starting a model download or analysis run

#### Scenario: Development entitlement stub is active
- **WHEN** the development entitlement stub is enabled
- **THEN** the backend MUST return an entitlement status that allows local AI commands
- **AND** the entitlement implementation MUST include a TODO for production signed license verification

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

### Requirement: Local AI reports runtime and model status
The system SHALL detect managed runtime availability, installed models, model digests, and loaded runners before model setup or analysis actions.

#### Scenario: Managed runtime is unavailable
- **WHEN** the backend cannot reach the Gitano-managed local AI runtime
- **THEN** model status MUST report the runtime as unavailable
- **AND** the frontend MUST offer to prepare the runtime and selected model

#### Scenario: Selected model is installed
- **WHEN** the selected model exists in the Ollama local model list
- **THEN** model status MUST include the installed model digest and size when available

#### Scenario: Selected model is already running
- **WHEN** the selected model appears in the Ollama running model list
- **THEN** model status MUST mark the runner as warm
- **AND** analysis actions MUST reuse the running model instead of forcing a new pull

### Requirement: Local AI manages runtime and model storage by default
The system SHALL install and run a Gitano-managed local runtime by default, with model weights scoped to Gitano local AI data.

#### Scenario: Managed runtime is missing
- **WHEN** a premium-entitled user starts setup and the managed runtime binary is not present
- **THEN** the backend MUST download and install the managed runtime before pulling the selected model
- **AND** the frontend MUST show `Downloading runtime...` progress before model download progress

#### Scenario: Machine storage is reported
- **WHEN** compatibility checks report model-storage disk space
- **THEN** the reported path MUST reflect Gitano local AI model storage by default
- **AND** the managed runtime MUST be started with model storage scoped to that path

#### Scenario: External runtime is explicitly configured
- **WHEN** `OLLAMA_HOST` is set for development
- **THEN** Gitano MAY use that external runtime instead of the managed runtime
- **AND** model placement MAY be controlled by that external runtime

### Requirement: Model setup streams download progress
The system SHALL stream model setup progress to the frontend while pulling or verifying a selected model.

#### Scenario: Pull progress includes byte totals
- **WHEN** runtime or model download progress reports completed and total bytes
- **THEN** the backend MUST emit a progress event with completed bytes, total bytes, and percentage
- **AND** the frontend MUST render a determinate progress indicator

#### Scenario: Model download starts after runtime setup
- **WHEN** the managed runtime is ready and the selected model pull begins
- **THEN** the backend MUST emit progress labeled `Downloading model <model-id>...`
- **AND** progress MUST remain keyed by the same setup operation id

#### Scenario: Setup progress reports only a status phase
- **WHEN** runtime setup or model pull reports a status without byte totals
- **THEN** the backend MUST emit the status text
- **AND** the frontend MUST render an indeterminate setup state with the current status

#### Scenario: Model setup completes
- **WHEN** the selected model download and verification completes
- **THEN** the backend MUST refresh installed model metadata
- **AND** the frontend MUST show the model as ready for local AI actions

#### Scenario: Model setup fails
- **WHEN** the selected model pull fails
- **THEN** the backend MUST emit a failed progress state with a user-facing error
- **AND** the frontend MUST keep the selected model marked as not ready

### Requirement: Machine compatibility warnings protect model setup
The system SHALL evaluate selected model requirements against detected machine and disk characteristics before download and before first run.

#### Scenario: Machine satisfies selected model guidance
- **WHEN** the selected model is compatible with detected machine and disk characteristics
- **THEN** the frontend MUST allow setup without a compatibility warning

#### Scenario: Selected model may run slowly
- **WHEN** detected memory or hardware characteristics are below the selected model recommendation but above hard blockers
- **THEN** the frontend MUST warn that the model may run slowly
- **AND** the frontend MUST allow the user to continue explicitly

#### Scenario: Selected model lacks disk space
- **WHEN** available model-storage disk space is below the selected model minimum
- **THEN** the frontend MUST block download
- **AND** the frontend MUST show the required and available disk space

#### Scenario: Smaller model is available
- **WHEN** the selected model is likely too large for the detected machine
- **THEN** the frontend MUST offer a smaller compatible model when one exists in the registry

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

#### Scenario: Older backend rejects an action-specific clear
- **WHEN** the user clears an action-specific model and the running backend rejects the empty model id as unsupported
- **THEN** the frontend MUST keep the action selector cleared
- **AND** future loaded preferences in that frontend session MUST preserve the cleared action state
- **AND** the settings modal MUST NOT show the raw unsupported-model error for the unset placeholder

#### Scenario: Selected model is not ready
- **WHEN** the user starts an AI action whose selected model is not installed
- **THEN** the frontend MUST route the user through model setup before running the action

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

