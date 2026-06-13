mod builders;
mod parser;

use super::types::LocalAiActionKind;

pub use builders::{
    build_external_agent_prompt_with_instruction, build_prompt_with_instruction,
    effective_prompt_instruction,
};
pub use parser::parse_structured_result;

pub const PROMPT_VERSION: &str = "local-ai-v5";
pub const EXTERNAL_AGENT_PROMPT_VERSION: &str = "external-acp-v3";

#[allow(dead_code)]
pub fn default_prompt_instruction(action_kind: LocalAiActionKind) -> &'static str {
    builders::default_prompt_instruction(action_kind)
}
