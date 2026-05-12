## MODIFIED Requirements

### Requirement: Left pane uses single-section bottom navigation
The system SHALL render the repository workspace left pane as a single active section with bottom navigation instead of an accordion of expandable sections.

#### Scenario: Left pane is displayed
- **WHEN** the repository workspace is rendered
- **THEN** the left pane MUST show exactly one active section body at a time
- **THEN** the left pane MUST provide bottom navigation actions for `Changes`, `Branches`, and `Stashes`
- **THEN** the left pane MUST NOT render accordion controls for those sections

### Requirement: Active left-pane section has contextual framing
The system SHALL frame the currently selected left-pane section with a contextual header and matching content area.

#### Scenario: User views the changes section
- **WHEN** the active left-pane section is `Changes`
- **THEN** the header MUST identify the section as `Changes`
- **THEN** the header MUST include the current working change count
- **THEN** the content area MUST render the current working changes body

#### Scenario: User views a non-changes section
- **WHEN** the active left-pane section is `Branches` or `Stashes`
- **THEN** the header MUST identify the selected section
- **THEN** the content area MUST render the body associated with that section
