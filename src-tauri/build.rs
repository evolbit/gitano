use std::path::{Path, PathBuf};

const GITHUB_OAUTH_CLIENT_ID_ENV: &str = "GITANO_GITHUB_OAUTH_CLIENT_ID";

fn main() {
    embed_github_oauth_client_id();
    tauri_build::build()
}

fn embed_github_oauth_client_id() {
    for path in env_file_candidates() {
        println!("cargo:rerun-if-changed={}", path.display());
    }

    if let Some(client_id) = std::env::var(GITHUB_OAUTH_CLIENT_ID_ENV)
        .ok()
        .or_else(github_oauth_client_id_from_env_file)
        .map(|client_id| client_id.trim().to_string())
        .filter(|client_id| !client_id.is_empty())
    {
        println!("cargo:rustc-env={GITHUB_OAUTH_CLIENT_ID_ENV}={client_id}");
    }
}

fn github_oauth_client_id_from_env_file() -> Option<String> {
    env_file_candidates().into_iter().find_map(|path| {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|contents| parse_env_file_value(&contents, GITHUB_OAUTH_CLIENT_ID_ENV))
    })
}

fn env_file_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut push_candidates = |root: &Path| {
        candidates.push(root.join(".env.local"));
        candidates.push(root.join(".env"));
    };

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let manifest_dir = PathBuf::from(manifest_dir);
        if let Some(repo_root) = manifest_dir.parent() {
            push_candidates(repo_root);
        }
        push_candidates(&manifest_dir);
    }

    candidates
}

fn parse_env_file_value(contents: &str, key: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            return None;
        }

        let line = line.strip_prefix("export ").unwrap_or(line);
        let (name, value) = line.split_once('=')?;
        if name.trim() != key {
            return None;
        }

        let value = value
            .trim()
            .trim_matches(|character| character == '"' || character == '\'')
            .trim();
        if value.is_empty() {
            None
        } else {
            Some(value.to_string())
        }
    })
}
