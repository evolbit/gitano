# changes-explorer-component-structure Specification

## Purpose
TBD - created by archiving change split-changes-explorer-into-smaller-chunks. Update Purpose after archive.
## Requirements
### Requirement: Changes explorer can be split into smaller modules without changing visible behavior
The system SHALL allow the changes explorer implementation to be decomposed into smaller component-local modules while preserving the existing user-facing explorer behavior.

#### Scenario: Explorer is refactored into smaller files
- **WHEN** the changes explorer is split into smaller modules for helpers, renderers, or behavior orchestration
- **THEN** the explorer MUST continue to render the same tracked and untracked file structure
- **THEN** the explorer MUST continue to support the same flat and tree views
- **THEN** the explorer MUST continue to support the same file staging, folder staging, and context menu actions

#### Scenario: Modal rebinding remains unchanged after the split
- **WHEN** the working-tree diff modal opens from the refactored explorer
- **THEN** the modal MUST continue to rebind to the current file entry by path
- **THEN** the modal MUST continue to preserve the current selected file behavior during refreshes

### Requirement: Split explorer modules preserve responsiveness
The system SHALL preserve scroll responsiveness and avoid introducing new rerender regressions when the explorer is split into smaller modules.

#### Scenario: A visible explorer row is rendered through an extracted module
- **WHEN** a file row or folder row is rendered by an extracted module
- **THEN** the explorer MUST remain responsive while scrolling through large change lists
- **THEN** the extraction MUST NOT introduce visible stutter solely because the row renderer moved into a separate file

#### Scenario: A helper is moved into a component-local utility module
- **WHEN** a pure helper function is moved into a component-local utility module
- **THEN** the explorer MUST continue to behave the same as before the move
- **THEN** the helper move MUST NOT create a new subscription or state boundary that changes render timing

### Requirement: Split explorer modules keep state ownership stable
The system SHALL keep the core explorer state ownership in the explorer coordinator rather than distributing reactive state across many small child components.

#### Scenario: Search, expansion, and menu state are still coordinated centrally
- **WHEN** the explorer is decomposed into smaller modules
- **THEN** search state, expansion state, and context menu state MUST remain coordinated consistently for the same surface
- **THEN** the decomposition MUST NOT change the explorer's visible selection or menu behavior

#### Scenario: Derived data remains derived from the same explorer inputs
- **WHEN** the explorer uses extracted helpers or renderers
- **THEN** the rendered file rows MUST still be derived from the same explorer inputs
- **THEN** the decomposition MUST NOT change the visible file ordering, grouping, or selection rules

