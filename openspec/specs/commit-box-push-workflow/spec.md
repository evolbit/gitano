# commit-box-push-workflow Specification

## Purpose
Define commit-box keyboard and push workflow behavior for commit and commit+push actions, including commit-list refresh expectations.

## Requirements
### Requirement: Commit box keyboard shortcuts execute commit intents
The system SHALL support keyboard shortcuts in the current changes commit box for commit and commit+push actions.

#### Scenario: User presses Enter in commit box
- **WHEN** the commit message input is focused and the user presses `Enter`
- **THEN** the system MUST trigger a commit action using the current commit options

#### Scenario: User presses Shift+Enter in commit box
- **WHEN** the commit message input is focused and the user presses `Shift+Enter`
- **THEN** the system MUST trigger commit and push in a single action
- **THEN** the push behavior MUST execute even if the push checkbox is currently unchecked

### Requirement: Commit list refreshes after commit box actions
The system SHALL refresh commit history immediately after successful commit-box commit actions and rely on repository-change events for subsequent history updates.

#### Scenario: Commit succeeds from commit box
- **WHEN** a commit-box action completes successfully
- **THEN** the commit list MUST refresh immediately

#### Scenario: New commits appear after commit-box action
- **WHEN** commit history changes after a commit-box action
- **THEN** repository-change events MUST trigger commit-list refresh without requiring manual reload
- **THEN** the commit list MUST NOT depend on frontend periodic polling to surface newly added commits

### Requirement: Commit box supports local AI commit message generation
The system SHALL offer premium local AI commit message generation from the current staged change set in the current changes commit box.

#### Scenario: User has staged changes and local AI is ready
- **WHEN** the current changes commit box is visible
- **AND** the repository has staged changes
- **AND** local AI entitlement and the selected model are ready
- **THEN** the commit box MUST offer an action to generate a commit message locally

#### Scenario: User requests generated commit message
- **WHEN** the user triggers local AI commit message generation
- **THEN** the system MUST run the commit message action against the staged change snapshot
- **AND** the commit box MUST show a loading state while generation is running

#### Scenario: Commit message generation succeeds
- **WHEN** local AI returns a generated commit message
- **THEN** the commit message input MUST be filled with the generated message
- **AND** the user MUST still explicitly trigger commit or commit and push

#### Scenario: Staged changes are missing
- **WHEN** the repository has no staged changes
- **THEN** the local AI commit message action MUST be disabled or hidden

#### Scenario: Local AI setup is required
- **WHEN** the user triggers commit message generation and the selected model is not ready
- **THEN** the system MUST route the user through local AI setup before running generation

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
