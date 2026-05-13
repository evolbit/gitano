# branches-panel-design-parity Specification

## Purpose
Define shared visual and interaction parity requirements for the branches panel so it aligns with other left-pane explorer panels.

## Requirements

### Requirement: Branches panel uses shared top-bar framing
The system SHALL render the left-pane branches section using the same top-bar framing model used by other left-pane explorer panels.

#### Scenario: Branches section is visible
- **WHEN** the active left-pane section is `Branches`
- **THEN** the panel MUST render a bordered top control strip above the tree content
- **THEN** the top strip MUST include a branch search input
- **THEN** the top strip MUST include local/remote mode controls using branch-appropriate icons

#### Scenario: User filters branches
- **WHEN** the user enters text in the branch search input
- **THEN** the visible branch tree MUST filter to matching branches
- **THEN** non-matching branches/groups MUST be hidden from the current view

### Requirement: Branch tree visuals match shared explorer style
The system SHALL align branch tree row styling with the shared explorer visual language.

#### Scenario: Branch tree is rendered
- **WHEN** the branches panel renders grouped branches
- **THEN** row spacing, hover treatment, and selected-row emphasis MUST follow the same design language as other explorer trees
- **THEN** folder and branch icon colors MUST use the panel's shared color token system rather than bespoke hard-coded contrasts

#### Scenario: User expands grouped branches
- **WHEN** the user expands nested branch groups
- **THEN** the tree MUST NOT render vertical connector rails that run from start to end of nested groups
- **THEN** hierarchy depth MUST remain readable via indentation and disclosure affordances
