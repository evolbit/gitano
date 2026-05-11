## MODIFIED Requirements

### Requirement: Diff viewer supports unified and split display modes
The system SHALL allow users to switch the shared diff viewer between `Unified` and `Split` display modes.

#### Scenario: User views a diff in unified mode
- **WHEN** the diff viewer is set to `Unified`
- **THEN** the system MUST render the current single-stream diff layout
- **THEN** old and new line numbers MUST remain in the same row stream as the code content
- **THEN** unified rows MUST top-align line numbers and code content using the same vertical rhythm as split rows

#### Scenario: User views a diff in split mode
- **WHEN** the diff viewer is set to `Split`
- **THEN** the system MUST render old content on the left and new content on the right
- **THEN** the system MUST pair the visual rows from the same underlying hunk data instead of requiring a separate backend diff format
