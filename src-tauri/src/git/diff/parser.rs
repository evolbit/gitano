use crate::git::types::*;
use regex::Regex;

pub fn parse_unified_diff(diff: &str) -> Vec<DiffHunk> {
    let hunk_re = Regex::new(r"^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@").unwrap();
    let mut hunks = Vec::new();
    let mut lines = diff.lines().peekable();

    while let Some(line) = lines.next() {
        if let Some(cap) = hunk_re.captures(line) {
            let old_start = cap[1].parse::<usize>().unwrap();
            let old_lines = cap.get(2).map_or(1, |m| m.as_str().parse().unwrap_or(1));
            let new_start = cap[3].parse::<usize>().unwrap();
            let new_lines = cap.get(4).map_or(1, |m| m.as_str().parse().unwrap_or(1));
            let mut hunk_lines = Vec::new();
            let mut old_lineno = old_start;
            let mut new_lineno = new_start;
            while let Some(&next_line) = lines.peek() {
                if next_line.starts_with("@@") {
                    break;
                }
                let (kind, content, old_num, new_num) = if next_line.starts_with('+') {
                    (DiffLineKind::Add, &next_line[1..], None, Some(new_lineno))
                } else if next_line.starts_with('-') {
                    (DiffLineKind::Del, &next_line[1..], Some(old_lineno), None)
                } else {
                    (
                        DiffLineKind::Context,
                        if next_line.starts_with(' ') {
                            &next_line[1..]
                        } else {
                            next_line
                        },
                        Some(old_lineno),
                        Some(new_lineno),
                    )
                };
                hunk_lines.push(DiffLine {
                    kind,
                    content: content.to_string(),
                    old_lineno: old_num,
                    new_lineno: new_num,
                });
                match kind {
                    DiffLineKind::Add => new_lineno += 1,
                    DiffLineKind::Del => old_lineno += 1,
                    DiffLineKind::Context => {
                        old_lineno += 1;
                        new_lineno += 1;
                    }
                }
                lines.next();
            }
            hunks.push(DiffHunk {
                header: line.to_string(),
                old_start,
                old_lines,
                new_start,
                new_lines,
                lines: hunk_lines,
                is_new_file: false,
            });
        }
    }
    hunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_hunk_headers_and_line_numbers_for_mixed_changes() {
        let hunks = parse_unified_diff(
            "\
diff --git a/file.txt b/file.txt
@@ -1,2 +1,3 @@
 same
-old
+new
+extra
",
        );

        assert_eq!(hunks.len(), 1);
        assert_eq!(hunks[0].header, "@@ -1,2 +1,3 @@");
        assert_eq!(hunks[0].lines[1].kind, DiffLineKind::Del);
        assert_eq!(hunks[0].lines[1].old_lineno, Some(2));
        assert_eq!(hunks[0].lines[2].kind, DiffLineKind::Add);
        assert_eq!(hunks[0].lines[2].new_lineno, Some(2));
    }

    #[test]
    fn defaults_missing_range_counts_to_one_line() {
        let hunks = parse_unified_diff(
            "\
@@ -7 +9 @@
-old
+new
",
        );

        assert_eq!(hunks[0].old_lines, 1);
        assert_eq!(hunks[0].new_lines, 1);
    }
}
