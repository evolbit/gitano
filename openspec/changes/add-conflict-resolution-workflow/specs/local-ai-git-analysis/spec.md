## ADDED Requirements

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
- **AND** the result MUST return a reviewable candidate for the full result file or a structured set of conflict-region replacements
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
- **AND** the frontend MUST present the candidate for review before applying it

#### Scenario: User applies an AI conflict candidate
- **WHEN** the user applies an AI conflict candidate
- **THEN** the system MUST validate that the current conflict signature matches the candidate input signature
- **AND** the system MUST update only the result content for the candidate scope
- **AND** the system MUST NOT mark the file resolved unless the user explicitly triggers the resolved action

#### Scenario: AI conflict candidate is stale
- **WHEN** the conflict index or result content changed after the candidate was generated
- **THEN** the system MUST reject candidate application
- **AND** the frontend MUST prompt the user to reload conflict detail or rerun AI

### Requirement: External agent conflict AI remains read-only until user applies output
The system SHALL route scoped conflict AI through the selected analysis engine while preserving explicit user application.

#### Scenario: Scoped conflict AI starts with external agent
- **WHEN** the user requests a scoped conflict AI fix with an external agent selected
- **THEN** the backend MUST include the repository path, target file path, target scope, unmerged index fingerprint, and read-only inspection instructions
- **AND** the prompt MUST instruct the external agent not to modify files
- **AND** the final result MUST still be applied only through Gitano's explicit candidate application flow

#### Scenario: Scoped conflict AI starts with local model
- **WHEN** the user requests a scoped conflict AI fix with a local model selected
- **THEN** Gitano MUST use the existing local model entitlement, setup, cache, context-budget, and keep-alive behavior
- **AND** the local model prompt MUST preserve Gitano's structured output and no-auto-write constraints
