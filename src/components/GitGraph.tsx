import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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

// Datos ficticios para pruebas
const data = [
  {
    graph: "●",
    description: "feat: initial commit",
    date: "2024-06-16 13:27",
    author: "Alice",
    commit: "8d8b6a03",
  },
  {
    graph: "●",
    description: "fix: bug in sidebar",
    date: "2024-06-15 10:12",
    author: "Bob",
    commit: "9812e9ec",
  },
  {
    graph: "●",
    description: "refactor: cleanup",
    date: "2024-06-14 09:00",
    author: "Carol",
    commit: "4d69e6c6",
  },
];

const columns: ColumnDef<any>[] = [
  {
    accessorKey: "graph",
    header: () => "Graph",
    size: 60,
  },
  {
    accessorKey: "description",
    header: () => "Description",
    size: 300,
  },
  {
    accessorKey: "date",
    header: () => "Date",
    size: 160,
  },
  {
    accessorKey: "author",
    header: () => "Author",
    size: 120,
  },
  {
    accessorKey: "commit",
    header: () => "Commit",
    size: 100,
  },
];

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

  // Tabla TanStack
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    debugTable: false,
  });

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
      <div style={{ width: "100%", overflowX: "auto" }}>
        <table
          style={{ width: "100%", color: "#fff", borderCollapse: "collapse" }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup: any) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header: any) => (
                  <th
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      borderBottom: "1px solid #333",
                      background: "#23232b",
                      padding: "8px",
                      userSelect: "none",
                      position: "relative",
                    }}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          height: "100%",
                          width: "4px",
                          cursor: "col-resize",
                          zIndex: 1,
                          userSelect: "none",
                        }}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row: any) => (
              <tr
                key={row.id}
                style={{ borderBottom: "1px solid #222" }}>
                {row.getVisibleCells().map((cell: any) => (
                  <td
                    key={cell.id}
                    style={{ padding: "8px" }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
