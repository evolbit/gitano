## ADDED Requirements

### Requirement: Branch comparison supports local AI analysis
The system SHALL expose premium local AI branch and PR-style analysis from the branch comparison review surface.

#### Scenario: User opens branch comparison
- **WHEN** the branch comparison modal is open with a selected base branch and source branch
- **THEN** the modal MUST offer a local AI analysis action for the active comparison

#### Scenario: User starts branch analysis
- **WHEN** the user activates local AI analysis for the active branch comparison
- **THEN** the system MUST run branch analysis using the active base branch, source branch, and comparison mode
- **AND** the modal MUST show progress while local analysis is running

#### Scenario: Branch analysis succeeds
- **WHEN** local AI branch analysis completes
- **THEN** the modal MUST show a structured summary, risk assessment, changed-area overview, and findings
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: User changes comparison inputs
- **WHEN** the user changes the base branch or source branch for the comparison
- **THEN** the local AI analysis action MUST use a new Git input digest
- **AND** stale analysis for the previous comparison MUST NOT be shown as current analysis

#### Scenario: Local AI setup is required
- **WHEN** the selected model is not ready for branch analysis
- **THEN** the system MUST route the user through local AI setup before running analysis
