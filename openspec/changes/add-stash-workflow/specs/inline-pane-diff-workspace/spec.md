## ADDED Requirements

### Requirement: Stash-file selection replaces the right workspace with a read-only inline diff
The system SHALL replace the repository right workspace with an inline diff viewer when the user opens a file from the stashes section.

#### Scenario: User opens a stash-file diff
- **WHEN** the user opens a file from the selected stash in the stashes section
- **THEN** the system MUST replace the full right workspace with an inline diff viewer for that stash file
- **THEN** the stashes section MUST remain visible as the file navigator
- **THEN** the currently selected commit MUST remain preserved as repository state even though the history workspace is no longer rendered

#### Scenario: User interacts with a stash-file inline diff
- **WHEN** a stash-file inline diff viewer is open
- **THEN** the viewer MUST expose an explicit close action
- **THEN** the user MUST be able to close it with `Esc`
- **THEN** the viewer MUST support switching between `Unified` and `Split` display modes
- **THEN** the viewer MUST NOT allow staging, unstaging, or gutter-based selection

#### Scenario: User closes a stash-file inline diff
- **WHEN** the user closes an inline stash-file diff viewer
- **THEN** the system MUST restore the normal history workspace layout on the right side
- **THEN** the selected stash entry and its file selection MUST remain preserved
