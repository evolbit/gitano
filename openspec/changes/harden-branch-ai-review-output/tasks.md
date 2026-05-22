## 1. Effective Context Budgeting

- [x] 1.1 Introduce a shared effective-context calculation for local AI generation so prompt budgeting and Ollama `num_ctx` use the same value.
- [x] 1.2 Remove the unintended fixed 32,768 branch-review context clamp for large-context models while preserving intentional lower bounds and output-token reservation.
- [x] 1.3 Update Git context budgeting to reserve response space before truncating branch analysis/review context.
- [x] 1.4 Add Rust tests proving Phi-sized branch review context is not budgeted larger than the runtime `num_ctx` request.

## 2. Branch Review Output Validation

- [x] 2.1 Harden branch-review parsing to reject structurally empty JSON or blank summaries with no usable findings/notes.
- [x] 2.2 Convert useful unanchored or malformed inline findings into review notes instead of silently dropping them.
- [x] 2.3 Prevent unusable branch-review outputs from being cached as successful local AI results.
- [x] 2.4 Bump the local AI prompt/cache version for the changed review contract.
- [x] 2.5 Add Rust parser tests for `{}`, empty findings with blank summary, useful malformed findings, and genuine no-finding summaries.

## 3. Branch Review UI Feedback

- [x] 3.1 Render branch-review model-output failures through the existing local AI error/notice path instead of the no-finding empty state.
- [x] 3.2 Show omitted-file or omitted-section metadata in the local AI result modal for branch analysis/review results.
- [x] 3.3 Keep invalid-anchor findings visible as review notes while preventing inline application controls for those notes.
- [x] 3.4 Add frontend tests covering unusable review output, metadata display, and unanchored note rendering.

## 4. Verification

- [x] 4.1 Run focused Rust tests for local AI prompt budgeting, Ollama generation options, and branch-review parsing.
- [x] 4.2 Run focused frontend tests for branch comparison review and local AI result modal behavior.
- [x] 4.3 Run `npm run build`, relevant Rust checks, and OpenSpec validation for the change.
