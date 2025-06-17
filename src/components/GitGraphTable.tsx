import React, { useEffect, useRef } from "react";
import { Graph } from "./graph/Graph";
import "./graph/styles.css";
import { GraphConfig } from "./graph/types";

type CommitNode = {
  hash: string;
  parents: string[];
  branch: string;
  stash?: any;
};

interface GitGraphTableProps {
  commits?: CommitNode[];
  commitHead: string | null;
  commitLookup: { [hash: string]: number };
  onlyFollowFirstParent: boolean;
  expandedCommit: {
    index: number;
    commitHash: string;
    compareWithHash: string | null;
  } | null;
}

const defaultConfig: GraphConfig = {
  style: "angular",
  uncommittedChanges: "open-circle",
  grid: {
    x: 50,
    y: 16,
    offsetX: 50,
    offsetY: 16,
    radius: 4,
  },
  colours: {
    commit: "#808080",
    uncommitted: "#808080",
    current: "#808080",
  },
};

const COLUMN_AUTO = -1;
const COLUMN_HIDDEN = -2;
const COLUMN_LEFT_RIGHT_PADDING = 12;
const DEFAULT_COLUMN_WIDTHS = [200, COLUMN_AUTO, 128, 128, 80];

export const GitGraphTable: React.FC<GitGraphTableProps> = ({
  commits = [],
  commitHead,
  commitLookup,
  onlyFollowFirstParent,
  expandedCommit,
}) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const graphInstanceRef = useRef<Graph | null>(null);

  // Guard: commits must be an array
  if (!Array.isArray(commits)) {
    return <div>No hay datos de commits.</div>;
  }

  useEffect(() => {
    if (graphRef.current && !graphInstanceRef.current) {
      graphInstanceRef.current = new Graph(
        "graph",
        graphRef.current,
        defaultConfig
      );
    }
    if (graphInstanceRef.current && graphRef.current) {
      graphInstanceRef.current.loadCommits(
        commits,
        commitHead,
        commitLookup,
        onlyFollowFirstParent
      );
      if (expandedCommit) {
        graphInstanceRef.current.setExpandedCommit(expandedCommit.commitHash);
      }
      graphInstanceRef.current.render(graphRef.current);
    }
  }, [
    commits,
    commitHead,
    commitLookup,
    onlyFollowFirstParent,
    expandedCommit,
  ]);

  if (commits.length === 0) {
    return <div>No hay commits para mostrar.</div>;
  }

  return (
    <div className="git-graph-table">
      <div className="table-content">
        <div
          ref={graphRef}
          className="graph-column"
          style={{ width: 50 }}
        />
        <div
          className="commits-column"
          style={{ width: 200 }}>
          {commits.map((commit) => (
            <div
              key={commit.hash}
              className="commit-row">
              <div className="commit-hash">{commit.hash}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
