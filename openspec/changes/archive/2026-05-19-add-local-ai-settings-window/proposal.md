## Why

Local AI now needs a first-class settings surface so users can manage the runtime, downloaded models, and per-action model assignments without going through setup-only flows. The behavior also needs to be explicit around global defaults, deleted models, and missing per-action selections so AI actions fail predictably instead of silently falling back to the wrong model.

## What Changes

- Add a settings modal opened from the workspace tab-bar three-dot menu, with a compact AI sidebar containing Runtime, Models, and Configuration panes.
- Add runtime management controls for installing or upgrading the managed local AI runtime.
- Add model management controls for viewing, downloading, and deleting supported local AI models.
- Add configuration controls for global default and per-action model preferences, including an unset placeholder for action-specific models.
- Expand the curated local AI model registry with smaller coding models: Qwen2.5 Coder 1.5B, DeepSeek Coder 1.3B, and Phi-4 Mini.
- Change global model behavior so the first downloaded supported model becomes the global default, the global default cannot be manually unset, and deleting all models clears all preferences.
- Change local AI action behavior so missing downloaded models return `No AI models available`, and missing action-specific model selection returns `No AI model selected for [action]`.
- Route settings command failures back into the settings modal, while AI action failures continue to use the existing bottom notice surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-ai-model-management`: Add the settings modal, curated small-model additions, runtime/model management panes, global-default lifecycle rules, action clearing behavior, and deleted-model reconciliation.
- `local-ai-git-analysis`: Update local AI action model resolution and user-facing error behavior for no downloaded models and missing action-specific selections.

## Impact

- Rust/Tauri AI commands and types: nullable model preference clearing, installed-model reconciliation, first-download defaulting, deleted-model cleanup, action-specific missing-model errors, and runtime/model management commands.
- Rust/Tauri model registry: additional supported small local coding models and updated preference persistence rules.
- Frontend settings feature: new settings modal, AI sidebar, Runtime/Models/Configuration panes, progress rendering, and modal-scoped error display.
- Frontend workspace shell and tab bar: three-dot menu entry for Settings with context-menu styling.
- Frontend AI workflows: commit, commit review, branch/PR review, and merge-conflict actions use configured action models and show action errors through the bottom notice.
- Tests: focused frontend and Rust coverage for settings UI, local AI API payloads, model preference clearing, global defaulting, and deleted-model reconciliation.
