## 1. Settings Entry And Modal

- [x] 1.1 Replace the top `+` settings entry with a three-dot tab-bar menu that contains `Settings`.
- [x] 1.2 Match the tab-bar menu styling to existing context-menu colors, spacing, borders, and font sizes.
- [x] 1.3 Add a settings modal with an AI-only sidebar and Runtime, Models, and Configuration panes.
- [x] 1.4 Align modal header/sidebar sizing and remove non-AI placeholder settings categories.

## 2. Runtime And Model Management

- [x] 2.1 Add runtime status, endpoint, installed version, storage path, and install/upgrade controls.
- [x] 2.2 Add model catalog rows with installed status, download actions, delete actions, and progress rendering.
- [x] 2.3 Add Qwen2.5 Coder 1.5B, DeepSeek Coder 1.3B, and Phi-4 Mini to the supported model catalog.
- [x] 2.4 Refresh settings state after runtime/model operations and progress completion.

## 3. Model Preference Rules

- [x] 3.1 Add global default selection that cannot be unset manually while downloaded models exist.
- [x] 3.2 Set the first downloaded supported model as the global default and keep it stable unless the user changes it.
- [x] 3.3 Clear global and action preferences when all supported models have been deleted.
- [x] 3.4 Reconcile deleted or stale model preferences against the installed supported model list.
- [x] 3.5 Add per-action model selectors with `---` placeholders for unset actions.
- [x] 3.6 Send nullable action-clear requests and accept them at the Rust command boundary.

## 4. AI Action Error Behavior

- [x] 4.1 Return `No AI models available` when local AI action endpoints run with no downloaded supported models.
- [x] 4.2 Return `No AI model selected for [action]` when an action has no selected model.
- [x] 4.3 Show AI action execution failures through the existing bottom notice.
- [x] 4.4 Show settings command failures inside the settings modal instead of the bottom notice.

## 5. Verification

- [x] 5.1 Add or update frontend tests for settings navigation, unset placeholders, action clearing, and modal-scoped errors.
- [x] 5.2 Add or update API tests for nullable model preference payloads.
- [x] 5.3 Add or update Rust tests for nullable clear requests, global defaulting, deleted-model reconciliation, and missing-action errors.
- [x] 5.4 Run focused frontend tests for settings and local AI API behavior.
- [x] 5.5 Run Rust model/type tests and the full Rust test suite.
- [x] 5.6 Run frontend build, targeted linting, and diff whitespace checks.
