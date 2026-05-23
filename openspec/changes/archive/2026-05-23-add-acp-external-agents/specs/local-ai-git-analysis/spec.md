## ADDED Requirements

### Requirement: Git AI actions route through the selected analysis engine
The system SHALL route Git AI actions through the user's selected analysis engine.

#### Scenario: Local model engine is selected
- **WHEN** the user starts a Git AI action with a local model engine selected
- **THEN** Gitano MUST use the existing local AI execution path for that action
- **AND** local model entitlement, setup, context budgeting, keep-alive, and cache behavior MUST continue to apply

#### Scenario: External agent engine is selected
- **WHEN** the user starts a Git AI action with an external agent engine selected
- **THEN** Gitano MUST use the external ACP agent execution path for that action
- **AND** Gitano MUST NOT send a local model generation request for that action

#### Scenario: Selected external agent is unavailable
- **WHEN** the user starts a Git AI action with an external agent selected but not installed, unavailable, or unauthenticated
- **THEN** Gitano MUST interrupt the action before sending repository context
- **AND** the frontend MUST route the user to the relevant install, availability, or authentication action

### Requirement: External agent Git analysis uses lightweight discovery prompts
The system SHALL send lightweight Git descriptors to external ACP agents instead of full diff hunks or file contents.

#### Scenario: Branch analysis starts with external agent
- **WHEN** the user requests AI analysis for a branch comparison with an external agent selected
- **THEN** the backend MUST resolve the base and head refs to commits
- **AND** the prompt MUST include repository path, action kind, base ref, head ref, comparison mode, resolved base/head SHAs, effective diff base when applicable, changed-file summary, and compact raw diff fingerprint
- **AND** the prompt MUST instruct the agent to inspect the repository with read-only commands such as `git diff`
- **AND** the prompt MUST NOT include full diff hunks or source file contents

#### Scenario: Branch review starts with external agent
- **WHEN** the user requests AI review for a branch comparison with an external agent selected
- **THEN** the prompt MUST identify the selected comparison and changed files without embedding full patch content
- **AND** it MUST instruct the agent to inspect changed executable, test, and config files itself
- **AND** it MUST ask returned findings to include file path, side, line, and end-line anchors that can be matched to changed diff lines

#### Scenario: Commit analysis starts with external agent
- **WHEN** the user requests AI analysis for a commit with an external agent selected
- **THEN** the backend MUST resolve the commit SHA
- **AND** the prompt MUST include commit metadata, changed-file summary, raw fingerprint, and suggested `git show` commands
- **AND** the prompt MUST NOT include the commit patch body

#### Scenario: Commit message generation starts with external agent
- **WHEN** the user requests an AI commit message with an external agent selected
- **THEN** the backend MUST identify the staged-change task and staged tree fingerprint
- **AND** the prompt MUST instruct the agent to inspect staged changes with `git diff --cached`
- **AND** the prompt MUST NOT include full staged diff hunks or source file contents

#### Scenario: Merge conflict suggestions start with external agent
- **WHEN** the user requests AI suggestions for merge conflicts with an external agent selected
- **THEN** the backend MUST include conflict task metadata, conflicted file paths, and unmerged index fingerprint from `git ls-files -u`
- **AND** the prompt MUST instruct the agent to inspect conflicted file stages itself
- **AND** the system MUST NOT modify conflict files automatically

### Requirement: External agent Git analysis streams progress and output
The system SHALL stream external ACP agent updates into Git AI analysis surfaces.

#### Scenario: External agent emits live updates
- **WHEN** an external ACP agent emits assistant text, plan updates, tool calls, permission requests, file reads, or terminal output during a Git AI action
- **THEN** the frontend MUST render those updates for the active action before the final result is available
- **AND** updates MUST remain associated with the active repository, action kind, and run id

#### Scenario: External agent final output is structured
- **WHEN** an external agent returns output that can be parsed into the expected Gitano result type
- **THEN** the analysis surface MUST render the structured final result
- **AND** the parser MUST ignore earlier tool metadata JSON and extract the final structured result when possible
- **AND** the completed run MUST retain enough metadata to identify the selected external agent

#### Scenario: External agent final output is unstructured
- **WHEN** an external agent completes but Gitano cannot parse the expected structured result
- **THEN** the analysis surface MUST show the agent's final summary or transcript as an unstructured result
- **AND** Gitano MUST clearly report that structured findings could not be produced

#### Scenario: External agent action is refreshed
- **WHEN** the user refreshes an external-agent Git AI result
- **THEN** the frontend MUST clear the previous streamed updates for that action
- **AND** the backend MUST start a new external agent prompt turn

### Requirement: External agent cache keys reflect descriptors and options
The system SHALL keep external agent analysis results separate from local model digest cache entries and stale external runs.

#### Scenario: Equivalent action is repeated with external agent
- **WHEN** a user repeats a Git AI action with an external agent selected
- **THEN** Gitano MUST NOT return a cache entry created by a local model engine
- **AND** any eligible external-agent cache key MUST include action kind, external-agent prompt version, agent id, agent version when known, repository identity, Git input digest, and effective ACP config values

#### Scenario: Branch target changes
- **WHEN** base/head refs, resolved SHAs, effective diff base, comparison mode, changed files, or raw diff fingerprint changes for an external branch action
- **THEN** the backend MUST compute a different Git input digest
- **AND** stale branch analysis or review output MUST NOT be returned

#### Scenario: Staged changes change
- **WHEN** the staged tree or staged raw fingerprint changes for an external commit-message action
- **THEN** the backend MUST compute a different Git input digest
- **AND** stale commit-message output MUST NOT be returned

#### Scenario: Conflict state changes
- **WHEN** unmerged index metadata changes for an external merge-conflict action
- **THEN** the backend MUST compute a different Git input digest
- **AND** stale conflict suggestion output MUST NOT be returned

#### Scenario: Engine changes
- **WHEN** the user changes the active analysis engine between local models and external agents
- **THEN** cached results from the previous engine class MUST NOT be treated as fresh results for the new engine class

### Requirement: External agent Git analysis is explicit about data boundary
The system SHALL distinguish external agent analysis from local-only analysis before repository context is sent.

#### Scenario: External agent action starts
- **WHEN** the user starts a Git AI action with an external agent selected
- **THEN** the UI MUST identify the selected external agent as the execution engine
- **AND** the UI MUST NOT label the run as local-only analysis

#### Scenario: Local model action starts
- **WHEN** the user starts a Git AI action with a local model selected
- **THEN** existing local-only messaging MAY be shown
- **AND** repository content MUST be sent only to the configured local runtime

### Requirement: External agent runs accept future per-run option overrides
The system SHALL allow external agent run requests to carry optional config overrides without requiring the settings UI to use them initially.

#### Scenario: Per-run override is provided
- **WHEN** a future caller provides external agent option overrides with a Git AI run request
- **THEN** the backend MUST merge those overrides after global and action-specific external agent config preferences
- **AND** the overrides MUST affect the ACP session config applied before prompting
