## MODIFIED Requirements

### Requirement: Pull request review mode shows the pull request conversation
The system SHALL show pull request conversation history inside pull request review mode.

#### Scenario: User opens the pull request conversation
- **WHEN** the user opens the pull request review screen
- **AND** the user activates `Conversation`
- **THEN** Gitano MUST show the pull request description, commits, conversation comments, review comments, and review replies in the main review area
- **AND** Markdown content MUST render GitHub-flavored tables, links, images, headings, code, and common GitHub emoji shortcodes

#### Scenario: Review comment contains a diff hunk
- **WHEN** the pull request conversation shows a review comment with a diff hunk
- **THEN** Gitano MUST render the hunk in a monospaced, scrollable block
- **THEN** added lines MUST use the same green add tone family used by Gitano diff views
- **THEN** deleted lines MUST use the same red delete tone family used by Gitano diff views
- **THEN** context and hunk header lines MUST remain visually distinct from added and deleted lines

#### Scenario: User adds a pull request conversation comment
- **WHEN** the pull request conversation is visible
- **AND** the user enters a general comment in the composer at the end of the conversation
- **THEN** Gitano MUST submit the comment through the selected GitHub access method
- **AND** Gitano MUST append the accepted comment to the visible conversation
