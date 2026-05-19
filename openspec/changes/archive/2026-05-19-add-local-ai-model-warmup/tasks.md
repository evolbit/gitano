## 1. Backend Model Warmup Data

- [x] 1.1 Add warm memory estimate and memory class fields to local AI model types and catalog entries.
- [x] 1.2 Extend local AI preferences with warm model ids and keep-alive duration defaults.
- [x] 1.3 Reconcile warm model ids when models are deleted or no supported models remain.

## 2. Backend Warmup Runtime Behavior

- [x] 2.1 Add top-level Ollama `keep_alive` support to generation requests.
- [x] 2.2 Add an Ollama warmup request helper for installed selected models.
- [x] 2.3 Add a Tauri command to warm configured models and register it in the command handler.
- [x] 2.4 Include keep-alive on normal local AI action generation.

## 3. Frontend API And Settings UI

- [x] 3.1 Extend shared local AI API types and wrappers for warm metadata and warmup preference commands.
- [x] 3.2 Render warm memory class/estimate in the Models pane.
- [x] 3.3 Add `Keep this model warm` checkbox below model controls for downloaded models.
- [x] 3.4 Add cumulative warm memory threshold confirmation before persisting risky warm selections.

## 4. Verification

- [x] 4.1 Add or update Rust tests for defaults, reconciliation, memory class metadata, and keep-alive request serialization.
- [x] 4.2 Add or update frontend tests for warm controls and threshold warnings.
- [x] 4.3 Run focused Rust and frontend test suites for the changed areas.
