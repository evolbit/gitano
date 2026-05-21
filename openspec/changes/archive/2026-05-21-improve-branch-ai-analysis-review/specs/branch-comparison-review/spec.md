## MODIFIED Requirements

### Requirement: Branch comparison supports local AI analysis
The system SHALL expose premium local AI branch analysis from the branch comparison review surface as a report-oriented action distinct from AI code review.

#### Scenario: User opens branch comparison
- **WHEN** the branch comparison modal is open with a selected base branch and source branch
- **THEN** the modal MUST offer a local AI analysis action for the active comparison
- **AND** the modal MUST present analysis as distinct from AI review of changed code

#### Scenario: User starts branch analysis
- **WHEN** the user activates local AI analysis for the active branch comparison
- **THEN** the system MUST run branch analysis using the active base branch, source branch, and comparison mode
- **AND** the modal MUST show progress while local analysis is running

#### Scenario: Branch analysis succeeds
- **WHEN** local AI branch analysis completes
- **THEN** the modal MUST show a structured report with summary, risk assessment, behavioral changes, potential regressions, test gaps, recommendations, and action items
- **AND** the modal MUST NOT show a raw changed-file chip list as the analysis output
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: User changes comparison inputs
- **WHEN** the user changes the base branch or source branch for the comparison
- **THEN** the local AI analysis action MUST use a new Git input digest
- **AND** stale analysis for the previous comparison MUST NOT be shown as current analysis

#### Scenario: Local AI setup is required
- **WHEN** the selected model is not ready for branch analysis
- **THEN** the system MUST route the user through local AI setup before running analysis

## ADDED Requirements

### Requirement: Branch comparison supports local AI code review
The system SHALL expose premium local AI code review from the branch comparison review surface as a changed-code feedback action distinct from branch analysis.

#### Scenario: User opens branch comparison
- **WHEN** the branch comparison modal is open with a selected base branch and source branch
- **THEN** the modal MUST offer a local AI review action for the active comparison
- **AND** the modal MUST present review as distinct from branch analysis

#### Scenario: User starts branch review
- **WHEN** the user activates local AI review for the active branch comparison
- **THEN** the system MUST run branch review using the active base branch, source branch, and comparison mode
- **AND** the modal MUST show progress while local review is running

#### Scenario: Branch review succeeds
- **WHEN** local AI branch review completes
- **THEN** the branch comparison modal MUST show AI review findings that identify changed code needing attention
- **AND** each inline finding MUST be associated with a validated changed diff line before it is shown as inline feedback
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: User applies an AI finding
- **WHEN** the user applies an AI review finding as feedback
- **THEN** the system MUST create or update a bot-authored draft review thread at the finding's diff-line anchor
- **AND** the user MUST be able to edit or delete the draft comment before using it outside Gitano

#### Scenario: User dismisses an AI finding
- **WHEN** the user dismisses an AI review finding
- **THEN** the finding MUST be hidden from the active review result for the current modal session
- **AND** no draft review thread MUST be created for that dismissal

#### Scenario: User copies AI feedback
- **WHEN** the user copies selected AI review feedback
- **THEN** the system MUST copy PR-ready Markdown that includes the relevant file and line reference, finding title, explanation, and suggested comment

#### Scenario: User changes comparison inputs
- **WHEN** the user changes the base branch or source branch for the comparison
- **THEN** the local AI review action MUST use a new Git input digest
- **AND** stale review findings for the previous comparison MUST NOT be shown as current findings

#### Scenario: Local AI setup is required for review
- **WHEN** the selected model is not ready for branch review
- **THEN** the system MUST route the user through local AI setup before running review
