## MODIFIED Requirements

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

### Requirement: Local AI settings are managed from a dedicated modal
The system SHALL provide a settings modal for local AI runtime, model, external agents, analysis engine, and action configuration.

#### Scenario: External Agents pane is selected
- **WHEN** the user selects External Agents
- **THEN** the modal MUST show curated agents, adapter availability, authentication, install/remove, and set-default actions according to backend status
- **AND** install/remove actions MUST apply only to Gitano-managed ACP adapter distributions and metadata
- **AND** unavailable npm-backed adapters MUST show a compact warning that names npm and the affected ACP adapter package
- **AND** an installed adapter with unverified provider authentication MUST NOT be labeled as authenticated or ready
