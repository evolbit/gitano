## Purpose

Define the sizing rules and window constraints for the main three-pane repo layout.
## Requirements
### Requirement: Main repo layout sizing is centralized
The system SHALL define the main repo view pane sizing in a centralized configuration instead of scattering sizing literals across layout components.

#### Scenario: Main repo layout is configured
- **WHEN** the repo tab layout is initialized
- **THEN** the left, middle, and right pane sizing values MUST come from a shared layout configuration source
- **THEN** pane minimum widths MUST be represented as numeric values
- **THEN** pane initial sizes MUST support either numeric values or percentage strings

### Requirement: Main repo panes enforce minimum widths
The system SHALL enforce minimum widths for the three logical panes in the main repo layout.

#### Scenario: Repo layout panes are rendered
- **WHEN** the main repo layout is displayed
- **THEN** the left pane MUST have a minimum width of `300`
- **THEN** the middle pane MUST have a minimum width of `500`
- **THEN** the right pane MUST have a minimum width of `300`

#### Scenario: Available width is distributed
- **WHEN** the main repo layout has space beyond the pane minimum widths
- **THEN** the middle pane MUST occupy the remaining available space after left and right pane constraints are satisfied

### Requirement: Window minimum width matches pane minimums
The system SHALL enforce a minimum window width derived from the configured pane minimums.

#### Scenario: Window size is restored from persisted state
- **WHEN** the app restores a persisted window size on launch
- **THEN** the restored width MUST be clamped so it is never smaller than the configured minimum window width
- **THEN** the restored height MUST be clamped so it is never smaller than the configured minimum window height

