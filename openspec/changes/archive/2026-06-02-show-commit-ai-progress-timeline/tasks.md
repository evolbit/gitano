## 1. Backend Progress Events

- [x] 1.1 Add a commit-analysis run progress event type with a request/run id and milestone state.
- [x] 1.2 Emit real milestones for commit analysis: resolving commit, reading diff context, checking cache, cache hit, running local model, formatting result, completed, and failed.
- [x] 1.3 Preserve cache reads/writes for normal commit analysis and bypass cache only when refresh is requested.
- [x] 1.4 Ensure stale or failed runs emit enough information for the frontend to stop the progress state.

## 2. Frontend API And State

- [x] 2.1 Add frontend local AI progress event types and listener helpers for commit-analysis runs.
- [x] 2.2 Track commit-analysis progress by run id so refresh/close ignores stale events.
- [x] 2.3 Clear existing progress when the user starts or refreshes commit analysis.

## 3. Modal UI

- [x] 3.1 Render a progress timeline in the local AI result modal while commit analysis is loading.
- [x] 3.2 Pace fast progress milestones with a small frontend display interval without inventing fake steps.
- [x] 3.3 Show an elapsed-time running state and neutral waiting guidance while the local model is running.
- [x] 3.4 Preserve the existing structured analysis result rendering once the final result is available.

## 4. Verification

- [x] 4.1 Add or update backend tests for commit-analysis cache hit, refresh bypass, and emitted progress milestones where practical.
- [x] 4.2 Add or update frontend tests for progress clearing, paced timeline display, cache-hit display, and stale run handling where practical.
- [x] 4.3 Run focused tests for local AI API, commit-list analysis behavior, and local AI result modal behavior.
- [x] 4.4 Run a frontend build or typecheck and relevant Rust tests.
