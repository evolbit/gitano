## Purpose

Define local AI Git analysis behavior, including backend Git context snapshots, model resolution, structured results, cache keys, locality, and context budgeting.
## Requirements
### Requirement: Local AI actions run against Git context snapshots
The system SHALL build backend-owned Git context snapshots for local AI actions instead of requiring workflow components to assemble prompts.

#### Scenario: Commit message generation starts
- **WHEN** the user requests an AI commit message
- **THEN** the backend MUST build a staged-change snapshot from the repository index
- **AND** the snapshot MUST include enough staged diff context to justify the generated message

#### Scenario: Commit analysis starts
- **WHEN** the user requests AI analysis for a commit
- **THEN** the backend MUST build a commit snapshot from the target commit SHA and its diff against the appropriate parent context

#### Scenario: Branch analysis starts
- **WHEN** the user requests AI analysis for a branch comparison
- **THEN** the backend MUST resolve the base and head refs to commits
- **AND** the snapshot MUST include the changed file summary and diff context for the selected comparison mode
- **AND** the snapshot MUST provide enough branch context to support a report about intent, risk, behavioral impact, tests, recommendations, and action items

#### Scenario: Branch review starts
- **WHEN** the user requests AI review for a branch comparison
- **THEN** the backend MUST resolve the base and head refs to commits
- **AND** the snapshot MUST include changed-line diff context for the selected comparison mode
- **AND** the snapshot MUST preserve enough file path, side, and line information for returned findings to be matched to changed diff lines

#### Scenario: Merge conflict suggestion starts
- **WHEN** the user requests AI suggestions for merge conflicts
- **THEN** the backend MUST build a conflict snapshot from unmerged file paths and available base, ours, theirs, and worktree content
- **AND** the system MUST NOT modify conflict files automatically

### Requirement: Local AI actions use selected local models
The system SHALL resolve the model for each local AI action from an explicit request model or a persisted action-specific preference before execution.

#### Scenario: Action-specific model exists
- **WHEN** a local AI action has a persisted action-specific model preference
- **THEN** the backend MUST use that model for the action

#### Scenario: Explicit model is provided
- **WHEN** a local AI action request includes an explicit non-empty model id
- **THEN** the backend MUST use the explicit model id for that action request

#### Scenario: No downloaded models exist
- **WHEN** a local AI action starts and no supported local AI models are downloaded
- **THEN** the backend MUST reject the action with `No AI models available`

#### Scenario: No action-specific model exists
- **WHEN** a local AI action starts without an explicit model id and without a persisted action-specific model preference
- **THEN** the backend MUST reject the action with `No AI model selected for [action]`

#### Scenario: Deleted action-specific model was selected
- **WHEN** a previously selected action-specific model has been deleted
- **THEN** the backend MUST treat the action as having no selected model
- **AND** the action MUST fail with `No AI model selected for [action]`

### Requirement: Local AI actions prepare the selected model before inference
The system SHALL verify entitlement, runtime availability, model installation, compatibility, and running status before executing a local AI action.

#### Scenario: Selected model is installed
- **WHEN** the user starts a local AI action with an installed selected model
- **THEN** the backend MUST use the installed model digest for execution and cache lookup

#### Scenario: Selected model is missing
- **WHEN** the user starts a local AI action with a selected model that is not installed
- **THEN** the frontend MUST interrupt execution and offer model setup

#### Scenario: Selected model is installed but cold
- **WHEN** the selected model is installed but not currently running
- **THEN** the backend MAY warm the model through the local runtime before generating the response
- **AND** the frontend MUST show that the model is starting

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

### Requirement: Local AI results are structured and evidence-oriented
The system SHALL parse local AI responses into structured Gitano-owned result types for rendering and future workflow reuse.

#### Scenario: Commit message is generated
- **WHEN** AI commit message generation succeeds
- **THEN** the result MUST include one primary commit message
- **AND** the result MAY include alternate messages

#### Scenario: Commit analysis is generated
- **WHEN** AI commit analysis succeeds
- **THEN** the result MUST include a summary and zero or more findings
- **AND** each finding MUST include severity, title, explanation, and file or line evidence when available

#### Scenario: Branch analysis is generated
- **WHEN** AI branch analysis succeeds
- **THEN** the result MUST include a summary, risk assessment, behavioral change summary, potential regressions, test gaps, recommendations, and action items
- **AND** the result MUST NOT use a raw changed-file list as the primary changed-area output
- **AND** each finding or action item MUST include supporting file or line evidence when available

#### Scenario: Branch review is generated
- **WHEN** AI branch review succeeds
- **THEN** the result MUST include zero or more review findings
- **AND** each inline review finding MUST include severity, confidence, title, explanation, impact, recommendation, suggested PR comment text, file path, side, and changed-line anchor
- **AND** unanchored review notes MUST be represented separately from inline review findings

#### Scenario: Merge conflict suggestions are generated
- **WHEN** AI conflict suggestions succeed
- **THEN** the result MUST include per-file suggestions
- **AND** each suggestion MUST describe the intended resolution without applying it automatically

### Requirement: Branch AI actions show truthful progress timelines
The system SHALL show progress for branch analysis and branch review using real Gitano-controlled milestones rather than a generic loading-only state.

#### Scenario: Branch analysis starts
- **WHEN** the user starts local AI analysis for a branch comparison
- **THEN** the frontend MUST clear previous branch-analysis progress for that comparison
- **AND** the system MUST show a progress timeline before the final result is available

#### Scenario: Branch review starts
- **WHEN** the user starts local AI review for a branch comparison
- **THEN** the frontend MUST clear previous branch-review progress for that comparison
- **AND** the system MUST show a progress timeline before the final review findings are available

#### Scenario: Backend reports branch milestones
- **WHEN** the backend runs branch analysis or branch review
- **THEN** it MUST emit progress for real milestones such as resolving refs, determining the diff base, reading comparison diff context, checking cache, running the local model, formatting the result, and completion
- **AND** it MUST NOT emit progress that claims file-by-file analysis unless the backend actually performs file-by-file work

#### Scenario: Cached branch result is available
- **WHEN** the user starts branch analysis or branch review without forcing refresh
- **AND** an eligible cached result exists
- **THEN** the backend MUST return the cached result
- **AND** the progress timeline MUST indicate that cached output is being used
- **AND** the timeline MUST NOT show the local model as running

#### Scenario: User refreshes branch AI output
- **WHEN** the user refreshes a displayed branch analysis or branch review result
- **THEN** the frontend MUST clear the previous progress timeline for that action
- **AND** the backend MUST bypass the cached result for that request
- **AND** the progress timeline MUST restart from the first branch-specific milestone

#### Scenario: Branch AI final output is ready
- **WHEN** branch analysis or branch review completes successfully
- **THEN** the modal or review surface MUST render the structured final result
- **AND** the progress timeline MUST no longer be the primary content

### Requirement: Local AI analysis results are digest cached
The system SHALL cache local AI results by action, prompt version, selected model digest, repository identity, and Git input digest.

#### Scenario: Equivalent action is repeated
- **WHEN** a user repeats an AI action with the same action kind, prompt version, model digest, repository identity, and Git input digest
- **THEN** the backend MUST return the cached result unless the user requested a refresh

#### Scenario: Model digest changes
- **WHEN** the selected model digest differs from a cached result
- **THEN** the backend MUST treat the cache entry as ineligible
- **AND** the action MUST run again if the user continues

#### Scenario: Git input changes
- **WHEN** the staged diff, commit SHA, branch comparison refs, or conflict inputs change for an action
- **THEN** the backend MUST compute a different Git input digest
- **AND** stale cached analysis MUST NOT be returned

#### Scenario: User forces refresh
- **WHEN** the user requests a fresh AI result for an otherwise cacheable action
- **THEN** the backend MUST bypass the cached result
- **AND** the backend MUST replace the cache entry after successful generation

### Requirement: Local AI analysis remains local and non-mutating by default
The system SHALL run local AI analysis without sending repository content to cloud AI services and without mutating repository state.

#### Scenario: Local AI action executes
- **WHEN** any local AI analysis action runs
- **THEN** repository content MUST be sent only to the configured local runtime
- **AND** no cloud AI endpoint MUST receive repository content

#### Scenario: Analysis result is shown
- **WHEN** a local AI analysis result is displayed
- **THEN** the UI MUST present it as an AI suggestion
- **AND** the result MUST NOT be applied to repository files automatically

#### Scenario: Generated commit message is accepted
- **WHEN** the user accepts an AI-generated commit message
- **THEN** the system MAY fill the editable commit message field
- **AND** the user MUST still explicitly commit

### Requirement: Local AI handles context budget limits explicitly
The system SHALL keep prompts within the selected model's context budget and disclose omitted context.

#### Scenario: Diff context fits the budget
- **WHEN** an action's Git context fits the selected model budget
- **THEN** the backend MUST include the required action context in the prompt

#### Scenario: Diff context exceeds the budget
- **WHEN** an action's Git context exceeds the selected model budget
- **THEN** the backend MUST reduce context using deterministic file and hunk budgeting
- **AND** the result metadata MUST report omitted files or omitted sections

#### Scenario: Context is too large to summarize safely
- **WHEN** the backend cannot create a useful prompt within the selected model budget
- **THEN** the action MUST fail with a user-facing message that suggests a larger model or narrower selection

### Requirement: Local AI action errors use the Git action notice
The system SHALL show local AI action execution errors through the existing bottom Git action notice surface.

#### Scenario: No downloaded models error is returned
- **WHEN** a local AI action fails with `No AI models available`
- **THEN** the frontend MUST show that error in the bottom Git action notice

#### Scenario: No action model selected error is returned
- **WHEN** a local AI action fails with `No AI model selected for [action]`
- **THEN** the frontend MUST show that error in the bottom Git action notice
