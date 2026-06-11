## ADDED Requirements

### Requirement: Commit search controls match shared search styling
The system SHALL render commit search controls using the same compact search input style used by other explorer panels.

#### Scenario: Commit search toolbar is shown
- **WHEN** the commit list search toolbar is visible
- **THEN** the search input MUST use the same border, background, icon placement, text sizing, and focus style as the current changes and other explorer search boxes
- **THEN** text MUST NOT overlap navigation buttons or the match count at narrow and normal pane widths

#### Scenario: Commit search has matches
- **WHEN** the current commit search has one or more matches
- **THEN** the toolbar MUST keep next and previous navigation buttons
- **THEN** the toolbar MUST keep the current-position and total match count display

## MODIFIED Requirements

### Requirement: Commit search runs against the full backend history
The system SHALL search the full prepared local repository history in the backend instead of searching only rows loaded into frontend state.

#### Scenario: User searches commit history
- **WHEN** the user enters a commit search query after history preparation is ready
- **THEN** the backend MUST search all prepared commits for that repository and history mode
- **AND** the frontend MUST show the total match count from the backend result

#### Scenario: Search includes local refs, fetched remote refs, and tags
- **WHEN** the prepared commit history includes commits reachable from local branches, remote refs, tags, or `HEAD`
- **AND** the user searches commit history
- **THEN** the backend search MUST evaluate the prepared local history that includes those refs
- **THEN** the system MUST NOT perform a live remote/provider search to compute matches

#### Scenario: User navigates to the next or previous search match
- **WHEN** the user requests the next or previous search match
- **THEN** the backend MUST return the matching commit SHA and row index for the requested direction
- **AND** the frontend MUST select the matching commit after loading a row window containing it when necessary

#### Scenario: User searches before history is ready
- **WHEN** the user enters a search query while history preparation is still loading
- **THEN** the system MUST defer or disable full-history search until the backend cache is ready
- **AND** the UI MUST NOT present partial loaded-window matches as full-history results
