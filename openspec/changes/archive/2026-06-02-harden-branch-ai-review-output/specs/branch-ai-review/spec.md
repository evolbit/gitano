## MODIFIED Requirements

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

#### Scenario: Review output is structurally empty
- **WHEN** the local model returns branch review JSON with no actionable findings, no review notes, and no meaningful summary
- **THEN** the review result MUST be rejected as unusable local model output
- **AND** the UI MUST NOT present that response as a successful no-finding review

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
- **AND** the system MUST show the finding as an unanchored review note when the finding still has useful title, explanation, recommendation, or suggested comment text

#### Scenario: Finding is not line-specific
- **WHEN** the local model identifies a concern that cannot be tied to a specific changed line
- **THEN** the concern MUST be represented as an unanchored review note
- **AND** it MUST NOT be applied automatically as a draft line comment
