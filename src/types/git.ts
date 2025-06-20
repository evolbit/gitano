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
  pr: string | null;
  merged_in: string | null;
  files: number;
  ci: string | null;
}

export enum ChangeType {
  Added = "Added",
  Deleted = "Deleted",
  Modified = "Modified",
  Renamed = "Renamed",
  Copied = "Copied",
  TypeChanged = "TypeChanged",
}

export interface FileChange {
  path: string;
  status: ChangeType;
  insertions: number;
  deletions: number;
}

export interface CommitDiff {
  commit_sha: string;
  changes: FileChange[];
}
