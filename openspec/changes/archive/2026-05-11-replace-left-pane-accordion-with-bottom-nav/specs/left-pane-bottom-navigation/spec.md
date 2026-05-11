## ADDED Requirements

### Requirement: Left pane uses single-section bottom navigation
The system SHALL render the repository workspace left pane as a single active section with bottom navigation instead of an accordion of expandable sections.

#### Scenario: Left pane is displayed
- **WHEN** the repository workspace is rendered
- **THEN** the left pane MUST show exactly one active section body at a time
- **THEN** the left pane MUST provide bottom navigation actions for `Changes`, `Branches`, and `Folders`
- **THEN** the left pane MUST NOT render accordion controls for those sections

### Requirement: Active left-pane section has contextual framing
The system SHALL frame the currently selected left-pane section with a contextual header and matching content area.

#### Scenario: User views the changes section
- **WHEN** the active left-pane section is `Changes`
- **THEN** the header MUST identify the section as `Changes`
- **THEN** the header MUST include the current working change count
- **THEN** the content area MUST render the current working changes body

#### Scenario: User views a non-changes section
- **WHEN** the active left-pane section is `Branches` or `Folders`
- **THEN** the header MUST identify the selected section
- **THEN** the content area MUST render the body associated with that section

### Requirement: Bottom navigation switches sections without resizing the pane shell
The system SHALL switch left-pane sections through bottom navigation without replacing the pane sizing model.

#### Scenario: User selects a different section
- **WHEN** the user activates a different bottom navigation item
- **THEN** the left pane MUST switch the active section body in place
- **THEN** the left pane MUST preserve the existing pane width and overall repo layout sizing
