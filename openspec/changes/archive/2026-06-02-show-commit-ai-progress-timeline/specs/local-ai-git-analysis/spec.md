## ADDED Requirements

### Requirement: Commit AI analysis shows a truthful progress timeline

The system SHALL show progress for commit AI analysis using real Gitano-controlled milestones rather than a generic loading-only state.

#### Scenario: Commit analysis starts

- **WHEN** the user starts local AI analysis for a commit
- **THEN** the frontend MUST clear any previous commit-analysis progress timeline for that modal
- **AND** the system MUST show a progress timeline before the final result is available

#### Scenario: Commit analysis reports backend milestones

- **WHEN** the backend runs commit AI analysis
- **THEN** it MUST emit progress for real milestones such as resolving the commit, reading commit diff context, checking cache, running the local model, formatting the result, and completion
- **AND** it MUST NOT emit progress that claims file-by-file analysis unless the backend actually performs file-by-file work

#### Scenario: Frontend paces fast milestones

- **WHEN** multiple commit-analysis progress milestones arrive faster than the user can reasonably perceive
- **THEN** the frontend MAY reveal the milestones with a small minimum display interval
- **AND** the frontend MUST NOT add fake milestones that were not emitted or derived from real backend states
- **AND** pacing MUST NOT noticeably delay a completed final result

#### Scenario: Local model is running

- **WHEN** commit AI analysis reaches the local model generation phase
- **THEN** the modal MUST show `Running local model` or equivalent user-facing text
- **AND** the modal MAY show elapsed time and neutral waiting guidance
- **AND** the modal MUST keep the existing structured result hidden until the final result is available

### Requirement: Commit AI progress preserves analysis cache semantics

The system SHALL preserve existing commit-analysis cache behavior while showing progress.

#### Scenario: Cached commit analysis is available

- **WHEN** the user starts commit AI analysis without forcing refresh
- **AND** an eligible cached result exists
- **THEN** the backend MUST return the cached result
- **AND** the progress timeline MUST indicate that cached analysis is being used
- **AND** the timeline MUST NOT show the local model as running

#### Scenario: User refreshes commit analysis

- **WHEN** the user refreshes a displayed commit AI analysis result
- **THEN** the frontend MUST clear the previous progress timeline
- **AND** the backend MUST bypass the cached result for that request
- **AND** the progress timeline MUST restart from the first commit-analysis milestone

### Requirement: Commit AI progress avoids model thinking streaming by default

The system SHALL not expose raw model thinking traces or partial response tokens for the first commit-analysis progress implementation.

#### Scenario: Model supports thinking traces

- **WHEN** the selected local model can emit a separate thinking trace
- **THEN** commit AI analysis progress MUST still use the Gitano progress timeline by default
- **AND** the UI MUST NOT display model thinking traces unless a future capability explicitly enables that behavior

#### Scenario: Final analysis is ready

- **WHEN** commit AI analysis completes successfully
- **THEN** the modal MUST render the existing structured analysis result
- **AND** the progress timeline MUST no longer be the primary modal content
