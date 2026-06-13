## 1. AI Candidate Contract

- [x] 1.1 Add structured conflict AI decision types to Rust and TypeScript candidate models.
- [x] 1.2 Update merge-conflict prompt output shapes, default prompt text, prompt versions, and parser support for decision metadata.
- [x] 1.3 Include conflict-region ids and line ranges in file-scoped AI conflict context.
- [x] 1.4 Expose backend-owned default action prompts to settings and use them for prompt display/reset.
- [x] 1.5 Add separate brief summary and full details fields to conflict AI candidates.
- [x] 1.6 Use content-based result signatures for conflict AI cache/stale-safety inputs.

## 2. Merge Editor Application

- [x] 2.1 Add result-state support for applying full-file AI content with decision-derived accepted-region state.
- [x] 2.2 Change the AI fix hook to run file-scoped AI and auto-apply validated candidates.
- [x] 2.3 Replace Region/File/Apply AI panel controls with one `Resolve with AI` file-level action, refresh, and applied-decision messaging.
- [x] 2.4 Show AI Fix failures in the result panel status message instead of the AI Fix row.
- [x] 2.5 Show AI Fix success as a brief result status message with expandable details.
- [x] 2.6 Preserve line breaks in expanded AI Fix details.
- [x] 2.7 Move AI Fix details into a modal and add a dismiss control for the AI status row.
- [x] 2.8 Render AI Fix modal details as neutral per-conflict rows.
- [x] 2.9 Align AI Fix modal rows, capitalize explanations, and keep long details scrollable.

## 3. Tests and Verification

- [x] 3.1 Add/update Rust tests for prompt/parser/context decision metadata.
- [x] 3.1a Add Rust coverage for content-based result signatures.
- [x] 3.2 Add/update frontend tests for auto-apply behavior, decision labels, and simplified AI panel controls.
- [x] 3.3 Add/update tests for backend default prompt display, legacy candidate signatures, and result-panel AI error messaging.
- [x] 3.4 Add/update tests for brief AI summaries and expandable details.
- [x] 3.5 Run focused frontend/Rust tests and OpenSpec validation.
- [x] 3.6 Add focused coverage for line-preserved AI Fix details.
- [x] 3.7 Add focused coverage for the AI details modal and status-row dismissal.
- [x] 3.8 Add focused coverage for neutral per-conflict detail rows.
- [x] 3.9 Add focused coverage for aligned, capitalized, scrollable AI detail rows.
