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

  console.log("repoPath", repoPath);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    core
      .invoke<GitCommitData>("get_formatted_commits", {
        path: repoPath,
        branches: null,
        authors: null,
        maxCommits: 200,
        showTags: true,
        showRemoteBranches: true,
        includeCommitsMentionedByReflogs: false,
        onlyFollowFirstParent: false,
        commitOrdering: "Date",
        remotes: ["origin"],
        hideRemotes: [],
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
      {error && <div className="text-red-500">{error}</div>}
      {/* Aquí irá el grafo de commits personalizado */}
    </div>
  );
}
