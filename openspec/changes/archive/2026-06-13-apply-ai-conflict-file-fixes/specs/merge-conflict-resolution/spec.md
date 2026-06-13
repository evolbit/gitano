## ADDED Requirements

### Requirement: Merge editor applies file-level AI fixes directly
The system SHALL expose AI Fix as one file-level merge action that applies validated AI output to the result editor and explains the per-region choices.

#### Scenario: User runs AI Fix for a supported text conflict
- **WHEN** a supported text conflict file is open and file-wide AI is available
- **THEN** the AI Fix row MUST expose one primary `Resolve with AI` file-level action instead of separate region and file scope buttons
- **AND** activating the action MUST run the configured AI engine for the selected conflicted file
- **AND** the returned file candidate MUST be applied to the result editor after stale-state validation without requiring a separate Apply button

#### Scenario: AI Fix applies per-region decisions
- **WHEN** a file-scoped AI candidate includes per-region decisions
- **THEN** the result panel MUST mark those conflict regions as no longer pending
- **AND** the top panes MUST reflect the selected side for regions where the AI chose `incoming` or `current`
- **AND** combination or custom decisions MUST remain visible as accepted AI choices without claiming one side was exclusively selected

#### Scenario: AI Fix completion explains choices in the result panel
- **WHEN** the AI Fix action completes and applies a candidate
- **THEN** the result panel's bottom status message MUST show only the concise completion summary
- **AND** the result panel MUST expose a `View details` control when full detail or decision metadata is available
- **AND** activating `View details` MUST open a modal instead of expanding details inline in the result panel
- **AND** the details modal MUST show which region chose which side or choice and why when that metadata is available
- **AND** the details modal MUST render each conflict decision as a separate row in neutral app styling
- **AND** the details modal MUST align conflict ids with the first line of their explanations
- **AND** the details modal MUST capitalize the first letter of each explanation
- **AND** the details modal MUST allow scrolling when the details exceed the available modal height
- **AND** the result panel's AI status message MUST expose a dismiss control that hides the summary row without changing the result content

#### Scenario: AI Fix failure appears in the result panel
- **WHEN** the AI Fix action fails after being started from the merge editor
- **THEN** the result panel's bottom status message MUST show the failure
- **AND** the AI Fix row MUST NOT render a separate failure message below the button row

#### Scenario: AI Fix remains explicit about saving
- **WHEN** AI Fix applies a candidate to the result editor
- **THEN** the result MUST become dirty like manual edits or side accept actions
- **AND** the user MUST still save or mark resolved through the existing result-panel actions
