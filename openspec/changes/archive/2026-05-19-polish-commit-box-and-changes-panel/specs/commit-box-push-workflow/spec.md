## ADDED Requirements

### Requirement: Commit box layout keeps actions inside the message control

The system SHALL render the current changes commit message control as one framed area with its internal action bar inside the frame.

#### Scenario: Commit message box contains the action bar

- **WHEN** the current changes commit box is visible
- **THEN** the message input and action bar MUST appear inside the same visual border/frame
- **AND** the commit and dropdown buttons MUST remain aligned to the right side of that frame

#### Scenario: Message field avoids action buttons

- **WHEN** the message field is edited in narrow or normal pane widths
- **THEN** the editable text area MUST end before the commit/dropdown action group begins
- **AND** text MUST NOT render under the action buttons

#### Scenario: Push option remains inside commit box footer

- **WHEN** the push option is available
- **THEN** the push checkbox MUST remain in the lower action bar
- **AND** it MUST align with the commit controls inside the framed commit box

### Requirement: AI commit message button shows generation loading

The system SHALL show a loading affordance on the AI commit-message button while commit message generation is in progress.

#### Scenario: Commit message generation is running

- **WHEN** local AI commit message generation is in progress
- **THEN** the AI commit-message button MUST show the same visible loading affordance used by other busy action buttons
- **AND** the button MUST expose an accessible generating label
- **AND** the button MUST remain disabled until generation completes
