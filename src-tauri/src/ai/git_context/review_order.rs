use super::{run_git, DIFF_CONTEXT_LINES};

pub(super) fn parse_name_status_paths(name_status: &str) -> Vec<String> {
    name_status
        .lines()
        .filter_map(|line| line.split('\t').next_back())
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(ToString::to_string)
        .collect()
}

pub(super) fn prioritized_branch_diff(
    repo_path: &str,
    from_ref: &str,
    head_sha: &str,
    name_status: &str,
) -> Result<String, String> {
    let mut file_paths = parse_name_status_paths(name_status)
        .into_iter()
        .enumerate()
        .collect::<Vec<_>>();
    file_paths.sort_by_key(|(index, path)| (review_path_priority(path), *index));

    let mut diffs = Vec::new();
    for (_, file_path) in file_paths {
        let diff = run_git(
            repo_path,
            &[
                "diff",
                "--find-renames",
                &format!("-U{}", DIFF_CONTEXT_LINES),
                from_ref,
                head_sha,
                "--",
                &file_path,
            ],
        )?;

        if !diff.trim().is_empty() {
            diffs.push(diff);
        }
    }

    Ok(diffs.join("\n"))
}

fn review_path_priority(path: &str) -> u8 {
    let lower = path.to_ascii_lowercase();

    if is_test_path(&lower) {
        return 1;
    }

    if is_source_path(&lower) {
        return 0;
    }

    if is_documentation_path(&lower) {
        return 4;
    }

    if is_config_path(&lower) {
        return 2;
    }

    3
}

fn is_source_path(path: &str) -> bool {
    let extension = path.rsplit('.').next().unwrap_or_default();
    path.starts_with("src/")
        || path.contains("/src/")
        || matches!(
            extension,
            "c" | "cc"
                | "cpp"
                | "cs"
                | "ex"
                | "exs"
                | "go"
                | "h"
                | "hpp"
                | "java"
                | "js"
                | "jsx"
                | "kt"
                | "php"
                | "py"
                | "rb"
                | "rs"
                | "scala"
                | "swift"
                | "ts"
                | "tsx"
                | "vue"
                | "svelte"
        )
}

fn is_test_path(path: &str) -> bool {
    path.contains("__tests__/")
        || path.contains("/tests/")
        || path.starts_with("tests/")
        || path.contains(".test.")
        || path.contains(".spec.")
}

fn is_config_path(path: &str) -> bool {
    matches!(
        path,
        "cargo.toml"
            | "cargo.lock"
            | "package.json"
            | "package-lock.json"
            | "pnpm-lock.yaml"
            | "yarn.lock"
            | "tsconfig.json"
            | "vite.config.ts"
            | "vite.config.js"
    ) || matches!(
        path.rsplit('.').next().unwrap_or_default(),
        "json" | "toml" | "yaml" | "yml"
    )
}

fn is_documentation_path(path: &str) -> bool {
    path.starts_with("docs/")
        || path.starts_with("openspec/")
        || path.ends_with(".md")
        || path.ends_with(".mdx")
        || path.ends_with(".txt")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_name_status_paths_with_renames() {
        let paths = parse_name_status_paths("M\tsrc/app.ts\nR100\tsrc/old.ts\tsrc/new.ts\n");

        assert_eq!(paths, vec!["src/app.ts", "src/new.ts"]);
    }
}
