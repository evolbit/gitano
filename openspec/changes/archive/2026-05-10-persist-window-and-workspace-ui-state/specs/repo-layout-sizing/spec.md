## MODIFIED Requirements

### Requirement: Window minimum width matches pane minimums
The system SHALL enforce a minimum window width derived from the configured pane minimums.

#### Scenario: Window size is restored from persisted state
- **WHEN** the app restores a persisted window size on launch
- **THEN** the restored width MUST be clamped so it is never smaller than the configured minimum window width
- **THEN** the restored height MUST be clamped so it is never smaller than the configured minimum window height
