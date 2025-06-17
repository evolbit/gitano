import React from "react";
import { GitGraph } from "./GitGraph";

const exampleCommits = [
  {
    hash: "a1b2c3d4",
    parents: [],
    branch: "main",
  },
  {
    hash: "e5f6g7h8",
    parents: ["a1b2c3d4"],
    branch: "main",
  },
  {
    hash: "i9j0k1l2",
    parents: ["e5f6g7h8"],
    branch: "feature",
  },
  {
    hash: "m3n4o5p6",
    parents: ["e5f6g7h8"],
    branch: "main",
  },
  {
    hash: "q7r8s9t0",
    parents: ["i9j0k1l2", "m3n4o5p6"],
    branch: "main",
  },
];

const commitLookup = exampleCommits.reduce((acc, commit, index) => {
  acc[commit.hash] = index;
  return acc;
}, {} as { [hash: string]: number });

export const GraphExample: React.FC = () => {
  return (
    <div style={{ width: "800px", height: "600px", border: "1px solid #ccc" }}>
      <GitGraph
        commits={exampleCommits}
        commitHead="q7r8s9t0"
        commitLookup={commitLookup}
        onlyFollowFirstParent={false}
      />
    </div>
  );
};
