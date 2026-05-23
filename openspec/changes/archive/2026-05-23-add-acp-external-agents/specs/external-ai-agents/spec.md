## ADDED Requirements

### Requirement: Curated ACP external agents are available
The system SHALL expose a curated catalog of ACP-backed external agents that can be used as Gitano analysis engines.

#### Scenario: External agent catalog is loaded
- **WHEN** the frontend requests available external agents
- **THEN** the backend MUST return curated agent entries with id, display name, provider, description, install support, platform support, installed status, authenticated status, version when known, authentication methods, and availability state

#### Scenario: Codex CLI is offered
- **WHEN** external agent support is available on the current platform
- **THEN** the curated catalog MUST include a Codex CLI agent entry
- **AND** the Codex CLI entry MUST use the stable agent id `codex-acp`

#### Scenario: Additional curated agents are offered
- **WHEN** external agent support is available on the current platform
- **THEN** the curated catalog MUST include Claude Agent and Gemini CLI entries when their curated install metadata is available
- **AND** the Claude Agent entry MUST use the stable agent id `claude-acp`
- **AND** the Gemini CLI entry MUST use the stable agent id `gemini`

#### Scenario: Curated agent is unavailable on the current platform
- **WHEN** an external agent cannot be installed or executed on the current platform
- **THEN** the catalog MUST mark that agent as unavailable
- **AND** the frontend MUST NOT allow that unavailable agent to be selected for analysis execution

### Requirement: External agents are selected separately from local models
The system SHALL present external agents as analysis engines, not as local AI models.

#### Scenario: Analysis engine selector is shown
- **WHEN** the user opens an AI engine or model selector
- **THEN** the selector MUST group local models and external agents under separate section labels
- **AND** external agents MUST NOT appear as local model entries

#### Scenario: User selects an external agent
- **WHEN** the user selects a curated external agent as the active analysis engine
- **THEN** the system MUST persist an engine selection with type `external_agent` and the selected agent id
- **AND** local model warmup controls MUST be disabled or hidden for that active engine

#### Scenario: User selects a local model
- **WHEN** the user selects a local model as the active analysis engine
- **THEN** the system MUST persist an engine selection with type `local_model` and the selected local model id
- **AND** local model warmup controls MAY be shown for downloaded supported local models

### Requirement: External agent lifecycle is backend managed
The system SHALL manage curated external agent installation, detection, authentication, logout, and removal through backend-owned commands.

#### Scenario: Agent install is requested
- **WHEN** the user asks Gitano to install a curated external agent
- **THEN** the backend MUST resolve the curated install source for the current platform
- **AND** the backend MUST install the adapter into Gitano-managed storage or through the curated package command
- **AND** the backend MUST stream install status to the frontend until the install succeeds or fails

#### Scenario: Installed agent is detected
- **WHEN** the backend refreshes external agent status
- **THEN** it MUST detect whether each curated agent can be executed
- **AND** it MUST return the detected version when available
- **AND** it MUST treat unsupported or incompatible version commands as unavailable without crashing the settings surface

#### Scenario: Agent requires authentication
- **WHEN** a selected external agent reports that authentication is required
- **THEN** the frontend MUST show the agent-owned authentication methods
- **AND** Gitano MUST NOT start an analysis prompt for that agent until authentication is complete

#### Scenario: Agent logout is requested
- **WHEN** the user requests logout for an authenticated external agent
- **THEN** the backend MUST invoke the agent's supported logout behavior
- **AND** the refreshed status MUST show the agent as unauthenticated when logout succeeds

#### Scenario: Agent removal is requested
- **WHEN** the user removes a Gitano-installed external agent
- **THEN** the backend MUST remove Gitano-managed agent files for that agent
- **AND** the active analysis engine MUST be cleared or changed to an available local-model engine if the removed agent was selected

### Requirement: ACP session configuration is agent-provided
The system SHALL discover and apply external agent session configuration through ACP instead of hard-coded provider settings.

#### Scenario: Session config is discovered
- **WHEN** settings need configuration controls for a selected external agent
- **THEN** the backend MUST create a probe ACP session using the active repository path when available
- **AND** it MUST return the `configOptions` exposed by `session/new`
- **AND** discovery failure MUST leave the external agent selectable while showing a compact row-level warning

#### Scenario: Select config options are rendered
- **WHEN** an external agent exposes `select` config options
- **THEN** the settings UI MUST render those options in the order provided by the agent
- **AND** option labels, values, descriptions, and current values MUST come from the ACP response

#### Scenario: Config preferences are persisted
- **WHEN** the user selects a global external agent config value
- **THEN** Gitano MUST persist it per agent id and config id
- **WHEN** the user selects an action-specific external agent config value
- **THEN** Gitano MUST persist it per action kind, agent id, and config id
- **AND** action-specific values MUST override global values for that action

#### Scenario: Config preferences are applied
- **WHEN** an external agent run starts
- **THEN** Gitano MUST merge global agent config values, action-specific values, and per-run overrides
- **AND** it MUST call `session/set_config_option` for valid available `select` values before `session/prompt`
- **AND** unavailable or invalid stored values MUST be skipped without failing the run

#### Scenario: Legacy modes are exposed
- **WHEN** an older ACP agent exposes `modes` but not `configOptions`
- **THEN** Gitano MUST expose those modes as a fallback mode selector
- **AND** selected fallback modes MUST be applied with `session/set_mode`

### Requirement: ACP prompt turns stream live updates
The system SHALL stream ACP session updates from selected external agents to the AI analysis UI while a prompt turn is running.

#### Scenario: External agent analysis starts
- **WHEN** the user starts an AI action with an external agent selected
- **THEN** the backend MUST create an ACP session for the selected agent
- **AND** the frontend MUST show a live running state before the final result is available

#### Scenario: Agent emits assistant text
- **WHEN** the selected ACP agent emits assistant text updates
- **THEN** Gitano MUST append streamed text to the active transcript for final parsing
- **AND** the activity timeline MUST avoid showing partial structured JSON chunks as standalone progress rows

#### Scenario: Agent emits tool or terminal activity
- **WHEN** the selected ACP agent emits tool call, plan, terminal output, file-read, or permission-request updates
- **THEN** the frontend MUST render those updates as live activity for the active analysis run
- **AND** the activity MUST remain associated with the originating run id

#### Scenario: Activity rows are long
- **WHEN** an external agent activity message exceeds the visible row width
- **THEN** the UI MUST collapse the row to one visible line with an ellipsis by default
- **AND** the row MUST reveal a down-chevron affordance on hover or focus
- **AND** expanding the row MUST show wrapped text with an up-chevron affordance
- **AND** expanded content MUST NOT create a horizontal modal scrollbar

#### Scenario: Activity list grows
- **WHEN** new external agent activity is appended while the modal is open
- **THEN** the modal body MUST scroll to the newest visible activity message

#### Scenario: Agent prompt turn completes
- **WHEN** the ACP prompt turn completes successfully
- **THEN** Gitano MUST finalize the active analysis run
- **AND** the analysis surface MUST render the normalized Gitano result when one can be produced

#### Scenario: Agent prompt turn is cancelled
- **WHEN** the user cancels an external agent analysis run
- **THEN** the backend MUST request cancellation for the active ACP prompt turn
- **AND** the frontend MUST mark the active run as cancelled without rendering it as a successful result

#### Scenario: Agent connection stalls
- **WHEN** the ACP transport receives no response from an active agent for the configured idle timeout
- **THEN** Gitano MUST emit a failed external-agent run event
- **AND** the user-facing error MUST say that the external agent connection appears stalled and suggest checking internet connectivity
- **AND** partial output MUST NOT be presented as a completed result

### Requirement: External agent execution is read-only by default
The system SHALL keep external agent analysis explicit and non-mutating by default.

#### Scenario: External agent will inspect repository context
- **WHEN** the user starts an AI action with an external agent selected
- **THEN** the UI MUST identify the selected external agent before execution
- **AND** the UI MUST indicate that repository context is handled by the user's configured agent account or credentials

#### Scenario: Agent requests file read
- **WHEN** an ACP agent requests repository file content through supported file-read methods
- **THEN** Gitano MUST allow reads only for files inside the active repository
- **AND** it MUST reject path escapes outside that repository

#### Scenario: Agent requests read-only terminal inspection
- **WHEN** an ACP agent requests a terminal command needed for repository inspection
- **THEN** Gitano MAY auto-allow known read-only Git commands such as `git diff`, `git status`, `git show`, `git log`, `git ls-files`, `git rev-parse`, and `git merge-base`
- **AND** Gitano MUST sanitize those commands with pager, color, and external-diff disabling configuration

#### Scenario: Agent requests mutation
- **WHEN** an ACP agent requests file writes, edit tools, output redirection, path escapes, shell control operators, or destructive Git commands
- **THEN** Gitano MUST deny the request for analysis runs
- **AND** denied requests MUST NOT modify repository files or execute destructive commands

#### Scenario: Analysis result is generated
- **WHEN** an external agent produces an analysis or review result
- **THEN** Gitano MUST NOT apply repository file changes automatically
- **AND** Gitano MUST NOT submit remote PR feedback automatically
