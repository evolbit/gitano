## MODIFIED Requirements

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

## ADDED Requirements

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
