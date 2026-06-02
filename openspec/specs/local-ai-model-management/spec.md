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

### Requirement: Local AI exposes model warmup metadata
The system SHALL expose warmup metadata for each supported local AI model so the UI can explain memory impact before a user keeps a model warm.

#### Scenario: Model catalog includes warmup metadata
- **WHEN** the frontend requests the local AI model catalog
- **THEN** each model entry MUST include an estimated warm memory value in GB
- **AND** each model entry MUST include a warm memory class

#### Scenario: Warm memory class is derived locally
- **WHEN** a model entry is produced from the curated registry
- **THEN** the memory class MUST be derived from Gitano-owned local catalog data
- **AND** the frontend MUST NOT maintain a separate model memory table

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

### Requirement: Warmup memory warnings protect model selection
The system SHALL warn before enabling warmup when selected warm models may reserve a high amount of memory.

#### Scenario: Cumulative warm memory crosses baseline threshold
- **WHEN** the user enables warmup and the estimated cumulative warm memory exceeds 5 GB
- **THEN** the frontend MUST show a warning with the estimated memory total
- **AND** the user MUST explicitly confirm before the preference is persisted

#### Scenario: Warm memory is high relative to machine memory
- **WHEN** detected total memory is available and estimated cumulative warm memory exceeds a high share of total memory
- **THEN** the frontend MUST show a stronger warning before persisting the preference
- **AND** the user MUST be allowed to continue explicitly

#### Scenario: Total memory is unavailable
- **WHEN** detected total memory is unavailable
- **THEN** the frontend MUST still warn based on the estimated cumulative warm memory and memory class

### Requirement: AI settings expose analysis engine selection
The system SHALL let users choose the active AI analysis engine from local models and curated external agents.

#### Scenario: Engine selector groups choices
- **WHEN** the settings UI renders the analysis engine selector
- **THEN** it MUST group downloaded local models and available external agents under separate section labels
- **AND** external agents MUST NOT be mixed into the local model list

#### Scenario: External agent engine is selected
- **WHEN** the user selects an external agent as the active analysis engine
- **THEN** the system MUST persist the selected engine as an external agent selection
- **AND** local model warmup controls MUST be hidden or disabled for the active selection

#### Scenario: Local model engine is selected
- **WHEN** the user selects a local model as the active analysis engine
- **THEN** the system MUST persist the selected engine as a local model selection
- **AND** existing local model setup and warmup controls MUST remain available according to the selected model's status

### Requirement: AI settings expose external agent session options
The system SHALL show ACP-provided external agent session options in Settings when an external agent engine is selected.

#### Scenario: Global external agent is selected
- **WHEN** the Global Default engine is an external agent
- **THEN** the Configuration pane MUST discover that agent's ACP session config options
- **AND** it MUST render supported select options directly under the Global Default row
- **AND** saved values MUST be persisted as global defaults for that agent

#### Scenario: Action external agent is selected
- **WHEN** an action row is configured to use an external agent
- **THEN** the Configuration pane MUST render that agent's supported select options directly under that action row
- **AND** saved values MUST be persisted as action-specific overrides for that action and agent

#### Scenario: Selected external agent changes
- **WHEN** a settings row changes from one external agent to another external agent
- **THEN** the Configuration pane MUST discover the newly selected agent's ACP session config options
- **AND** the row MUST stop presenting the previous agent's model, mode, or session option values as selectable values for the newly selected agent

#### Scenario: Different agents expose different model options
- **WHEN** Copilot, Codex, Gemini, Claude, or another curated external agent exposes model or mode choices through ACP
- **THEN** the Configuration pane MUST use the selected agent's ACP labels, values, descriptions, and current values
- **AND** it MUST NOT use a hard-coded shared model list for all external agents
- **AND** it MUST NOT reuse another agent's saved model value unless the selected agent also exposes that value

#### Scenario: Action option is unset
- **WHEN** an action-specific external agent config option has no override
- **THEN** the selector MUST show that it is using the global or agent default value
- **AND** selecting the inherit option MUST clear the action-specific override

#### Scenario: Config discovery fails
- **WHEN** ACP config discovery fails for a selected external agent
- **THEN** the engine selector MUST remain usable
- **AND** the row MUST show a compact warning instead of blocking analysis engine selection

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

### Requirement: Local AI model warmup preferences are persisted
The system SHALL persist which downloaded local AI models the user wants Gitano to keep warm while the active analysis engine is a local model.

#### Scenario: User enables warmup for a downloaded model
- **WHEN** the user checks `Keep this model warm` for a downloaded supported model while a local model engine is active
- **THEN** the backend MUST persist that model id in local AI warm preferences
- **AND** future settings loads MUST show the checkbox as selected
- **AND** the backend MUST immediately start the local runtime when needed and send a keep-alive warmup request for that model

#### Scenario: User disables warmup for a model
- **WHEN** the user clears `Keep this model warm` for a supported model
- **THEN** the backend MUST remove that model id from local AI warm preferences
- **AND** future warmup passes MUST NOT warm that model
- **AND** the backend MUST ask the local runtime to unload the model when it is currently running

#### Scenario: Active engine changes to an external agent
- **WHEN** the active analysis engine changes from a local model to an external agent
- **THEN** the backend MUST clear all persisted warm model preferences
- **AND** future startup warmup passes MUST NOT warm local models for the external agent selection
- **AND** the backend SHOULD ask the local runtime to unload currently warm models when the runtime supports it

#### Scenario: Warm model is deleted
- **WHEN** a model that is selected for warmup is deleted
- **THEN** the backend MUST remove that model id from warm preferences

#### Scenario: All models are deleted
- **WHEN** all downloaded supported local AI models have been deleted
- **THEN** the backend MUST clear all warm model preferences

### Requirement: Local AI settings are managed from a dedicated modal
The system SHALL provide a settings modal for local AI runtime, model, external agents, analysis engine, and action configuration.

#### Scenario: Settings are opened from the tab bar
- **WHEN** the user opens the tab-bar three-dot menu and chooses Settings
- **THEN** the system MUST open the settings modal
- **AND** the menu MUST visually match the existing context-menu style

#### Scenario: Settings modal is shown
- **WHEN** the settings modal is open
- **THEN** the modal MUST show an AI-only sidebar
- **AND** the sidebar MUST expose Runtime, Models, External Agents, and Configuration panes

#### Scenario: Runtime pane is selected
- **WHEN** the user selects Runtime
- **THEN** the modal MUST show runtime status, endpoint, installed version, model storage path, and runtime install or upgrade controls

#### Scenario: Models pane is selected
- **WHEN** the user selects Models
- **THEN** the modal MUST show supported models, downloaded state, download actions, delete actions, warmup controls for eligible local models, and model usage information

#### Scenario: External Agents pane is selected
- **WHEN** the user selects External Agents
- **THEN** the modal MUST show curated agents, adapter availability, authentication, install/remove, and set-default actions according to backend status
- **AND** install/remove actions MUST apply only to Gitano-managed ACP adapter distributions and metadata
- **AND** unavailable npm-backed adapters MUST show a compact warning that names npm and the affected ACP adapter package
- **AND** an installed adapter with unverified provider authentication MUST NOT be labeled as authenticated or ready

#### Scenario: Configuration pane is selected
- **WHEN** the user selects Configuration
- **THEN** the modal MUST show the active analysis engine selector
- **AND** local model choices and external agent choices MUST be grouped separately
- **AND** unset action selectors MUST display a `---` placeholder

#### Scenario: External agent engine is active
- **WHEN** the Configuration pane is shown with an external agent selected
- **THEN** local model warmup controls MUST NOT be shown as active controls for that engine
- **AND** external agent status and authentication controls MUST be reachable from the settings surface

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

### Requirement: Local AI settings can warm selected models
The system SHALL allow the settings surface to trigger warmup only for installed models selected by warm preferences while a local model engine is active.

#### Scenario: Warmup is requested for local model engine
- **WHEN** the frontend asks Gitano to warm configured models and the active analysis engine is a local model
- **THEN** the backend MUST start the managed runtime when installed
- **AND** the backend MUST send keep-alive warmup requests only for installed supported models selected in warm preferences

#### Scenario: Warmup is requested for external agent engine
- **WHEN** the frontend asks Gitano to warm configured models and the active analysis engine is an external agent
- **THEN** the backend MUST NOT start the local AI runtime for warmup
- **AND** the backend MUST NOT send warmup requests for any local model
- **AND** the response MUST report no warmed model ids

#### Scenario: Warmup fails for one model
- **WHEN** one selected model fails to warm while a local model engine is active
- **THEN** the settings modal MUST show the warmup failure inside the modal
- **AND** the failure MUST NOT clear the warm preference automatically

#### Scenario: Model is not downloaded
- **WHEN** a model is not downloaded
- **THEN** the settings UI MUST NOT allow `Keep this model warm` to be enabled for that model

### Requirement: Local AI settings errors stay in the settings modal
The system SHALL display settings-specific command failures inside the settings modal.

#### Scenario: Settings command fails
- **WHEN** a runtime, model download, model deletion, preference, or settings load command fails while the settings modal is open
- **THEN** the modal MUST show the error message in an inline alert
- **AND** the system MUST NOT route that settings-specific failure through the bottom Git action notice

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
