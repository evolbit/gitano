#[derive(Clone)]
pub(in crate::git::commits) struct RawCommitRow {
    pub(super) sha: String,
    pub(super) parents: Vec<String>,
    pub(super) date: i64,
    pub(super) author: String,
    pub(super) author_email: String,
    pub(super) refs: Vec<String>,
    pub(super) message: String,
}

pub(in crate::git::commits) fn parse_raw_commit_rows(stdout: &str) -> Vec<RawCommitRow> {
    stdout
        .lines()
        .filter_map(|raw_line| {
            let line = raw_line.trim_end_matches('\r');
            if line.trim().is_empty() {
                return None;
            }

            let mut fields = line.splitn(7, '\u{001f}');
            let sha = fields.next().unwrap_or("").trim().to_string();
            if sha.is_empty() {
                return None;
            }

            let parents = fields
                .next()
                .unwrap_or("")
                .split_whitespace()
                .map(|parent| parent.to_string())
                .collect::<Vec<_>>();
            let date = fields
                .next()
                .unwrap_or("0")
                .trim()
                .parse::<i64>()
                .unwrap_or(0);
            let author = fields.next().unwrap_or("").to_string();
            let author_email = fields.next().unwrap_or("").to_string();
            let refs = parse_ref_labels(fields.next().unwrap_or(""));
            let message = fields.next().unwrap_or("").to_string();

            Some(RawCommitRow {
                sha,
                parents,
                date,
                author,
                author_email,
                refs,
                message,
            })
        })
        .collect()
}

fn parse_ref_labels(raw_refs: &str) -> Vec<String> {
    raw_refs
        .split(',')
        .map(|label| label.trim())
        .filter(|label| !label.is_empty())
        .map(|label| {
            if let Some(head_target) = label.strip_prefix("HEAD -> ") {
                head_target.trim().to_string()
            } else {
                label.to_string()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    mod parse_ref_labels {
        use super::*;

        #[test]
        fn trims_labels_and_strips_head_arrow_prefix() {
            let labels = parse_ref_labels("HEAD -> main, tag: v1.0.0, origin/main");

            assert_eq!(labels, vec!["main", "tag: v1.0.0", "origin/main"]);
        }
    }

    mod parse_raw_commit_rows {
        use super::*;

        #[test]
        fn skips_blank_rows_and_extracts_commit_fields() {
            let rows = parse_raw_commit_rows(
                "\nabc123\x1fparent1 parent2\x1f42\x1fAda\x1fada@example.invalid\x1fHEAD -> main\x1fInitial commit\n",
            );

            assert_eq!(rows.len(), 1);
            assert_eq!(rows[0].sha, "abc123");
            assert_eq!(rows[0].parents, vec!["parent1", "parent2"]);
            assert_eq!(rows[0].refs, vec!["main"]);
        }
    }
}
