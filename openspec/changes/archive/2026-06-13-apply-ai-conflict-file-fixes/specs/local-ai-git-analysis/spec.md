## MODIFIED Requirements

### Requirement: Merge conflict AI supports scoped fix candidates
The system SHALL support AI-assisted merge conflict fixes scoped to one conflict region or one conflicted file.

#### Scenario: User requests AI fix for one conflict region
- **WHEN** the user requests an AI fix for a selected conflict region
- **THEN** the backend MUST build an AI context snapshot limited to that conflicted file, selected region, available base/current/incoming content, nearby result context, and conflict metadata
- **AND** the result MUST return a candidate replacement for that region
- **AND** the system MUST NOT write the candidate to the worktree automatically

#### Scenario: User requests AI fix for one conflicted file
- **WHEN** the user requests an AI fix for a selected conflicted file
- **THEN** the backend MUST build an AI context snapshot for that file's available base/current/incoming/result content within the configured context budget
- **AND** the context MUST identify every known conflict region by id and result line range
- **AND** the result MUST return a reviewable full result file candidate
- **AND** the result MUST include a brief summary suitable for the merge editor status line
- **AND** the result MUST include full details suitable for an expanded explanation when available
- **AND** the result MUST include a structured decision for each known conflict region with the region id, selected choice, and reason
- **AND** the selected choice MUST distinguish current, incoming, combination, and custom/manual resolutions
- **AND** the system MUST NOT write the candidate to the worktree automatically

#### Scenario: Very large conflict file is selected
- **WHEN** the user requests AI for a very large conflicted file
- **THEN** file-wide AI MUST be disabled or constrained to a bounded context window
- **AND** per-conflict AI MAY remain available when the selected conflict region and surrounding context fit the configured budget

### Requirement: Merge conflict AI candidates are explicit and stale-safe
The system SHALL keep AI conflict output reviewable and tied to the conflict state used to generate it.

#### Scenario: AI conflict candidate succeeds
- **WHEN** a scoped conflict AI action succeeds
- **THEN** the result MUST include the target file path, target scope, summary, candidate content or replacement, and the input conflict signature
- **AND** file-scoped candidates SHOULD include full details separate from the brief summary
- **AND** file-scoped candidates MUST include per-region decisions that explain which side or combination was selected and why

#### Scenario: Settings display action default prompts
- **WHEN** the settings UI displays prompt controls for AI actions
- **THEN** it MUST use the backend-provided default prompt text for each action
- **AND** the frontend MUST NOT maintain a separate hardcoded default prompt copy for those controls
- **AND** resetting a prompt override MUST restore the backend-provided default prompt text

#### Scenario: User applies an AI conflict candidate
- **WHEN** the user applies an AI conflict candidate
- **THEN** the system MUST validate that the current conflict signature matches the candidate input signature
- **AND** the system MUST update only the result content for the candidate scope
- **AND** file-scoped application MUST update accepted-region UI state from the candidate's per-region decisions
- **AND** the system MUST NOT mark the file resolved unless the user explicitly triggers the resolved action

#### Scenario: Merge editor auto-applies a file-scoped AI candidate
- **WHEN** the merge editor's file-level AI Fix action receives a valid non-stale file candidate
- **THEN** Gitano MUST apply the candidate to the result editor state immediately
- **AND** Gitano MUST surface the AI decision summary without requiring a separate Apply button
- **AND** the existing Save and Mark Resolved controls MUST remain responsible for writing and resolving the file

#### Scenario: AI conflict candidate is stale
- **WHEN** the conflict index or result content changed after the candidate was generated
- **THEN** the system MUST reject candidate application
- **AND** the frontend MUST prompt the user to reload conflict detail or rerun AI
- **AND** result-content freshness MUST be based on the result file bytes, or the symlink target for symlink results, rather than file modification metadata alone

### Requirement: External agent conflict AI remains read-only until user applies output
The system SHALL route scoped conflict AI through the selected analysis engine while preserving Gitano-controlled candidate application.

#### Scenario: Scoped conflict AI starts with external agent
- **WHEN** the user requests a scoped conflict AI fix with an external agent selected
- **THEN** the backend MUST include the repository path, target file path, target scope, unmerged index fingerprint, and read-only inspection instructions
- **AND** the prompt MUST instruct the external agent not to modify files
- **AND** the final result MUST still be applied only through Gitano's validated candidate application flow

#### Scenario: Scoped conflict AI starts with local model
- **WHEN** the user requests a scoped conflict AI fix with a local model selected
- **THEN** Gitano MUST use the existing local model entitlement, setup, cache, context-budget, and keep-alive behavior
- **AND** the local model prompt MUST preserve Gitano's structured output and no-auto-write constraints
