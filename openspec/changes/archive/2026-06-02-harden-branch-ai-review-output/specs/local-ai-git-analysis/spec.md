## MODIFIED Requirements

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

#### Scenario: Branch review output is unusable
- **WHEN** AI branch review returns valid JSON that does not contain any meaningful summary, inline finding, or review note content
- **THEN** the backend MUST reject the response as unusable local model output
- **AND** the backend MUST NOT cache that response as a successful local AI result

#### Scenario: Merge conflict suggestions are generated
- **WHEN** AI conflict suggestions succeed
- **THEN** the result MUST include per-file suggestions
- **AND** each suggestion MUST describe the intended resolution without applying it automatically

### Requirement: Local AI handles context budget limits explicitly
The system SHALL keep prompts within the selected model's effective context budget and disclose omitted context.

#### Scenario: Diff context fits the budget
- **WHEN** an action's Git context fits the selected model budget
- **THEN** the backend MUST include the required action context in the prompt

#### Scenario: Runtime context differs from catalog context
- **WHEN** the backend sends a local AI generation request with a `num_ctx` option
- **THEN** the backend MUST budget prompt context against that same effective context window
- **AND** the backend MUST reserve response space before deciding how much Git context to include

#### Scenario: Large-context branch review runs
- **WHEN** a selected model advertises a large branch-review context window such as Phi's 128K context
- **THEN** the backend MUST NOT unintentionally clamp the branch-review generation context to a smaller fixed limit
- **AND** the prompt budget and Ollama generation options MUST remain aligned

#### Scenario: Diff context exceeds the budget
- **WHEN** an action's Git context exceeds the selected model budget
- **THEN** the backend MUST reduce context using deterministic file and hunk budgeting
- **AND** the result metadata MUST report omitted files or omitted sections

#### Scenario: Context is too large to summarize safely
- **WHEN** the backend cannot create a useful prompt within the selected model budget
- **THEN** the action MUST fail with a user-facing message that suggests a larger model or narrower selection
