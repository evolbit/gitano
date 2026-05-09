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
The system SHALL derive the minimum application window width from the sum of the logical pane minimum widths used by the main repo layout.

#### Scenario: Window minimum width is computed
- **WHEN** the application applies its minimum window size for the main repo experience
- **THEN** the minimum window width MUST equal the sum of the left, middle, and right pane minimum widths
- **THEN** with pane minimums of `300`, `500`, and `300`, the resulting minimum window width MUST be `1100`

#### Scenario: Window constraints are declared statically
- **WHEN** the Tauri window configuration is defined
- **THEN** the main window MUST declare `minWidth` and `minHeight`
- **THEN** `minWidth` MUST be `1100`
- **THEN** `minHeight` MUST remain aligned with the shared window minimum height

#### Scenario: Window constraints are enforced at runtime
- **WHEN** the application initializes the main window
- **THEN** it MUST apply runtime window size constraints using the same shared minimum width and height values
- **THEN** the window MUST NOT be resizable to a width smaller than `1100`
