use super::git_context::digest_parts;
use super::models::local_ai_data_dir;
use super::types::{LocalAiActionKind, LocalAiCacheEntry, LocalAiRunResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct LocalAiCacheFile {
    entries: HashMap<String, LocalAiCacheEntry>,
}

pub fn build_cache_key(
    action_kind: LocalAiActionKind,
    prompt_version: &str,
    model_digest: &str,
    prompt_instruction: &str,
    repo_path: &str,
    input_digest: &str,
) -> String {
    digest_parts(&[
        action_kind.as_key(),
        prompt_version,
        model_digest,
        prompt_instruction,
        repo_path,
        input_digest,
    ])
}

pub fn get_cached_result(key: &str) -> Option<LocalAiRunResult> {
    load_cache().entries.get(key).map(|entry| {
        let mut result = entry.result.clone();
        result.from_cache = true;
        result
    })
}

pub fn put_cached_result(key: String, result: &LocalAiRunResult) -> Result<(), String> {
    let mut cache = load_cache();
    let mut stored_result = result.clone();
    stored_result.from_cache = false;
    cache.entries.insert(
        key.clone(),
        LocalAiCacheEntry {
            key,
            created_at_ms: now_ms(),
            result: stored_result,
        },
    );
    save_cache(&cache)
}

fn cache_path() -> PathBuf {
    local_ai_data_dir().join("analysis-cache.json")
}

fn load_cache() -> LocalAiCacheFile {
    let Ok(contents) = fs::read_to_string(cache_path()) else {
        return LocalAiCacheFile::default();
    };

    serde_json::from_str(&contents).unwrap_or_default()
}

fn save_cache(cache: &LocalAiCacheFile) -> Result<(), String> {
    let path = cache_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let contents = serde_json::to_string_pretty(cache).map_err(|e| e.to_string())?;
    fs::write(path, contents).map_err(|e| e.to_string())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::{
        LocalAiCommitMessageResult, LocalAiRunMetadata, LocalAiStructuredResult,
    };

    #[test]
    fn cache_key_changes_with_model_digest() {
        let first = build_cache_key(
            LocalAiActionKind::CommitAnalysis,
            "v1",
            "digest-a",
            "prompt",
            "/repo",
            "input",
        );
        let second = build_cache_key(
            LocalAiActionKind::CommitAnalysis,
            "v1",
            "digest-b",
            "prompt",
            "/repo",
            "input",
        );

        assert_ne!(first, second);
    }

    #[test]
    fn cache_key_changes_with_action_kind() {
        let analysis = build_cache_key(
            LocalAiActionKind::BranchAnalysis,
            "v1",
            "digest",
            "prompt",
            "/repo",
            "input",
        );
        let review = build_cache_key(
            LocalAiActionKind::BranchReview,
            "v1",
            "digest",
            "prompt",
            "/repo",
            "input",
        );

        assert_ne!(analysis, review);
    }

    #[test]
    fn cache_key_changes_with_prompt_instruction() {
        let first = build_cache_key(
            LocalAiActionKind::CommitAnalysis,
            "v1",
            "digest",
            "first prompt",
            "/repo",
            "input",
        );
        let second = build_cache_key(
            LocalAiActionKind::CommitAnalysis,
            "v1",
            "digest",
            "second prompt",
            "/repo",
            "input",
        );

        assert_ne!(first, second);
    }

    #[test]
    fn cached_result_is_marked_from_cache() {
        let result = LocalAiRunResult {
            action_kind: LocalAiActionKind::CommitMessage,
            model_id: "qwen2.5-coder:7b".to_string(),
            model_digest: "digest".to_string(),
            prompt_version: "v1".to_string(),
            input_digest: "input".to_string(),
            from_cache: false,
            metadata: LocalAiRunMetadata {
                omitted_files: vec![],
                omitted_sections: vec![],
            },
            result: LocalAiStructuredResult::CommitMessage(LocalAiCommitMessageResult {
                message: "Add cache".to_string(),
                alternatives: vec![],
            }),
        };
        let entry = LocalAiCacheEntry {
            key: "key".to_string(),
            created_at_ms: 1,
            result,
        };
        let mut file = LocalAiCacheFile::default();
        file.entries.insert("key".to_string(), entry);

        let mut cached = file.entries.get("key").unwrap().result.clone();
        cached.from_cache = true;

        assert!(cached.from_cache);
    }
}
