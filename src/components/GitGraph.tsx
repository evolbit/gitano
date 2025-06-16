import { core } from "@tauri-apps/api";
import { useEffect, useState } from "react";

interface CommitNode {
  id: string;
  parents: string[];
  message: string;
  author: string;
  branches: string[];
  is_head: boolean;
  tags: string[];
  date?: string;
}

type GitTag = {
  name: string;
  annotated: boolean;
};

type GitRemote = {
  name: string;
  remote: string | null;
};

type GitStash = {
  hash: string;
  base_hash: string;
  untracked_files_hash: string | null;
  selector: string;
  author: string;
  email: string;
  date: number;
  message: string;
};

type GitCommit = {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  heads: string[];
  tags: GitTag[];
  remotes: GitRemote[];
  stash: GitStash | null;
};

type GitCommitData = {
  commits: GitCommit[];
  head: string | null;
  tags: string[];
  more_commits_available: boolean;
  error: string | null;
};

export function GitGraph({ repoPath }: { repoPath: string }) {
  const [commitData, setCommitData] = useState<GitCommitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    core
      .invoke<GitCommitData>("get_formatted_commits", {
        path: repoPath,
        branches: null,
        authors: null,
        max_commits: 200,
        show_tags: true,
        show_remote_branches: true,
        include_commits_mentioned_by_reflogs: false,
        only_follow_first_parent: false,
        commit_ordering: "Date",
        remotes: ["origin"],
        hide_remotes: [],
        stashes: [],
      })
      .then((data: GitCommitData) => {
        console.log("GitCommitData", data);
        setCommitData(data);
      })
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, [repoPath]);

  if (!repoPath) return null;

  return (
    <div
      style={{
        width: "100%",
        height: "80vh",
        background: "#18181b",
        overflow: "auto",
        position: "relative",
      }}>
      {/* Aquí irá el grafo de commits personalizado */}
    </div>
  );
}
