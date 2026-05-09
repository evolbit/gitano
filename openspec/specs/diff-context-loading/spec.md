## Purpose

Define the frontend-to-Tauri contract for loading additional context lines around diff hunks in the diff viewer.

## Requirements

### Requirement: Diff viewer can request additional diff context
The system SHALL expose a stable Tauri command contract for loading additional context lines around a diff hunk.

#### Scenario: Frontend expands diff context
- **WHEN** the diff viewer requests more context for a hunk
- **THEN** the frontend MUST be able to invoke the backend using the command name `get_diff_context`
- **THEN** the backend MUST accept the existing path, file path, hunk index, direction, lines, context, and offset arguments
- **THEN** the backend MUST return additional diff lines without requiring the frontend to translate the command name

#### Scenario: Diff context command is registered
- **WHEN** the Tauri application starts
- **THEN** the invoke handler MUST register the diff-context command under the name `get_diff_context`
