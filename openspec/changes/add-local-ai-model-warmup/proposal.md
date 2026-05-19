## Why

The first local AI request can feel slow because the runtime has to load the selected model before inference. Users should be able to opt specific downloaded models into warmup so Gitano can keep likely-to-be-used models ready without surprising memory pressure.

## What Changes

- Add persisted per-model warmup preferences for downloaded local AI models.
- Add a model-level memory estimate and memory class so Gitano can warn before keeping large or cumulatively expensive models warm.
- Show a `Keep this model warm` checkbox below model dropdowns or model controls, with confirmation when the total selected warm models crosses the memory threshold.
- Warm selected models at app/runtime startup and refresh them periodically using the local runtime keep-alive mechanism.
- Include keep-alive on real local AI action requests so active use keeps the selected model loaded.
- Surface warmup failures through the existing settings error surface without blocking unrelated model management.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-ai-model-management`: Add persisted warm model preferences, memory-class warnings, and settings controls for keeping downloaded models warm.
- `local-ai-git-analysis`: Keep selected models alive during local AI action execution so repeated actions avoid model reload latency.

## Impact

- Rust/Tauri AI types, model catalog, preferences, Ollama request payloads, and new warmup command or scheduler support.
- Settings window model/configuration UI and local AI shared API wrappers.
- Tests for warm preference payloads, warning threshold behavior, keep-alive request shape, and settings UI controls.
