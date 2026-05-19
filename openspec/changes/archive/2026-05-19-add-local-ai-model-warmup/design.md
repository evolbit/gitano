## Context

Local AI already has a curated model catalog, persisted model preferences, runtime/model status checks, and settings panes for Runtime, Models, and Configuration. The first visible request can still be slow because Ollama loads model weights lazily, and a model may unload after inactivity.

Ollama supports a top-level `keep_alive` field on generate requests. Gitano can use that to warm selected downloaded models and keep actively used models loaded without introducing a new runtime dependency.

## Goals / Non-Goals

**Goals:**

- Let users opt downloaded models into warmup from the settings UI.
- Keep warmup decisions explicit and memory-aware.
- Warn when a single selected model or the cumulative selected warm models may use too much memory.
- Keep the implementation backend-owned: the frontend sends preference changes, while Rust validates models, persists settings, and performs warmup.
- Add keep-alive to normal local AI action generation so repeated requests stay fast.

**Non-Goals:**

- Automatically warm every downloaded model.
- Block advanced users from keeping large models warm after they confirm the warning.
- Build a full memory-pressure monitor or power/battery-aware scheduler in this change.
- Re-enable digest result caching while warm request timing is still being measured.

## Decisions

### Decision: Store warm preferences with local AI preferences

Warm model ids and the keep-alive duration belong beside the existing global and action model preferences in `preferences.json`. This keeps user intent local, easy to reconcile after model deletion, and available to backend commands without frontend-only state.

Alternative considered: store warm preferences in browser localStorage. That would avoid a Rust migration, but it would split source of truth and make app startup warmup impossible before the settings UI loads.

### Decision: Extend the curated model catalog with warmup metadata

The catalog already knows each model's hardware requirements. Add explicit warmup metadata derived from the same local registry: estimated loaded memory in GB and a memory class such as small, medium, large, or very large. The frontend should render this metadata, but threshold decisions should come from backend-returned warning data where possible.

Alternative considered: derive every warning directly from existing recommended memory. That is simpler, but less precise for multiple small models because recommended machine RAM and estimated loaded model memory are related but not identical.

### Decision: Warn on cumulative selected warm memory

The warning should trigger when the selected warm models exceed the baseline threshold of 5 GB or a high share of detected total memory. The warning is confirmable because users may intentionally choose to reserve memory for faster local AI.

If total memory is unavailable, Gitano still warns based on the 5 GB cumulative estimate and any large/very-large individual model classification.

### Decision: Use Ollama `keep_alive` on hidden and visible requests

Warmup requests should call `/api/generate` with a tiny hidden prompt and top-level `keep_alive`, and normal action requests should include the same `keep_alive` value. This avoids a separate preload mechanism and refreshes model lifetime during real work.

Alternative considered: periodically shell out to `ollama run`. That would be harder to manage in the Tauri process model, less portable, and disconnected from the configured endpoint.

### Decision: Warm only installed opted-in models

The checkbox is disabled or ignored for models that are not downloaded. Deleting a model removes it from warm preferences during existing model reconciliation, preventing repeated warmup failures.

## Risks / Trade-offs

- [Memory pressure] Keeping several models loaded can slow the machine. → Show cumulative estimates before enabling and require explicit confirmation when thresholds are crossed.
- [Runtime differences] External Ollama installations may unload models differently. → Use the standard generate `keep_alive` parameter and surface warmup failures as non-blocking settings errors.
- [Startup work] Warming large models immediately on app launch can make Gitano feel busy. → Warm only user-selected models and do it asynchronously after runtime readiness checks.
- [Estimate accuracy] Loaded memory varies by quantization and runtime behavior. → Label estimates as approximate and keep warnings conservative.
