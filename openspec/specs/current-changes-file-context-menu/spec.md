# current-changes-file-context-menu Specification

## Purpose
TBD - created by archiving change add-current-changes-file-context-menu-actions. Update Purpose after archive.
## Requirements
### Requirement: Current-changes tree rows support row-specific context menus
The system SHALL provide row-specific context menus in the current-changes diff modal that are scoped to the file or folder the user right-clicked.

#### Scenario: User right-clicks a tracked file row
- **WHEN** the user opens the context menu on a tracked file in the current-changes diff modal
- **THEN** the menu MUST be scoped to that file row rather than the whole pane
- **THEN** the menu MUST show tracked-file actions

#### Scenario: User right-clicks an untracked file row
- **WHEN** the user opens the context menu on an untracked file in the current-changes diff modal
- **THEN** the menu MUST be scoped to that file row rather than the whole pane
- **THEN** the menu MUST show untracked-file actions

#### Scenario: User right-clicks a tracked folder row
- **WHEN** the user opens the context menu on a tracked folder in the current-changes diff modal tree view
- **THEN** the menu MUST be scoped to that folder row rather than the whole pane
- **THEN** the menu MUST show tracked-folder actions

#### Scenario: User right-clicks an untracked folder row
- **WHEN** the user opens the context menu on an untracked folder in the current-changes diff modal tree view
- **THEN** the menu MUST be scoped to that folder row rather than the whole pane
- **THEN** the menu MUST show untracked-folder actions

### Requirement: Tracked and untracked rows show different context-menu actions
The system SHALL render different context-menu entries for tracked and untracked file and folder rows in the current-changes diff modal.

#### Scenario: Tracked file menu is rendered
- **WHEN** a tracked file menu is shown
- **THEN** it MUST include `Stage File` or `Unstage File`
- **THEN** it MUST include `Discard Changes`
- **THEN** it MUST include `Stash File`
- **THEN** it MUST include `Show in Finder` or the platform-equivalent label
- **THEN** it MUST include `View File Blame`
- **THEN** it MUST NOT include `Trash File`

#### Scenario: Untracked file menu is rendered
- **WHEN** an untracked file menu is shown
- **THEN** it MUST include `Stage File` or `Unstage File`
- **THEN** it MUST include `Trash File`
- **THEN** it MUST include `Stash File`
- **THEN** it MUST include `Show in Finder` or the platform-equivalent label
- **THEN** it MUST NOT include `Discard Changes`
- **THEN** it MUST NOT include `View File Blame`

#### Scenario: Tracked folder menu is rendered
- **WHEN** a tracked folder menu is shown
- **THEN** it MUST include `Stage Folder` or `Unstage Folder`
- **THEN** it MUST include `Discard Changes`
- **THEN** it MUST include `Stash File`
- **THEN** it MUST include `Show in Finder` or the platform-equivalent label
- **THEN** it MUST include `View File Blame`
- **THEN** it MUST NOT include `Trash Folder`

#### Scenario: Untracked folder menu is rendered
- **WHEN** an untracked folder menu is shown
- **THEN** it MUST include `Stage Folder` or `Unstage Folder`
- **THEN** it MUST include `Trash Folder`
- **THEN** it MUST include `Stash File`
- **THEN** it MUST include `Show in Finder` or the platform-equivalent label
- **THEN** it MUST NOT include `Discard Changes`
- **THEN** it MUST NOT include `View File Blame`

### Requirement: Initial row-menu actions are selectively implemented
The system SHALL implement only the requested first-pass row actions and may show future actions in a disabled state.

#### Scenario: User stages from the file menu
- **WHEN** the user activates `Stage File` or `Unstage File` from the file-row context menu
- **THEN** the file MUST stage or unstage using the same immediate staging behavior as the file checkbox

#### Scenario: User discards a tracked file
- **WHEN** the user activates `Discard Changes` for a tracked file
- **THEN** the tracked file's working changes MUST be discarded

#### Scenario: User trashes an untracked file
- **WHEN** the user activates `Trash File` for an untracked file
- **THEN** the untracked file MUST be removed from the working changes

#### Scenario: User stages from a folder menu
- **WHEN** the user activates `Stage Folder` or `Unstage Folder` from the row context menu
- **THEN** the folder subtree MUST stage or unstage using the same immediate staging behavior as the matching file checkboxes

#### Scenario: User discards a tracked folder
- **WHEN** the user activates `Discard Changes` for a tracked folder
- **THEN** the tracked folder subtree's working changes MUST be discarded

#### Scenario: User trashes an untracked folder
- **WHEN** the user activates `Trash Folder` for an untracked folder
- **THEN** the untracked folder subtree MUST be removed from the working changes

#### Scenario: User sees future actions
- **WHEN** `Stash File`, `Show in Finder` / platform equivalent, or `View File Blame` are shown in the file-row context menu
- **THEN** they MAY be present in a disabled state until implemented

