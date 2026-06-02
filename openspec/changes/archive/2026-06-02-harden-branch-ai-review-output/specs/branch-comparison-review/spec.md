## MODIFIED Requirements

### Requirement: Branch comparison supports local AI code review
The system SHALL expose premium local AI code review from the branch comparison review surface as a changed-code feedback action distinct from branch analysis.

#### Scenario: User opens branch comparison
- **WHEN** the branch comparison modal is open with a selected base/target branch and head/source branch
- **AND** the selected branches are different
- **THEN** the modal MUST offer a local AI review action for the active comparison
- **AND** the modal MUST present review as distinct from branch analysis

#### Scenario: User starts branch review
- **WHEN** the user activates local AI review for the active branch comparison
- **THEN** the system MUST run branch review using the active base/target branch, head/source branch, and comparison mode
- **AND** the modal MUST show progress while local review is running

#### Scenario: Branch review succeeds
- **WHEN** local AI branch review completes
- **THEN** the branch comparison modal MUST show AI review findings that identify changed code needing attention
- **AND** each inline finding MUST be associated with a validated changed diff line before it is shown as inline feedback
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: Branch review has no actionable findings
- **WHEN** local AI branch review completes with a meaningful no-finding result
- **THEN** the branch comparison modal MUST show the model's no-finding summary
- **AND** the modal MUST distinguish that state from a model-output error

#### Scenario: Branch review output is unusable
- **WHEN** local AI branch review fails because the model returned unusable structured output
- **THEN** the branch comparison modal MUST show the failure through the local AI error path
- **AND** the modal MUST NOT show "No actionable review findings returned" as the final result

#### Scenario: Branch review has omitted context
- **WHEN** a branch review or branch analysis result includes omitted files or omitted sections metadata
- **THEN** the result modal MUST show a compact indication that context was omitted or truncated
- **AND** the indication MUST remain visible for both cached and fresh results

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
- **WHEN** the user changes the base/target branch or head/source branch for the comparison
- **THEN** the local AI review action MUST use a new Git input digest
- **AND** stale review findings for the previous comparison MUST NOT be shown as current findings

#### Scenario: Local AI setup is required for review
- **WHEN** the selected model is not ready for branch review
- **THEN** the system MUST route the user through local AI setup before running review

#### Scenario: Comparison cannot be reviewed
- **WHEN** either comparison endpoint is missing or both endpoints are the same branch
- **THEN** the local AI review action MUST be disabled
