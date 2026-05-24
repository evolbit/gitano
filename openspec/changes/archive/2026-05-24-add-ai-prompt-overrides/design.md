## Context

Gitano currently builds fixed prompts in the backend for each `LocalAiActionKind`. Settings already stores AI preferences for engines, local models, warmup, and external agent options, but there is no user-controlled prompt customization. Prompt construction is shared by local model runs and external ACP agent runs, and both paths depend on app-owned JSON output shapes, Git context insertion, read-only constraints, and cache keys.

## Goals / Non-Goals

**Goals:**
- Let users edit per-action AI prompt instructions for commit message, commit review, branch analysis, branch review, and merge conflict suggestions.
- Let users clear each per-action override with a visible `Use default value` control.
- Store prompt overrides with the rest of local AI preferences.
- Apply overrides consistently for local model and external agent execution.
- Preserve app-owned Git context, output schema, safety/read-only instructions, and structured parsing.
- Keep cache keys distinct when prompt override text changes.

**Non-Goals:**
- Let users edit the Git context descriptor or output JSON schema.
- Add per-run prompt overrides outside Settings.
- Add cloud sync or team-shared prompt presets.
- Let external agents mutate repositories through custom prompts.

## Decisions

- Store prompt overrides as `actionPromptOverrides: Record<LocalAiActionKind, string>` in local AI preferences. Empty or whitespace-only values clear the override.
- Add a backend command to persist one action prompt override at a time. This keeps frontend behavior consistent with existing preference commands and avoids over-posting unrelated preferences.
- Treat override text as the action instruction, not the entire prompt. The backend still wraps it with Gitano's fixed safety, locality, JSON shape, and Git context sections.
- Keep the visible default prompt text focused on task guidance. Parser-oriented output contract text remains app-owned in prompt construction instead of being presented as editable defaults.
- Include a prompt fingerprint in cache keys. This prevents stale cached output generated with a previous prompt from being reused after the user changes or clears the prompt.
- Show prompt controls in the Configuration pane under a separate Prompts section. Each action gets a textarea, a save path, and `Use default value`; default text is visible so users can copy/edit it.

## Risks / Trade-offs

- Custom prompts may reduce result quality -> Keep JSON shape and output constraints app-owned, and reject blank override values by clearing them.
- Longer prompts may consume context budget -> Store bounded text and keep existing prompt budgeting; show concise default prompts to discourage excessive content.
- Cache growth can increase with prompt edits -> Prompt fingerprints separate correctness-critical results while allowing equivalent prompt text to reuse cache.
- UI density can increase in Configuration -> Use a grouped Prompts section below engine/action configuration with compact textareas and explicit clear controls.
