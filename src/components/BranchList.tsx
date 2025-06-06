import { IconGitBranch } from "@tabler/icons-react";
import { core } from "@tauri-apps/api";
import { useEffect, useState } from "react";

export function BranchList({ repoPath }: { repoPath: string }) {
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    core
      .invoke<string[]>("get_branches", { path: repoPath })
      .then(setBranches)
      .catch((e) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, [repoPath]);

  if (!repoPath) return null;

  return (
    <div className="p-4">
      <div className="font-bold mb-2 flex items-center gap-2">
        <IconGitBranch className="w-5 h-5" /> Ramas
      </div>
      {loading && <div className="text-xs text-zinc-400">Cargando...</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
      <ul className="text-sm mt-2 space-y-1">
        {branches.map((b) => (
          <li
            key={b}
            className="truncate">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
