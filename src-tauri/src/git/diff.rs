mod branch_compare;
mod commit;
mod index;
mod parser;
mod worktree;

pub use branch_compare::{
    get_branch_comparison_file_diff, get_branch_comparison_files, BranchComparisonMode,
};
pub use commit::{
    get_commit_file_diff, get_commit_worktree_comparison_file_diff,
    get_commit_worktree_comparison_files,
};
pub use index::get_index_diffs_for_files;
pub use parser::parse_unified_diff;
pub use worktree::{get_diff_context, get_file_diff_hunks};
