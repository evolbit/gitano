import { IconGitCommit } from "@tabler/icons-react";
import { core } from "@tauri-apps/api";
import { useEffect, useState } from "react";

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
}

export function CommitList({ repoPath }: { repoPath: string }) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    core
      .invoke<CommitInfo[]>("get_commits", { path: repoPath })
      .then(setCommits)
      .catch((e) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, [repoPath]);

  if (!repoPath) return null;

  return (
    <div className="p-4">
      <div className="font-bold mb-2 flex items-center gap-2">
        <IconGitCommit className="w-5 h-5" /> Commits
      </div>
      {loading && <div className="text-xs text-zinc-400">Cargando...</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
      <ul className="text-sm mt-2 space-y-1">
        {commits.map((c) => (
          <li
            key={c.hash}
            className="truncate">
            <span className="font-mono text-xs text-zinc-400">
              {c.hash.slice(0, 7)}
            </span>{" "}
            <span className="font-semibold">{c.message}</span>
            <span className="ml-2 text-xs text-zinc-500">{c.author}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
