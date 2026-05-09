export interface GitTag {
  name: string;
  annotated: boolean;
}

export interface GitRemote {
  name: string;
  remote: string | null;
}

export interface GitStash {
  hash: string;
  base_hash: string;
  untracked_files_hash: string;
  selector: string;
  author: string;
  email: string;
  date: number;
  message: string;
}

export interface GitCommit {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  heads: string[];
  tags: GitTag[];
  remotes: GitRemote[];
  stash?: GitStash | null;
}

export interface GitCommitData {
  commits: GitCommit[];
  head: string | null;
  tags: string[];
  more_commits_available: boolean;
  error?: string | null;
}

export interface CommitListItem {
  sha: string;
  message: string;
  author: string;
  date: number;
  current_branch: string;
  source_branch: string;
  commit_history: string[];
  files: number;
}

export type CommitHistoryMode = "git_log" | "first_parent";

export interface CommitListPage {
  commits: CommitListItem[];
  has_more: boolean;
}

export enum ChangeType {
  Added = "added",
  Deleted = "deleted",
  Modified = "modified",
  Renamed = "renamed",
  Copied = "copied",
  TypeChanged = "typeChanged",
}

export interface FileChange {
  path: string;
  status:
    | "added"
    | "deleted"
    | "modified"
    | "renamed"
    | "copied"
    | "typeChanged";
  insertions: number;
  deletions: number;
}

export interface CommitDiff {
  commitSha: string;
  changes: FileChange[];
}

export interface FileChangeWithHunks extends FileChange {
  hunks: DiffHunk[];
}

export interface DiffLine {
  kind: "Add" | "Del" | "Context";
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
  is_new_file: boolean;
}
