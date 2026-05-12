## MODIFIED Requirements

### Requirement: Toolbar push action surfaces operation status
The system SHALL provide explicit push status feedback for user-initiated push actions across all push entry points.

#### Scenario: User triggers push from toolbar
- **WHEN** the user triggers a push from the toolbar
- **THEN** the push control MUST show push-specific loading only for the duration of that push action
- **THEN** the system MUST show push success or failure feedback using the shared push messaging pattern

#### Scenario: User triggers commit and push from commit box
- **WHEN** the user triggers commit+push from the current changes commit box
- **THEN** the system MUST reuse the same push success and failure feedback behavior used by toolbar push
- **THEN** the toolbar push control MUST show push-specific loading only while the push operation is executing
