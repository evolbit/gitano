## ADDED Requirements

### Requirement: Toolbar dropdowns remain within the viewport
The system SHALL keep the repository and branch dropdowns within the visible viewport when many options are present.

#### Scenario: Repository dropdown has many options
- **WHEN** the repository dropdown contains more options than can fit comfortably in the viewport
- **THEN** the dropdown results area MUST be limited to at most 80% of the viewport height
- **THEN** the results MUST scroll inside the dropdown instead of forcing outer window scrolling

#### Scenario: Branch dropdown has many options
- **WHEN** the branch dropdown contains more options than can fit comfortably in the viewport
- **THEN** the dropdown results area MUST be limited to at most 80% of the viewport height
- **THEN** the results MUST scroll inside the dropdown instead of forcing outer window scrolling

### Requirement: Toolbar dropdown labels truncate cleanly
The system SHALL truncate long repository and branch option labels with ellipsis.

#### Scenario: Repository label is longer than the dropdown width
- **WHEN** a repository name exceeds the available option width
- **THEN** the option row MUST keep the label on one line
- **THEN** the overflowing text MUST be truncated with ellipsis

#### Scenario: Branch label is longer than the dropdown width
- **WHEN** a branch name exceeds the available option width
- **THEN** the option row MUST keep the label on one line
- **THEN** the overflowing text MUST be truncated with ellipsis
