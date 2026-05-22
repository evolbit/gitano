use super::types::LocalAiActionKind;

const COMMIT_MESSAGE_MIN_CONTEXT_TOKENS: usize = 2_048;
const COMMIT_MESSAGE_MAX_CONTEXT_TOKENS: usize = 8_192;
const DEFAULT_MIN_CONTEXT_TOKENS: usize = 4_096;
const BRANCH_MIN_CONTEXT_TOKENS: usize = 8_192;
const MAX_EFFECTIVE_CONTEXT_TOKENS: usize = 65_536;
const COMMIT_MESSAGE_MAX_CONTEXT_CHARS: usize = 18_000;
const CHARS_PER_TOKEN_ESTIMATE: usize = 3;
const MIN_INPUT_CONTEXT_TOKENS: usize = 512;
const PROMPT_CONTEXT_MARGIN_TOKENS: usize = 512;

pub fn effective_context_window(
    action_kind: LocalAiActionKind,
    model_context_window: usize,
) -> usize {
    match action_kind {
        LocalAiActionKind::CommitMessage => model_context_window.clamp(
            COMMIT_MESSAGE_MIN_CONTEXT_TOKENS,
            COMMIT_MESSAGE_MAX_CONTEXT_TOKENS,
        ),
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            model_context_window.clamp(BRANCH_MIN_CONTEXT_TOKENS, MAX_EFFECTIVE_CONTEXT_TOKENS)
        }
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::MergeConflictSuggestions => {
            model_context_window.clamp(DEFAULT_MIN_CONTEXT_TOKENS, MAX_EFFECTIVE_CONTEXT_TOKENS)
        }
    }
}

pub fn generation_num_predict(action_kind: LocalAiActionKind) -> usize {
    match action_kind {
        LocalAiActionKind::CommitMessage => 96,
        LocalAiActionKind::CommitAnalysis => 1_600,
        LocalAiActionKind::BranchAnalysis => 3_072,
        LocalAiActionKind::BranchReview => 4_096,
        LocalAiActionKind::MergeConflictSuggestions => 1_800,
    }
}

pub fn prompt_context_budget_chars(
    action_kind: LocalAiActionKind,
    model_context_window: usize,
) -> usize {
    let effective_context_window = effective_context_window(action_kind, model_context_window);
    let input_context_tokens = effective_context_window
        .saturating_sub(generation_num_predict(action_kind))
        .max(MIN_INPUT_CONTEXT_TOKENS);
    let model_budget = input_context_tokens.saturating_mul(CHARS_PER_TOKEN_ESTIMATE);

    match action_kind {
        LocalAiActionKind::CommitMessage => model_budget.min(COMMIT_MESSAGE_MAX_CONTEXT_CHARS),
        LocalAiActionKind::CommitAnalysis
        | LocalAiActionKind::BranchAnalysis
        | LocalAiActionKind::BranchReview
        | LocalAiActionKind::MergeConflictSuggestions => model_budget,
    }
}

pub fn generation_context_window_for_prompt(
    action_kind: LocalAiActionKind,
    model_context_window: usize,
    prompt_chars: usize,
) -> usize {
    let max_context_window = effective_context_window(action_kind, model_context_window);
    let prompt_tokens = prompt_chars.div_ceil(CHARS_PER_TOKEN_ESTIMATE);
    let requested_context_window = prompt_tokens
        .saturating_add(generation_num_predict(action_kind))
        .saturating_add(PROMPT_CONTEXT_MARGIN_TOKENS);

    requested_context_window.clamp(min_context_window(action_kind), max_context_window)
}

fn min_context_window(action_kind: LocalAiActionKind) -> usize {
    match action_kind {
        LocalAiActionKind::CommitMessage => COMMIT_MESSAGE_MIN_CONTEXT_TOKENS,
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            BRANCH_MIN_CONTEXT_TOKENS
        }
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::MergeConflictSuggestions => {
            DEFAULT_MIN_CONTEXT_TOKENS
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn branch_review_caps_phi_context_for_interactive_runs() {
        let effective = effective_context_window(LocalAiActionKind::BranchReview, 131_072);

        assert_eq!(effective, MAX_EFFECTIVE_CONTEXT_TOKENS);
    }

    #[test]
    fn branch_review_prompt_budget_reserves_response_tokens() {
        let budget = prompt_context_budget_chars(LocalAiActionKind::BranchReview, 131_072);
        let total_context_chars = MAX_EFFECTIVE_CONTEXT_TOKENS * CHARS_PER_TOKEN_ESTIMATE;

        assert_eq!(
            budget,
            (MAX_EFFECTIVE_CONTEXT_TOKENS - 4_096) * CHARS_PER_TOKEN_ESTIMATE
        );
        assert!(budget < total_context_chars);
    }

    #[test]
    fn generation_context_uses_prompt_size_without_allocating_full_phi_context() {
        let context =
            generation_context_window_for_prompt(LocalAiActionKind::BranchReview, 131_072, 12_000);

        assert!(context > BRANCH_MIN_CONTEXT_TOKENS);
        assert!(context < MAX_EFFECTIVE_CONTEXT_TOKENS);
    }

    #[test]
    fn generation_context_never_exceeds_prompt_budget_cap() {
        let context = generation_context_window_for_prompt(
            LocalAiActionKind::BranchReview,
            131_072,
            usize::MAX,
        );

        assert_eq!(context, MAX_EFFECTIVE_CONTEXT_TOKENS);
    }

    #[test]
    fn commit_message_prompt_budget_remains_small() {
        let budget = prompt_context_budget_chars(LocalAiActionKind::CommitMessage, 32_768);

        assert_eq!(budget, COMMIT_MESSAGE_MAX_CONTEXT_CHARS);
    }
}
