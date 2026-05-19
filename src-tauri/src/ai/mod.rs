pub mod cache;
pub mod commands;
pub mod entitlement;
pub mod git_context;
pub mod machine;
pub mod models;
pub mod ollama;
pub mod prompts;
pub mod runtime;
pub mod types;

pub use commands::*;

#[cfg(test)]
pub(crate) fn local_ai_env_lock() -> &'static std::sync::Mutex<()> {
    static LOCK: std::sync::OnceLock<std::sync::Mutex<()>> = std::sync::OnceLock::new();
    LOCK.get_or_init(|| std::sync::Mutex::new(()))
}
