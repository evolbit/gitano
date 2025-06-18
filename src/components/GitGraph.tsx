import { core } from "@tauri-apps/api";
import React, { useEffect, useRef, useState } from "react";
import { GitCommitData } from "../types/git";
import "./graph/styles.css";
import { GraphConfig } from "./graph/types";

interface GitGraphProps {
  repoPath: string;
}

const defaultConfig: GraphConfig = {
  style: "angular",
  grid: {
    x: 30,
    y: 30,
    offsetX: 20,
    offsetY: 20,
    radius: 4,
  },
  colours: {
    commit: "#000000",
    uncommitted: "#808080",
    current: "#ff0000",
  },
  uncommittedChanges: "open-circle",
};

export const GitGraph: React.FC<GitGraphProps> = ({ repoPath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [commitHead, setCommitHead] = useState<string | null>(null);
  const [commitLookup, setCommitLookup] = useState<{ [hash: string]: number }>(
    {}
  );
  const [loading, setLoading] = useState(false);

  const [onlyFollowFirstParent, setOnlyFollowFirstParent] = useState(false);

  useEffect(() => {
    setLoading(true);
    core
      .invoke<GitCommitData>("get_formatted_commits", {
        path: repoPath,
        branches: null,
        authors: null,
        maxCommits: 100,
        showTags: true,
        showRemoteBranches: true,
        includeCommitsMentionedByReflogs: false,
        onlyFollowFirstParent,
        remotes: [],
        hideRemotes: [],
        stashes: [],
      })
      .then((data: any) => {
        console.log(JSON.stringify(data, null, 2));
        setCommits(data.commits || []);
        setCommitHead(data.head || null);
        // Construir commitLookup
        const lookup: { [hash: string]: number } = {};
        (data.commits || []).forEach((commit: any, idx: number) => {
          lookup[commit.hash] = idx;
        });
        setCommitLookup(lookup);
        setLoading(false);
      });
  }, [repoPath, onlyFollowFirstParent]);

  if (loading) return <div>Cargando commits...</div>;
  if (commits.length === 0) return <div>No hay commits para mostrar.</div>;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "5000px",
        overflow: "auto",
      }}
    />
  );
};
