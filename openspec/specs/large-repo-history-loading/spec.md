## Purpose

Define large repository commit history loading behavior, including non-blocking preparation, backend-owned history and graph caches, bounded frontend row windows, full-history search, and smooth virtualized commit-list interactions.

## Requirements

### Requirement: Commit history preparation is non-blocking
The system SHALL prepare large commit histories and their graph metadata without blocking the repository workspace UI.

#### Scenario: User opens a repository with a very large commit history
- **WHEN** the user opens a repository whose history preparation takes longer than an immediate response
- **THEN** the commit list MUST show a loading state
- **AND** the loading state MUST be visible inside the commits view before the first bounded row window is available
- **AND** the repository workspace MUST remain responsive to tab switching, toolbar interactions, and other already-mounted panels while history preparation continues

#### Scenario: History preparation fails
- **WHEN** backend history preparation fails for a repository
- **THEN** the commit list MUST show an error state for that repository
- **AND** the user MUST be able to retry history loading without reopening the repository

#### Scenario: Multiple views request the same repository history
- **WHEN** multiple frontend callers request the same repository path and history mode while preparation is already running
- **THEN** the backend MUST share the in-flight preparation job
- **AND** callers MUST observe the same eventual ready or error state

### Requirement: Full history graph is cached in the backend
The system SHALL keep the full prepared commit history and graph metadata in a backend cache keyed by repository and history mode.

#### Scenario: History preparation completes
- **WHEN** the backend finishes preparing commit history and graph metadata
- **THEN** the backend MUST store the full prepared result in a cache entry for the repository path and history mode
- **AND** the frontend MUST be able to request bounded row windows from that cache entry

#### Scenario: Frontend requests commit rows
- **WHEN** the frontend requests commit rows from a ready history cache entry
- **THEN** the backend MUST return no more than the configured maximum row window size
- **AND** the response MUST include enough metadata to determine whether earlier or later rows are available

#### Scenario: Frontend requests rows around a known commit
- **WHEN** the frontend requests a row window around a commit SHA or row index that exists in the prepared history
- **THEN** the backend MUST return a bounded row window containing that commit
- **AND** the response MUST include that commit's row index within the full prepared history

#### Scenario: Graph lines cross a row-window boundary
- **WHEN** the frontend requests a bounded row window whose rows are crossed by graph lines that started before the window
- **THEN** the backend MUST include the corresponding row-local graph segments for the returned rows
- **AND** the visual graph MUST remain continuous across window boundaries

### Requirement: Commit search runs against the full backend history
The system SHALL search the full prepared commit history in the backend instead of searching only rows loaded into frontend state.

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

### Requirement: Commit list interactions are preserved with bounded windows
The system SHALL preserve existing commit list interactions while using backend-backed history windows.

#### Scenario: User selects a visible commit row
- **WHEN** the user selects a commit row from the loaded window
- **THEN** the system MUST store the selected commit by SHA for the active repository tab
- **AND** the commit details pane MUST load the selected commit changes as before

#### Scenario: User keyboard-navigates within loaded rows
- **WHEN** the user navigates the commit list with keyboard controls inside the currently loaded row window
- **THEN** row selection and scroll behavior MUST remain consistent with the existing virtualized commit table behavior

#### Scenario: User navigation reaches a window boundary
- **WHEN** keyboard or search navigation targets a commit outside the currently loaded row window
- **THEN** the frontend MUST request a bounded row window containing the target commit
- **AND** selection MUST move to the target commit after the new window is available

#### Scenario: User scrolls beyond the currently loaded row window
- **WHEN** the user scrolls near or beyond the edge of the currently loaded row window
- **THEN** the frontend MUST request a bounded backend row window around the visible full-history row range
- **AND** the table scrollbar MUST continue to represent the full prepared history rather than resetting to the loaded window

#### Scenario: User scrolls toward the next or previous commit-detail window
- **WHEN** the visible full-history range approaches either edge of the active loaded commit-detail window
- **THEN** the frontend MUST prefetch the adjacent commit-detail window for that scroll direction before the edge is reached
- **AND** the prefetch response MUST populate the absolute-index row cache without replacing the active visible window
- **AND** repeated lookahead requests for the same adjacent window SHOULD be deduplicated while in flight or already cached

#### Scenario: User scrolls faster than commit details can load
- **WHEN** the visible full-history range has graph data but commit row details are not loaded yet
- **THEN** the graph column MUST render available graph segments for those rows
- **AND** non-graph commit cells MUST show a loading placeholder instead of an empty row
- **AND** author, date, SHA, and avatar cells MUST NOT show stale data from a previously rendered commit row
- **AND** the graph column MUST remain a normal resizable table column

#### Scenario: Placeholder row becomes a loaded commit row
- **WHEN** a virtualized row is currently rendering a placeholder for an absolute full-history row index
- **AND** matching commit detail data arrives for that same absolute row index
- **THEN** the row MUST replace placeholder cells with the matching commit cells coherently
- **AND** media-bearing cells such as author avatars MUST be keyed or reset so they do not briefly display an avatar from another commit

#### Scenario: Virtualized row is reused for a different full-history index
- **WHEN** the table recycles a rendered row or cell for a different absolute full-history row index
- **AND** commit detail data for the new absolute row index is not available yet
- **THEN** the row MUST render only the placeholder state for the new absolute row index
- **AND** it MUST NOT retain commit text, author details, date, SHA, refs, or avatar image from the prior row identity

#### Scenario: User scrolls near recently loaded rows
- **WHEN** commit details were already fetched for a full-history row index
- **THEN** nearby scrolling MUST reuse the cached commit details for that row when it is visible
- **AND** the row MUST NOT fall back to a loading placeholder solely because the active backend window shifted

#### Scenario: Earlier viewport request completes after a newer one
- **WHEN** multiple commit-detail, graph-only, or search requests are in flight for different viewport positions
- **AND** an earlier request completes after a newer request has started
- **THEN** the earlier response MUST NOT replace the visible commit rows, graph rows, search state, or error state from the newer request

#### Scenario: Repository history exceeds native scroll-height limits
- **WHEN** the prepared commit history is large enough that `row_count * row_height` exceeds practical browser scroll-height limits
- **THEN** the table MUST cap the physical scroll canvas and map native scrollbar position back to absolute full-history row indexes
- **AND** the user MUST be able to drag the scrollbar to the oldest commit rows
- **AND** visible-range loading MUST continue to request graph and commit windows using full-history row indexes

### Requirement: History cache invalidates on repository history changes
The system SHALL invalidate or refresh backend commit history caches when repository history inputs change.

#### Scenario: Commit or ref state changes
- **WHEN** the app receives a repository refresh signal for `head`, `branches`, `remote-refs`, or an explicit commit refresh for a repository
- **THEN** backend history cache entries for that repository MUST be invalidated or refreshed before stale rows are shown as current

#### Scenario: User explicitly refreshes commit history
- **WHEN** the user or app triggers a force refresh for commit history
- **THEN** the backend MUST replace the existing cache entry for that repository and history mode
- **AND** the commit list MUST show loading until the replacement entry is ready

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
