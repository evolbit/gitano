## ADDED Requirements

### Requirement: Branch AI review finds actionable changed-code risks
The system SHALL use local AI to review branch comparison diffs for actionable changed-code risks that are useful as PR feedback.

#### Scenario: Review detects a changed-code issue
- **WHEN** the local model identifies a potential bug, regression, unsafe assumption, missing validation, missing test, or maintainability concern in changed code
- **THEN** the review result MUST include an actionable finding
- **AND** the finding MUST explain why the changed code needs attention
- **AND** the finding MUST include a recommended next step

#### Scenario: Review finds no actionable issues
- **WHEN** the local model does not identify actionable changed-code risks in the provided diff context
- **THEN** the review result MUST state that no actionable findings were returned
- **AND** the result MUST NOT invent low-value informational findings to fill the output

#### Scenario: Review output avoids generic summaries
- **WHEN** branch AI review completes
- **THEN** the result MUST prioritize changed-code findings over branch summaries
- **AND** the result MUST NOT include a changed-file list as a review finding

### Requirement: Branch AI review findings are anchored to changed lines
The system SHALL represent inline AI review findings with anchors that can be matched to changed diff lines.

#### Scenario: Inline finding is returned
- **WHEN** an AI review finding is eligible for inline display
- **THEN** the finding MUST include file path, side, line number, severity, confidence, title, explanation, impact, recommendation, and suggested PR comment text
- **AND** the line number MUST refer to a changed line in the active branch comparison diff

#### Scenario: Finding anchor is invalid
- **WHEN** an AI review finding references a file, side, or line that does not exist in the active comparison diff
- **THEN** the system MUST NOT render that finding as inline diff feedback
- **AND** the system MAY show the finding as an unanchored review note if the note is still useful

#### Scenario: Finding is not line-specific
- **WHEN** the local model identifies a concern that cannot be tied to a specific changed line
- **THEN** the concern MUST be represented as an unanchored review note
- **AND** it MUST NOT be applied automatically as a draft line comment

### Requirement: Branch AI review findings are user-controlled draft feedback
The system SHALL let the user decide which AI review findings become draft PR feedback.

#### Scenario: User previews a finding
- **WHEN** the user inspects an AI review finding
- **THEN** the UI MUST show the explanation, impact, recommendation, suggested PR comment, severity, confidence, file path, and line reference

#### Scenario: User applies a finding as a draft comment
- **WHEN** the user applies an anchored AI review finding
- **THEN** the system MUST create a bot-authored draft review thread at the finding's validated diff-line anchor
- **AND** the created draft comment body MUST use the finding's suggested PR comment text

#### Scenario: User edits applied feedback
- **WHEN** an AI review finding has been applied as a draft review comment
- **THEN** the user MUST be able to edit the draft comment using the existing review comment composer behavior

#### Scenario: User dismisses a finding
- **WHEN** the user dismisses an AI review finding
- **THEN** the finding MUST be marked dismissed for the current branch review result
- **AND** dismissed findings MUST NOT create draft review threads

#### Scenario: Modal session ends
- **WHEN** the branch comparison modal closes
- **THEN** unapplied AI review findings and bot-authored draft review threads MUST be discarded with the modal session

### Requirement: Branch AI review remains local and non-mutating
The system SHALL keep branch AI review local and MUST NOT mutate repository files or remote PR state by default.

#### Scenario: Branch review runs
- **WHEN** local AI branch review runs
- **THEN** repository diff context MUST be sent only to the configured local AI runtime
- **AND** no cloud AI endpoint MUST receive repository content

#### Scenario: Review finding is generated
- **WHEN** an AI review finding is generated
- **THEN** the system MUST NOT modify repository files
- **AND** the system MUST NOT submit feedback to a remote PR provider

#### Scenario: User copies feedback
- **WHEN** the user copies AI review feedback
- **THEN** the system MAY place formatted review text on the clipboard
- **AND** the user MUST remain responsible for posting that feedback outside Gitano
