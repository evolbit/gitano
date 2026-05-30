## ADDED Requirements

### Requirement: Commit box preserves multi-line commit messages
The system SHALL allow users to write and submit multi-line commit messages from the current changes commit box.

#### Scenario: User enters a subject and body
- **WHEN** the user enters a commit message containing a first-line subject, a blank line, and body text
- **AND** the user triggers commit or amend
- **THEN** the system MUST create or amend the commit with the full message content
- **THEN** the body text after the blank line MUST be preserved in Git commit metadata

#### Scenario: User presses Enter in message textarea
- **WHEN** the commit message textarea is focused
- **AND** the user presses `Enter` without a commit shortcut modifier
- **THEN** the textarea MUST insert a newline
- **THEN** the system MUST NOT trigger a commit action

#### Scenario: Commit subject exceeds recommendation
- **WHEN** the first line of the commit message exceeds Gitano's configured subject-length recommendation
- **THEN** the commit box MUST show a warning that the subject is longer than recommended
- **THEN** the warning MUST NOT block the user from committing

#### Scenario: Commit body exceeds subject recommendation
- **WHEN** a commit message body line exceeds the configured subject-length recommendation
- **AND** the first line is within the recommendation
- **THEN** the commit box MUST NOT show the subject-length warning solely because of the body line

## MODIFIED Requirements

### Requirement: Commit box keyboard shortcuts execute commit intents
The system SHALL support keyboard shortcuts in the current changes commit box for commit and commit+push actions without preventing normal multiline editing.

#### Scenario: User presses Enter in commit box
- **WHEN** the commit message input is focused and the user presses `Enter` without a commit shortcut modifier
- **THEN** the system MUST insert a newline in the message input
- **THEN** the system MUST NOT trigger a commit action

#### Scenario: User presses commit shortcut in commit box
- **WHEN** the commit message input is focused and the user presses the configured commit shortcut
- **THEN** the system MUST trigger a commit action using the current commit options

#### Scenario: User presses commit and push shortcut in commit box
- **WHEN** the commit message input is focused and the user presses the configured commit-and-push shortcut
- **THEN** the system MUST trigger commit and push in a single action
- **THEN** the push behavior MUST execute even if the push checkbox is currently unchecked
