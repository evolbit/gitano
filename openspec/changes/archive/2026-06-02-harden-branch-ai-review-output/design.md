## Context

Branch comparison review uses the local AI action `branchReview`. The frontend asks the backend to run the action, the backend builds Git diff context, sends a JSON-mode request to Ollama, parses the returned JSON into `LocalAiBranchReviewResult`, and the branch comparison modal renders inline findings plus review notes.

Exploration found several weak points in that path:

- `phi4-mini` is cataloged with a 131,072 token context window, but local AI generation currently clamps branch-review `num_ctx` to 32,768.
- Prompt budgeting uses the catalog context window, so Gitano can budget prompt context as if the model will run with a larger context than the Ollama request actually uses.
- Branch-review parsing accepts structurally empty JSON as a successful empty review.
- Inline findings missing `filePath` or `line` are silently dropped by the backend parser.
- The UI renders "No actionable review findings returned" for both genuine no-issue reviews and unusable model output that happened to parse into an empty structure.
- Cached empty results can continue to be returned until the prompt/cache version changes or the user forces refresh.

## Goals / Non-Goals

**Goals:**

- Make branch AI review distinguish genuine no-finding reviews from unusable local model output.
- Align Git context budgeting with the effective context window sent to Ollama.
- Reserve response space so branch review JSON has room to complete.
- Preserve useful unanchored model feedback as review notes instead of dropping it silently.
- Surface context truncation or omission metadata in branch AI result UI.
- Invalidate stale cached branch AI results created under the weaker prompt/parser contract.

**Non-Goals:**

- Replace Phi or remove Phi from the model catalog.
- Add cloud AI fallback or send repository content outside the configured local runtime.
- Change the branch comparison diff model or draft review-thread persistence.
- Invent review findings when the local model genuinely reports no actionable issues.

## Decisions

### Decision: Use one effective context budget for prompt building and Ollama generation

Gitano should compute an effective context window per local AI request and use it in both places: prompt budgeting and Ollama `num_ctx`. For branch analysis/review, the effective context should be the selected model's catalog context window capped only by an intentional product/runtime maximum, not the current fixed 32,768 ceiling. The prompt budget should reserve room for output tokens before truncating input context.

Alternative considered: keep `num_ctx` capped at 32,768 and lower the prompt budget to match. That would be internally consistent, but it would waste Phi's advertised 128K context and make large branch review less useful.

### Decision: Treat structurally empty branch review output as an error

A branch review result with no findings, no notes, and no meaningful summary should fail parsing with a user-visible local AI output error. A genuine no-finding review remains valid only when the model returns an explicit, non-empty summary explaining that no actionable changed-code risks were found.

Alternative considered: keep accepting `{}` and show "No actionable review findings returned." That hides model failures and makes users believe the review was successful when Gitano has no evidence that a real review occurred.

### Decision: Salvage useful malformed inline findings as notes

When a model returns a finding with useful review text but missing or invalid inline anchor fields, Gitano should convert it to an unanchored review note. Truly empty objects should still be discarded or make the overall response invalid if nothing usable remains.

Alternative considered: reject the whole response when any finding is malformed. That is strict, but small local models commonly miss one field while still producing useful feedback. Preserving useful feedback fits the product goal better as long as invalid anchors are not rendered inline.

### Decision: Surface context metadata in result UI

The local AI result modal should show omitted/truncated context metadata when present, especially for branch analysis/review. This is a lightweight disclosure that explains degraded output without requiring users to inspect backend logs or cache files.

Alternative considered: only log metadata. That helps debugging but does not explain to the user why a local AI result may be weak.

### Decision: Bump prompt/cache version

The change should bump `PROMPT_VERSION` so branch review and analysis cache keys change. This prevents previously accepted empty Phi outputs from being reused after parser and budgeting semantics improve.

Alternative considered: selectively purge cache entries. Versioned cache keys are already the mechanism for prompt/result contract changes and avoid destructive cache mutation.

## Risks / Trade-offs

- Larger `num_ctx` can increase memory use and latency for Phi and other large-context models -> Cap effective context by an intentional product maximum if needed, and keep model compatibility warnings meaningful.
- Stricter parser validation may turn some previously "successful" outputs into errors -> This is acceptable because the old success state was misleading; the error should include a clear reason and refresh path.
- Salvaging malformed findings as notes may show less precise feedback -> Notes are non-inline and cannot be applied automatically, so they preserve usefulness without creating bad line comments.
- Metadata disclosure could add visual noise -> Show it as a compact warning or details block only when omission/truncation metadata exists.
