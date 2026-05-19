## Context

The local AI foundation already provides backend-owned entitlement, model registry, runtime setup, Ollama integration, model preferences, Git context snapshots, and typed frontend adapters. The missing product layer is a persistent settings surface that lets users manage those primitives after initial setup and avoids hiding important preference failures behind workflow-specific modals.

This change was implemented after the foundation work, so the design captures the final behavior for compatibility with the OpenSpec archive rather than proposing unimplemented work.

## Goals / Non-Goals

**Goals:**

- Provide an app settings modal opened from the existing top tab-bar menu, using the same dark compact UI language as Gitano context menus and settings-like surfaces.
- Keep the settings scope limited to local AI with a sidebar containing Runtime, Models, and Configuration.
- Let users install or upgrade the managed runtime, download or delete supported models, and configure model preferences.
- Make global defaults stable: first downloaded model becomes global default; users can change it but cannot unset it while any supported model remains downloaded.
- Let action-specific preferences be cleared with a visible `---` option and persist that clear operation through a nullable backend request.
- Reconcile preferences when downloaded models disappear, including clearing all preferences when no models remain.
- Keep settings command errors inside the settings modal and reserve the bottom notice for action execution failures.

**Non-Goals:**

- Add non-AI settings categories to the modal.
- Add cloud AI providers or remote model catalogs.
- Re-enable local AI result caching while warm-request timing is being measured.
- Automatically choose action-specific models from the global default when an action has been explicitly left unset.

## Decisions

### Decision: Scope settings to a modal with an AI-only sidebar

The settings entry lives under the tab-bar three-dot menu as `Settings`. The modal presents a fixed-width left sidebar with only the AI section and the Runtime, Models, and Configuration subitems. This keeps the first settings iteration narrow and avoids adding placeholder categories that do not exist yet.

Alternative considered: mirror a full IDE settings hierarchy. That looked closer to the reference image, but it created dead navigation and did not match the current product scope.

### Decision: Keep runtime, models, and configuration separate

Runtime handles local runtime installation/upgrade and endpoint/status reporting. Models handles the catalog, installed status, downloads, deletions, and usage labels. Configuration handles global default and per-action selection. Splitting these keeps destructive model deletion separate from action assignment.

Alternative considered: a single AI settings page. That would reduce navigation but makes the page dense and mixes long-running operations with preference editing.

### Decision: The backend owns model preference invariants

The Rust model layer owns global default rules and deleted-model reconciliation. The frontend can hide invalid global-unset actions, but the backend still rejects an unset global preference and normalizes model state based on installed supported models.

Alternative considered: enforce all preference invariants in React. That would leave Tauri commands vulnerable to malformed requests and make future UI surfaces duplicate the same rules.

### Decision: Clearing action selection uses `modelId: null`

The frontend sends `modelId: null` with an `actionKind` when the user chooses `---`. The Rust request type accepts the nullable model id and treats it as clearing that specific action. The global selector ignores empty selections so the same placeholder cannot accidentally unset global default.

Alternative considered: send an empty string. That initially worked in pure frontend tests but was brittle at the Tauri command boundary and produced confusing unsupported-model errors.

### Decision: Action execution requires an action-specific model

Local AI actions no longer silently fall back to the global default when the action has no configured model. If no supported models are downloaded, commands return `No AI models available`. If models exist but the requested action has no selected model, commands return `No AI model selected for [action]`.

Alternative considered: always fall back to the global default. That makes actions more likely to run, but it conflicts with the requirement that users explicitly control which model each action uses.

### Decision: Settings errors stay in the settings modal

Settings command failures render as inline modal alerts because they are local to the settings task. AI action failures outside settings continue through the existing bottom notice surface because they relate to repository actions and should not open or depend on the settings modal.

Alternative considered: use the bottom notice for every local AI error. That blurred settings failures with Git action failures and made it harder to see which settings operation failed.

## Risks / Trade-offs

- Runtime status checks can fail while loading settings -> the modal keeps the last command error local and continues to show available state where possible.
- Deleting a model can invalidate action preferences -> reconciliation removes deleted action mappings and actions fail with a clear missing-selection error until reconfigured.
- Global default can become stale if models were downloaded before preferences existed -> loading preferences reconciles against installed supported models and promotes an available model when needed.
- Nullable command payloads require Rust deserialization coverage -> tests verify `modelId: null` is accepted as a clear request.
- Cache is temporarily disabled for timing tests -> build warnings remain until the cache read/write path is restored.
