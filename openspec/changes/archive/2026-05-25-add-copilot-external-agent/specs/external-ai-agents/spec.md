## MODIFIED Requirements

### Requirement: Curated ACP external agents are available
The system SHALL expose a curated catalog of ACP-backed external agents that can be used as Gitano analysis engines.

#### Scenario: External agent catalog is loaded
- **WHEN** the frontend requests available external agents
- **THEN** the backend MUST return curated agent entries with id, display name, provider, description, install source when supported, platform support, installed status, authenticated status, version when known, authentication methods, and availability state

#### Scenario: Codex CLI is offered
- **WHEN** external agent support is available on the current platform
- **THEN** the curated catalog MUST include a Codex CLI agent entry
- **AND** the Codex CLI entry MUST use the stable agent id `codex-acp`

#### Scenario: GitHub Copilot CLI is offered
- **WHEN** external agent support is available on the current platform
- **THEN** the curated catalog MUST include a GitHub Copilot CLI agent entry
- **AND** the GitHub Copilot CLI entry MUST use the ACP registry id `github-copilot-cli`
- **AND** the GitHub Copilot CLI launch command MUST start the registry package `@github/copilot` with `--acp`

#### Scenario: Additional curated agents are offered
- **WHEN** external agent support is available on the current platform
- **THEN** the curated catalog MUST include Claude Agent and Gemini CLI entries
- **AND** the Claude Agent entry MUST use the stable agent id `claude-acp`
- **AND** the Gemini CLI entry MUST use the stable agent id `gemini`

#### Scenario: Curated agent is unavailable on the current platform
- **WHEN** an external agent cannot be installed or executed on the current platform
- **THEN** the catalog MUST mark that agent as unavailable
- **AND** the frontend MUST NOT allow that unavailable agent to be selected for analysis execution

### Requirement: External agent lifecycle is backend managed
The system SHALL install, detect, authenticate, log out, run, and forget curated ACP adapter distributions through backend-owned commands while leaving provider account setup external to Gitano.

#### Scenario: Agent install is requested
- **WHEN** the user asks Gitano to install a curated external agent
- **THEN** the backend MUST install or record the selected ACP adapter distribution from curated registry metadata
- **AND** binary distributions MUST be downloaded, extracted, and launched from Gitano's external agent data directory
- **AND** `npx` distributions MUST be recorded as npm-exec adapter metadata under Gitano's external agent data directory

#### Scenario: Binary-distributed agent is detected
- **WHEN** the backend refreshes external agent status
- **AND** the selected agent uses a binary distribution for the current platform
- **THEN** it MUST check for the configured relative command path under Gitano's external agent data directory
- **AND** it MUST return the registry version when the command exists

#### Scenario: Npm-distributed agent is detected
- **WHEN** the backend refreshes external agent status
- **AND** the selected agent uses an `npx` distribution
- **THEN** it MUST check for Gitano-managed adapter metadata
- **AND** it MUST resolve `npm` from PATH plus OS-specific shell-managed binary directories before marking the adapter available
- **AND** it MUST return the registry version when adapter metadata and npm are both available

#### Scenario: Npm is unavailable for an npx adapter
- **WHEN** the selected ACP adapter is distributed through `npx`
- **AND** `npm` cannot be resolved from Gitano's effective search path
- **THEN** the catalog MUST mark that agent as not installed and unavailable
- **AND** the status or setup error MUST state that npm is required for the named ACP adapter package
- **AND** the error MUST NOT imply that the provider CLI itself is the missing command

#### Scenario: External agent command starts
- **WHEN** an external agent run starts
- **THEN** the backend MUST launch the installed binary command or npm-exec command with that agent's curated ACP arguments
- **AND** npm-exec commands MUST use an agent-specific prefix directory under Gitano's external agent data directory
- **AND** the backend MUST pass the effective search path to npm-exec child processes so shell-managed npm shims can resolve their dependencies

#### Scenario: External agent reports intent
- **WHEN** an external agent calls the `report_intent` client method while planning work
- **THEN** the backend MUST acknowledge the request successfully
- **AND** Gitano MUST surface the intent as progress instead of failing the run with an unsupported method error

#### Scenario: Copilot analysis starts in plan mode
- **WHEN** Gitano starts a GitHub Copilot ACP session for a read-only AI analysis action
- **AND** Copilot exposes a mode selector whose current value is plan-oriented
- **AND** the user has not explicitly selected a Copilot mode for the action
- **THEN** the backend SHOULD switch the session to a non-plan action mode before sending the prompt
- **AND** the backend MUST ignore unsupported default-mode changes without failing the run

#### Scenario: External agent ends without JSON
- **WHEN** an external agent prompt turn ends normally without any JSON object in the transcript
- **THEN** the backend SHOULD send one follow-up prompt in the same ACP session requesting only Gitano's required structured JSON result
- **AND** the backend MUST NOT retry provider runtime errors or non-normal stop reasons as structured-output corrections

#### Scenario: External agent final output is not structured
- **WHEN** an external agent run completes but its final transcript cannot be parsed into the required Gitano JSON result shape
- **THEN** the backend MUST fail the AI action instead of converting the transcript into a successful analysis result
- **AND** the error MUST include a reportable debug payload with the parse error, agent id, agent version when known, action kind, run id, repository path, commit SHA or branch refs, comparison mode, effective external agent config values, and final transcript
- **AND** the frontend MUST preserve the exact error string in the global action log and copy/report paths
- **AND** AI action surfaces and result modals MUST show a compact human-readable error paragraph with guidance to see the log for details instead of rendering the full payload inline

#### Scenario: External agent returns a runtime error transcript
- **WHEN** an external agent run returns a plain-text error transcript instead of the required structured JSON result shape
- **THEN** the backend MUST fail the AI action as an external-agent runtime error
- **AND** the error MUST promote the agent error message while preserving reportable debug payload data
- **AND** provider authorization or policy failures MUST NOT be presented primarily as JSON parser failures

#### Scenario: External agent returns only progress text
- **WHEN** an external agent run completes with a transcript that contains progress or planning text but no JSON object
- **THEN** the backend MUST fail the AI action as a missing structured result
- **AND** the error MUST preserve the transcript in reportable debug payload data
- **AND** progress-only transcripts MUST NOT be presented primarily as JSON parser failures

#### Scenario: Agent requires authentication
- **WHEN** a selected external agent reports that authentication is required
- **THEN** the frontend MUST show the agent-owned authentication methods
- **AND** Gitano MUST NOT start an analysis prompt for that agent until authentication is complete

#### Scenario: Adapter is installed but provider authentication is unverified
- **WHEN** a curated external agent adapter is installed and available
- **AND** the backend reports `authenticated: false`
- **THEN** the frontend MUST label the adapter as installed instead of ready or authenticated
- **AND** authentication actions MUST be worded as status refresh unless the backend reports `authenticated: true`

#### Scenario: Agent logout is requested
- **WHEN** the user requests logout for an authenticated external agent
- **THEN** the backend MUST invoke the agent's supported logout behavior when available
- **AND** the refreshed status MUST show the agent as unauthenticated when logout succeeds

#### Scenario: Agent removal is requested
- **WHEN** the user removes or forgets a curated external agent from Gitano
- **THEN** the backend MUST clear Gitano preferences and Gitano-managed adapter metadata for that agent
- **AND** the backend MUST NOT delete provider tools, accounts, or caches outside Gitano's external agent data directory
- **AND** the active analysis engine MUST be cleared or changed to an available local-model engine if the removed agent was selected

### Requirement: ACP session configuration is agent-provided
The system SHALL discover and apply external agent session configuration through ACP instead of hard-coded provider settings.

#### Scenario: Session config is discovered
- **WHEN** settings need configuration controls for a selected external agent
- **THEN** the backend MUST create a probe ACP session using the active repository path when available
- **AND** it MUST return the `configOptions` exposed by `session/new`
- **AND** discovery failure MUST leave the external agent selectable while showing a compact row-level warning

#### Scenario: Session config is scoped to the selected agent
- **WHEN** settings request configuration controls for an external agent
- **THEN** the backend MUST probe the requested agent id
- **AND** the returned session config MUST identify that same agent id
- **AND** the frontend MUST render only the options returned for the selected agent

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

#### Scenario: Agents expose different values for the same config id
- **WHEN** two external agents expose a config option with the same id but different available values
- **THEN** Gitano MUST show only the selected agent's available values
- **AND** Gitano MUST NOT apply a stored value from another agent with the same config id
- **AND** changing the value MUST persist the preference under the selected agent id

#### Scenario: Agent exposes unsupported client-service config options
- **WHEN** an external agent exposes a config option that requires a client service Gitano does not provide, such as permission-service option `allow_all`
- **THEN** Gitano MUST NOT show that option in Settings
- **AND** Gitano MUST skip stale saved values for that option when applying session config
- **AND** Gitano MUST continue applying supported config options for the same agent

#### Scenario: Legacy modes are exposed
- **WHEN** an older ACP agent exposes `modes` but not `configOptions`
- **THEN** Gitano MUST expose those modes as a fallback mode selector
- **AND** selected fallback modes MUST be applied with `session/set_mode`
