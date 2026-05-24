## Why

Gitano has fixed prompts for each AI action, which makes it hard for users to tune tone, strictness, review focus, or commit-message style for their own workflow. Users need per-feature prompt overrides while still having a clear way to return to Gitano's app defaults.

## What Changes

- Add prompt override controls for every Git AI action: commit message, commit review, branch analysis, branch review, and merge conflict suggestions.
- Persist per-action prompt override preferences locally.
- Apply overrides when building prompts for both local model and external agent runs while preserving Gitano-owned Git context and structured output requirements.
- Add a `Use default value` option for each action that clears the override and returns that action to the app-provided default prompt.

## Capabilities

### New Capabilities

### Modified Capabilities
- `local-ai-model-management`: Settings exposes editable prompt preferences per AI action and lets users clear each one back to the app default.
- `local-ai-git-analysis`: Git AI prompt construction applies per-action user prompt overrides without losing required context, safety, and structured result constraints.

## Impact

- Backend local AI preferences data model and persistence.
- Tauri commands and shared frontend API for setting prompt overrides.
- Prompt construction and cache key behavior for local model and external agent actions.
- AI settings Configuration pane and tests.
