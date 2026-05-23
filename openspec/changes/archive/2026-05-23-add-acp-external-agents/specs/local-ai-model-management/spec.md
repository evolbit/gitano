## ADDED Requirements

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

#### Scenario: Action option is unset
- **WHEN** an action-specific external agent config option has no override
- **THEN** the selector MUST show that it is using the global or agent default value
- **AND** selecting the inherit option MUST clear the action-specific override

#### Scenario: Config discovery fails
- **WHEN** ACP config discovery fails for a selected external agent
- **THEN** the engine selector MUST remain usable
- **AND** the row MUST show a compact warning instead of blocking analysis engine selection

## MODIFIED Requirements

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
- **THEN** the modal MUST show curated agents, status, install, authenticate, remove, and set-default actions according to backend status

#### Scenario: Configuration pane is selected
- **WHEN** the user selects Configuration
- **THEN** the modal MUST show the active analysis engine selector
- **AND** local model choices and external agent choices MUST be grouped separately
- **AND** unset action selectors MUST display a `---` placeholder

#### Scenario: External agent engine is active
- **WHEN** the Configuration pane is shown with an external agent selected
- **THEN** local model warmup controls MUST NOT be shown as active controls for that engine
- **AND** external agent status and authentication controls MUST be reachable from the settings surface
